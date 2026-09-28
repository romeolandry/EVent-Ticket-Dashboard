# Event Ticket Plus — Dashboard

A dashboard for a WordPress site running **The Events Calendar + Event Tickets
Plus**: list upcoming events, view their attendees, check them in/out, assign
work groups, and print badges — with email-based access control and a Node
backend that keeps the WordPress credentials off the client.

Stack: **Vue 3 + TypeScript + Pinia + Vite** (frontend) and a **dependency-free
Node server** (backend) shipping in a single Docker image.

## Features

- **Events**: only *public* (`publish`) and *upcoming* events are shown.
- **Attendees**: full name/email/ticket plus the custom *Attendee
  Information* fields as dynamic columns (German field labels are translated
  through the UI locale).
- **Check-in / check-out** per attendee (real `PATCH` against the WP API).
- **Work groups**: assign a group number per attendee (manual select or
  even round-robin auto-assign), filter by group. Badges can only be printed
  for attendees who are checked in **and** have a group.
- **Badge printing**: configurable print window — event title (overridable),
  email, ticket, group, and any custom fields.
- **Statistics popup**: children-by-age aggregation (parses free-text German
  answers) and arrival-day distribution.
- **Filters**: by name, by arrival day, by group.
- **CSV export** of the complete attendee list (Excel-friendly: `;`
  separator, UTF-8 BOM).
- **i18n**: French (default), English, German — persisted per browser.
- **Email authentication**: visitors log in with an email address; only
  emails on the server-side allow-list (or the superuser) get a session.
  The superuser manages the allow-list from the UI (**Access** button).

## Architecture

```
Browser (SPA)                     Node server (Docker)              WordPress
─────────────                     ──────────────────────            ─────────
POST /api/auth (email)       →    email allow-list check
GET  /wp-api/tribe/...       →    session check, adds Basic auth →  /wp-json/tribe/...
PATCH /wp-api/.../attendees  →    forwards body                  →  attendees/{id}
GET  /api/access-list        →    superuser only
```

- Reactivity: Pinia stores (`src/stores/`); API access in `src/services/`.
- WP quirks handled in `src/services/wpApi.ts` (see code comments):
  the attendees endpoint **ignores the `event=` parameter** (client-side
  filter on `attendee.post_id`) and not all events are `publish`.
- `server/accessList.mjs` holds the pure access-control logic (unit-tested);
  `server/index.mjs` is the HTTP server (static SPA + API + WP proxy).

### Backend endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth` | — | Log in with an email (`{ email }` → `{ token, email, isSuperuser }`) |
| POST | `/api/logout` | session | Destroy the session |
| GET/PUT | `/api/access-list` | **superuser** | Read / replace the allowed-email list |
| GET/PATCH/… | `/wp-api/*` | session | Proxied to `VITE_WP_API_URL/wp-json/*` with Basic auth added |
| GET | `/healthz` | — | Health check |

Sessions are in-memory tokens (12 h TTL) — a server restart logs everybody out.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Used by | Purpose |
|---|---|---|
| `WP_API_URL` (or `VITE_WP_API_URL`) | server | WordPress base URL, no trailing slash |
| `WP_AUTH_USER` (or `VITE_WP_AUTH_USER`) | server | WP user for the API (prefer an **application password**) |
| `WP_AUTH_PASSWORD` (or `VITE_WP_AUTH_PASSWORD`) | server | The application password |
| `SUPERUSER_EMAIL` | server | Only these emails can manage the allow-list (comma-separated list supported) |
| `PORT` | server | Listen port (default `8080`) |
| `DATA_DIR` | server | Folder holding `allowed-emails.json` (default `/data`) |

Nothing secret ever reaches the browser bundle: the frontend only knows
`/wp-api/*` and its own session token.

## Development

Environment notes (this machine): prefix npm installs with
`NODE_OPTIONS=--dns-result-order=ipv4first` (broken IPv6 to the npm registry)
and use `npm install --legacy-peer-deps`.

Two processes are required:

```sh
# 1. Backend (auth + WP proxy) — loads .env
set -a; . ./.env; set +a
DATA_DIR=/tmp/etp-data PORT=8890 node server/index.mjs

# 2. Frontend (http://localhost:5173)
npm run dev
```

Vite proxies `/api` and `/wp-api` to the backend on port 8890.

### Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run test:unit -- run` | Vitest unit + server integration tests |
| `npm run lint` | oxlint + eslint |
| `npm run build` | vue-tsc type-check + production build |
| `npm run test:real -- <eventId>` | Smoke-test script against the live WP API (uses `.env` directly) |

## Docker deployment

```sh
docker compose up -d          # reads your local .env, mounts the data volume
```

or plain Docker:

```sh
docker build -t event-ticket-plus-dashboard .
docker run -d -p 8080:8080 \
  -e WP_API_URL=https://your-wordpress.example \
  -e WP_AUTH_USER=... -e WP_AUTH_PASSWORD=... \
  -e SUPERUSER_EMAIL=you@example.com \
  -v etp-data:/data \
  event-ticket-plus-dashboard
```

- Image: multi-stage build (`node:22-alpine` build → Node runtime), runs as
  the unprivileged `node` user.
- The email allow-list lives in `/data/allowed-emails.json` inside a volume —
  it is served over HTTP by **nothing**.
- Secrets are supplied at runtime only; nothing is baked into the image or
  into the JavaScript bundle.
- First login: sign in with your `SUPERUSER_EMAIL`, then open **Access** to
  add the staff emails allowed in.
