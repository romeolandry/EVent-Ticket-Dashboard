// @vitest-environment node
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

  it('les groupes exigent une session (GET et PUT)', async () => {
    expect((await api('/api/groups?event=1262')).status).toBe(401)
    expect(
      (
        await api('/api/groups?event=1262', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 2, map: { 1: 1 } }),
        })
      ).status,
    ).toBe(401)
  })

  it('les groupes sont partagés entre tous les clients connectés', async () => {
    const login = (email) =>
      api('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).then((r) => r.json())
    // Deux sessions distinctes simulent deux navigateurs différents
    const clientA = await login('admin@wach-auf.com')
    const clientB = await login('admin@wach-auf.com')

    const state = { count: 3, map: { 101: 2, 102: 1 }, excludeEmails: ['staff@wach-auf.com'] }
    const put = await api('/api/groups?event=1262', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${clientA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    expect(put.status).toBe(200)

    const getB = await api('/api/groups?event=1262', {
      headers: { Authorization: `Bearer ${clientB.token}` },
    })
    expect(await getB.json()).toEqual(state)

    // Persisté dans la base SQLite DATA_DIR/groups.db : une ligne par
    // participant avec son groupe (colonne group_number) + exclusions
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(join(dataDir, 'groups.db'))
    const rows = db
      .prepare(
        'SELECT attendee_id, group_number FROM attendee_group WHERE event_id = 1262 ORDER BY attendee_id',
      )
      .all()
    const exclusions = db
      .prepare('SELECT email FROM event_group_exclusion WHERE event_id = 1262')
      .all()
    db.close()
    expect(rows).toEqual([
      { attendee_id: 101, group_number: 2 },
      { attendee_id: 102, group_number: 1 },
    ])
    expect(exclusions).toEqual([{ email: 'staff@wach-auf.com' }])
  })

  it('les groupes retournent l’état par défaut pour un événement jamais sauvegardé', async () => {
    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    const res = await api('/api/groups?event=9999', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(await res.json()).toEqual({ count: 4, map: {}, excludeEmails: [] })
  })

  it('un événement invalide est rejeté (400)', async () => {
    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    const res = await api('/api/groups?event=../../secret', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
  })

  it('les paramètres exigent une session et une clé valide', async () => {
    expect((await api('/api/settings?key=badge-config')).status).toBe(401)

    const login = await api('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@wach-auf.com' }),
    })
    const { token } = await login.json()

    const res = await api('/api/settings?key=../../secret', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
  })

  it('les paramètres sont partagés entre tous les utilisateurs connectés', async () => {
    const login = () =>
      api('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@wach-auf.com' }),
      }).then((r) => r.json())
    const clientA = await login()
    const clientB = await login()

    // Paramètre jamais enregistré → value: null
    const empty = await api('/api/settings?key=test-config', {
      headers: { Authorization: `Bearer ${clientA.token}` },
    })
    expect(await empty.json()).toEqual({ key: 'test-config', value: null })

    const config = { showEmail: true, colorMode: 'bw' }
    const put = await api('/api/settings?key=test-config', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${clientA.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: config }),
    })
    expect(put.status).toBe(200)

    const getB = await api('/api/settings?key=test-config', {
      headers: { Authorization: `Bearer ${clientB.token}` },
    })
    expect(await getB.json()).toEqual({ key: 'test-config', value: config })
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
