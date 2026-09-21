/**
 * Test réel contre l'API WordPress (hors Vitest) — attend un événement
 * existant, par ex. : npm run test:real -- 1262
 *
 * Lit .env à la racine du projet (VITE_WP_API_URL, VITE_WP_AUTH_USER,
 * VITE_WP_AUTH_PASSWORD) et interroge les mêmes endpoints que l'app.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const eventId = process.argv[2]

const env = Object.fromEntries(
  readFileSync(`${root}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('='))
    .map(([k, ...v]) => [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')]),
)

const base = (env.VITE_WP_API_URL ?? '').replace(/\/$/, '')
if (!base) {
  console.error('VITE_WP_API_URL manquante dans .env')
  process.exit(1)
}

const headers = { Accept: 'application/json' }
if (env.VITE_WP_AUTH_USER && env.VITE_WP_AUTH_PASSWORD) {
  headers.Authorization =
    'Basic ' +
    Buffer.from(`${env.VITE_WP_AUTH_USER}:${env.VITE_WP_AUTH_PASSWORD}`).toString('base64')
  console.log(`Auth: Basic (utilisateur "${env.VITE_WP_AUTH_USER}")`)
} else {
  console.log('Auth: aucune (pas de VITE_WP_AUTH_USER/PASSWORD)')
}

async function get(path) {
  const url = `${base}${path}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    console.error(`\nÉCHEC ${res.status} ${res.statusText} — ${url}`)
    console.error((await res.text()).slice(0, 500))
    process.exit(1)
  }
  console.log(`OK ${res.status} — ${url}`)
  return res.json()
}

const events = await get('/wp-json/tribe/events/v1/events?per_page=50')
console.log(`\nÉvénements trouvés : ${events.events?.length ?? 0} (total: ${events.total})`)
for (const e of events.events ?? []) {
  const title = typeof e.title === 'string' ? e.title : e.title?.rendered
  console.log(`  ${e.id} | ${e.start_date ?? '?'} | ${title}`)
}

if (eventId) {
  const path = (page) =>
    `/wp-json/tribe/tickets/v1/attendees?event=${encodeURIComponent(eventId)}&per_page=100&page=${page}`
  const first = await get(path(1))
  let list = Array.isArray(first) ? first : (first.attendees ?? [])
  const totalPages = Array.isArray(first) ? 1 : (first.total_pages ?? 1)
  for (let page = 2; page <= totalPages; page++) {
    const data = await get(path(page))
    list = list.concat(Array.isArray(data) ? data : (data.attendees ?? []))
  }
  console.log(`\nParticipants de l'événement ${eventId} : ${list.length} (total: ${first.total ?? '?'})`)
  const fieldKeys = new Set()
  for (const a of list) {
    for (const key of Object.keys(a.information ?? {})) fieldKeys.add(key)
  }
  console.log(
    `\nChamps « Attendee information » (${fieldKeys.size}) : ${[...fieldKeys].join(' | ') || 'aucun'}`,
  )
  for (const a of list) {
    const info = Object.entries(a.information ?? {})
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(', ') : v}`)
      .join('; ')
    console.log(
      `  ${a.id} | ${(a.purchaser_name ?? a.title ?? '').trim()} | ${a.purchaser_email ?? a.email ?? ''} | ${a.ticket?.title ?? a.ticket ?? ''} | checked_in: ${a.checked_in ?? false}${info ? ` | ${info}` : ''}`,
    )
  }
}
