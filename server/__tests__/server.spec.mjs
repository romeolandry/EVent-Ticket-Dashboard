/**
 * Test d'intégration du serveur : démarre un faux WordPress et le serveur
 * réel comme processus enfant, puis vérifie le proxy et l'authentification.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const SERVER_PATH = join(process.cwd(), 'server', 'index.mjs')
const PORT = 18890
let upstreamPort
let upstream
let child
let dataDir

const seenRequests = []

beforeAll(async () => {
  // Faux WordPress : enregistre les requêtes et répond des JSON minimes
  upstream = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      seenRequests.push({ url: req.url, method: req.method, auth: req.headers.authorization, body })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, path: req.url }))
    })
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  upstreamPort = upstream.address().port

  dataDir = mkdtempSync(join(tmpdir(), 'etp-server-test-'))

  child = spawn(process.execPath, [SERVER_PATH], {
    env: {
      ...process.env,
      PATH: process.env.PATH,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      SUPERUSER_EMAIL: 'admin@wach-auf.com',
      WP_API_URL: `http://127.0.0.1:${upstreamPort}`,
      WP_AUTH_USER: 'wp-admin',
      WP_AUTH_PASSWORD: 'wp-pass',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('serveur lent à démarrer')), 8000)
    child.stdout.on('data', (data) => {
      if (String(data).includes('écoute')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    child.on('exit', (code) => reject(new Error(`serveur arrêté trop tôt (${code})`)))
  })
}, 15000)

afterAll(() => {
  child?.kill()
  upstream?.close()
})

const api = (path, init) => fetch(`http://127.0.0.1:${PORT}${path}`, init)

describe('serveur Node — proxy WP et auth', () => {
  it('authentification email : refuse l’inconnu, accepte le superuser', async () => {
    const denied = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inconnu@x.yz' }),
    })
    expect(denied.status).toBe(403)

    const ok = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Admin@Wach-Auf.com' }),
    })
    const session = await ok.json()
    expect(ok.status).toBe(200)
    expect(session.isSuperuser).toBe(true)
  })

  it('le proxy exige une session (401 anonymous)', async () => {
    const res = await api('/wp-api/tribe/events/v1/events')
    expect(res.status).toBe(401)
    expect(seenRequests).toHaveLength(0)
  })

  it('le proxy ajoute le Basic auth côté serveur et relaie la réponse', async () => {
    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    const res = await api('/wp-api/tribe/events/v1/events?per_page=50', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.path).toBe('/wp-json/tribe/events/v1/events?per_page=50')
    const relayed = seenRequests[0]
    expect(relayed.auth).toBe(
      'Basic ' + Buffer.from('wp-admin:wp-pass').toString('base64'),
    )
  })

  it('le proxy relaie un PATCH (check-in)', async () => {
    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    const res = await api('/wp-api/tribe/tickets/v1/attendees/1089', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_in: true }),
    })

    expect(res.status).toBe(200)
    const patch = seenRequests.find((r) => r.method === 'PATCH')
    expect(patch.url).toBe('/wp-json/tribe/tickets/v1/attendees/1089')
    expect(JSON.parse(patch.body)).toEqual({ check_in: true })
  })

  it('la liste d’accès n’est pas exposée via le proxy ni le statique', async () => {
    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    // allowed-emails.json n'existe pas côté WordPress → le proxy ne doit jamais
    // recevoir de requête pour lui ; le fichier vit dans DATA_DIR.
    const res = await api('/wp-api/data/allowed-emails.json', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const proxied = seenRequests.filter((r) => r.url?.includes('allowed-emails'))
    expect(res.status).not.toBe(404)
    expect(proxied.every((r) => r.url.startsWith('/wp-json/'))).toBe(true)
  })
})
