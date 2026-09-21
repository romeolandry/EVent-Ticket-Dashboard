/**
 * Serveur de production : SPA statique + API d'authentification par email.
 *
 * - POST /api/auth { email }  → session si l'email est autorisé
 * - GET/PUT /api/access-list  → superuser uniquement
 * - GET  /config.js           → config runtime générée depuis l'environnement
 * - GET  /healthz
 *
 * La liste des emails autorisés est stockée dans DATA_DIR/allowed-emails.json
 * (hors racine web : jamais servie, jamais envoyée aux visiteurs).
 */
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isAllowedEmail,
  isSuperuserEmail,
  isValidEmail,
  normalizeEmail,
  sanitizeEmailList,
} from './accessList.mjs'

const PORT = Number(process.env.PORT ?? 8080)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = process.env.DATA_DIR ?? '/data'
const DIST_DIR = process.env.DIST_DIR ?? fileURLToPath(new URL('../dist', import.meta.url))
const SUPERUSER_EMAIL = process.env.SUPERUSER_EMAIL ?? ''
const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const ALLOWED_EMAILS_FILE = join(DATA_DIR, 'allowed-emails.json')

/** Sessions en mémoire : token → { email, isSuperuser, expiresAt } */
const sessions = new Map()

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function wpConfig() {
  return {
    base: (process.env.WP_API_URL || process.env.VITE_WP_API_URL || '').replace(/\/$/, ''),
    user: process.env.WP_AUTH_USER || process.env.VITE_WP_AUTH_USER || '',
    password: process.env.WP_AUTH_PASSWORD || process.env.VITE_WP_AUTH_PASSWORD || '',
  }
}

async function loadAllowedEmails() {
  try {
    const raw = JSON.parse(await readFile(ALLOWED_EMAILS_FILE, 'utf8'))
    return Array.isArray(raw?.emails) ? raw.emails : []
  } catch {
    return []
  }
}

async function saveAllowedEmails(emails) {
  await mkdir(DATA_DIR, { recursive: true })
  // Écriture atomique : fichier temporaire puis renommage
  const tmp = `${ALLOWED_EMAILS_FILE}.tmp`
  await writeFile(tmp, JSON.stringify({ emails }, null, 2), 'utf8')
  await rename(tmp, ALLOWED_EMAILS_FILE)
}

function sessionFrom(req) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const session = sessions.get(token)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }
  return session
}

function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

async function readRawBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 10_000) throw new Error('payload trop grand')
  }
  return body
}

async function readBody(req) {
  return JSON.parse((await readRawBody(req)) || '{}')
}

async function handleAuth(req, res) {
  let email
  try {
    email = (await readBody(req)).email
  } catch {
    return json(res, 400, { error: 'invalid_body' })
  }
  if (!isValidEmail(email)) return json(res, 400, { error: 'invalid_email' })

  const allowedEmails = await loadAllowedEmails()
  if (!isAllowedEmail(email, { superuserEmail: SUPERUSER_EMAIL, allowedEmails })) {
    return json(res, 403, { error: 'not_allowed' })
  }

  const token = randomUUID()
  const session = {
    email: normalizeEmail(email),
    isSuperuser: isSuperuserEmail(email, SUPERUSER_EMAIL),
    expiresAt: Date.now() + SESSION_TTL_MS,
  }
  sessions.set(token, session)
  return json(res, 200, { token, email: session.email, isSuperuser: session.isSuperuser })
}

async function handleAccessList(req, res) {
  const session = sessionFrom(req)
  if (!session?.isSuperuser) return json(res, 403, { error: 'forbidden' })

  if (req.method === 'GET') {
    return json(res, 200, { emails: await loadAllowedEmails() })
  }

  let emails
  try {
    emails = (await readBody(req)).emails
  } catch {
    return json(res, 400, { error: 'invalid_body' })
  }
  if (!Array.isArray(emails)) return json(res, 400, { error: 'invalid_body' })

  const { cleaned, invalid } = sanitizeEmailList(emails)
  if (invalid.length > 0) {
    return json(res, 400, { error: 'invalid_emails', invalid })
  }
  await saveAllowedEmails(cleaned)
  return json(res, 200, { emails: cleaned })
}

async function handleLogout(req, res) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  sessions.delete(token)
  return json(res, 200, { ok: true })
}

/**
 * Proxy vers l'API WordPress : les identifiants Basic ne vivent que sur le
 * serveur — jamais dans le bundle JavaScript. Session valide requise.
 */
async function handleWpProxy(req, res, url) {
  const session = sessionFrom(req)
  if (!session) return json(res, 401, { error: 'unauthorized' })

  const { base, user, password } = wpConfig()
  if (!base) return json(res, 500, { error: 'wp_api_not_configured' })

  const target = `${base}/wp-json${url.pathname.slice('/wp-api'.length)}${url.search}`
  const headers = { Accept: 'application/json' }
  if (user && password) {
    headers.Authorization = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64')
  }

  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
    try {
      init.body = await readRawBody(req)
    } catch {
      return json(res, 400, { error: 'invalid_body' })
    }
  }

  let upstream
  try {
    upstream = await fetch(target, init)
  } catch {
    return json(res, 502, { error: 'wp_api_unreachable' })
  }
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
  })
  res.end(await upstream.text())
}

async function serveStatic(req, res, pathname) {
  let filePath = normalize(join(DIST_DIR, pathname))
  if (!filePath.startsWith(normalize(DIST_DIR))) {
    res.writeHead(403).end()
    return
  }
  let content
  try {
    content = await readFile(filePath)
  } catch {
    // SPA fallback
    try {
      content = await readFile(join(DIST_DIR, 'index.html'))
      filePath = join(DIST_DIR, 'index.html')
    } catch {
      res.writeHead(404).end('Not found')
      return
    }
  }
  const headers = { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' }
  headers['Cache-Control'] = filePath.includes('/assets/') ? 'public, max-age=2592000, immutable' : 'no-store'
  res.writeHead(200, headers)
  res.end(content)
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    if (pathname === '/healthz') return json(res, 200, { ok: true })
    if (pathname === '/api/auth' && req.method === 'POST') return await handleAuth(req, res)
    if (pathname === '/api/logout' && req.method === 'POST') return await handleLogout(req, res)
    if (pathname === '/api/access-list' && (req.method === 'GET' || req.method === 'PUT')) {
      return await handleAccessList(req, res)
    }
    if (pathname.startsWith('/wp-api/')) return await handleWpProxy(req, res, url)
    if (req.method === 'GET') return await serveStatic(req, res, pathname)

    json(res, 404, { error: 'not_found' })
  } catch (error) {
    console.error('[server]', error)
    json(res, 500, { error: 'internal_error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[server] écoute sur http://${HOST}:${PORT} (dist: ${DIST_DIR}, data: ${DATA_DIR})`)
})
