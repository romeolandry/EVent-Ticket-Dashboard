/**
 * Agent local d'impression Brother QL-800 — à lancer sur le PC relié à
 * l'imprimante (USB), PAS dans le conteneur Docker du dashboard :
 *
 *     python3 -m pip install brother_ql        # une seule fois
 *     brother_ql discover                      # repérer l'imprimante
 *     node server/printAgent.mjs
 *
 * Aucune dépendance npm : Node ≥ 22 suffit. L'agent écoute sur 127.0.0.1:9100
 * et n'accepte que des PNG ; l'impression passe par le CLI Python
 * `brother_ql` (backend file:///dev/usb/lp0 par défaut), avec coupe
 * automatique en fin d'étiquette.
 *
 * Variables d'environnement :
 *   QL800_HOST     (127.0.0.1)
 *   QL800_PORT     (9100)
 *   QL800_MODEL    (QL-800)
 *   QL800_PRINTER  (file:///dev/usb/lp0 — résultat de `brother_ql discover`)
 *   QL800_LABEL    (62 — rouleau continu 62 mm, ex. DK-22205)
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { agentConfigFromEnv, buildBrotherQlArgs, parsePngDataUrl } from './ql800Print.mjs'

const config = agentConfigFromEnv(process.env)
const PRINT_TIMEOUT_MS = 30_000
const MAX_IMAGE_BYTES = 8_000_000

/** `brother_ql --help` confirme que le CLI Python est installé. */
function checkBrotherQl() {
  return new Promise((resolve) => {
    const child = spawn('brother_ql', ['--help'], { stdio: 'ignore' })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

function corsHeaders() {
  // Pages servies par n'importe quelle origine : l'agent ne traite que des
  // impressions et n'expose aucune donnée sensible.
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(res, status, body) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readBody(req, maxBytes) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > maxBytes) throw new Error('payload trop grand')
  }
  return JSON.parse(body || '{}')
}

/** Envoie un PNG au CLI brother_ql ; rejette si échec ou timeout. */
function runBrotherQl(imagePath) {
  const args = buildBrotherQlArgs({
    model: config.model,
    printer: config.printer,
    label: config.label,
    imagePath,
  })
  return new Promise((resolve, reject) => {
    const child = spawn('brother_ql', args)
    let stderr = ''
    child.stderr.on('data', (chunk) => (stderr += String(chunk)))
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('brother_ql : délai dépassé'))
    }, PRINT_TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `brother_ql a échoué (code ${code})`))
    })
  })
}

async function handlePrint(req, res, brotherQlOk) {
  if (!brotherQlOk) return json(res, 500, { error: 'brother_ql introuvable' })

  let body
  try {
    body = await readBody(req, MAX_IMAGE_BYTES * 2)
  } catch {
    return json(res, 400, { error: 'invalid_body' })
  }
  const png = parsePngDataUrl(body?.image, MAX_IMAGE_BYTES)
  if (!png) return json(res, 400, { error: 'invalid_image' })

  const imagePath = join(tmpdir(), `etp-badge-${randomUUID()}.png`)
  try {
    await writeFile(imagePath, png)
    await runBrotherQl(imagePath)
    return json(res, 200, { ok: true })
  } catch (error) {
    console.error('[ql-800]', error instanceof Error ? error.message : error)
    return json(res, 502, { error: 'print_failed', detail: String(error?.message ?? error) })
  } finally {
    await rm(imagePath, { force: true }).catch(() => {})
  }
}

const brotherQlOk = await checkBrotherQl()

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'OPTIONS') return json(res, 204, {})
    if (url.pathname === '/healthz' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        model: config.model,
        printer: config.printer,
        label: config.label,
        brotherQl: brotherQlOk,
      })
    }
    if (url.pathname === '/print' && req.method === 'POST') {
      return await handlePrint(req, res, brotherQlOk)
    }
    return json(res, 404, { error: 'not_found' })
  } catch (error) {
    console.error('[ql-800]', error)
    return json(res, 500, { error: 'internal_error' })
  }
})

server.listen(config.port, config.host, () => {
  console.log(
    `[ql-800] agent prêt sur http://${config.host}:${config.port} ` +
      `(${config.model}, étiquette ${config.label}, ${config.printer})`,
  )
  if (!brotherQlOk) {
    console.warn(
      '[ql-800] ATTENTION : CLI brother_ql introuvable — installez-le : python3 -m pip install brother_ql',
    )
  }
})
