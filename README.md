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
  auto-assign that keeps existing assignments and only balances unassigned
  attendees), filter by group. Assignments are persisted **server-side in a
  SQLite database** (`/data/groups.db`, built-in `node:sqlite` — one row per
  attendee in table `attendee_group`, rewritten on every change) and shared
  by all connected clients; `localStorage` is only an offline fallback.
  An **exclusion list** per event (table `event_group_exclusion`) reserves
  **group 1** for listed emails: they are assigned there by default and
  auto-assign distributes everyone else over groups 2..N (manual assignment
  stays possible). Excluded attendees show a ⊘ icon next to their name.
  Badges can only be printed for attendees who are checked in **and** have a
  group.
- **Badge printing**: configurable print window — event title (overridable),
  email, ticket, group, and any custom fields. A **QL-800** direct-print
  action prints badge labels without any print dialog via a local agent (see
  *Brother QL-800 direct printing* below).
- **Statistics popup**: attendance-rate pie chart (checked-in vs not),
  children-by-age aggregation (parses free-text German answers) and
  arrival-day distribution.
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
| GET/PUT | `/api/groups?event=<id>` | session | Read / replace the shared work-group state of an event |
| GET/PUT | `/api/settings?key=<key>` | session | Read / replace a shared app setting (e.g. `badge-config`), stored in SQLite `app_settings` |
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

## Brother QL-800 direct printing

Browsers cannot talk to USB printers without a print dialog, so direct
printing goes through a **local agent** running on the PC the QL-800 is
plugged into (`server/printAgent.mjs`, dependency-free Node ≥ 22). The SPA
renders the badge on a canvas at the printer's native resolution (62 mm
continuous roll DK-22205 → 696 px @ 300 dpi) and POSTs the PNG to the agent,
which hands it to the Python [`brother_ql`](https://pypi.org/project/brother-ql/)
CLI (automatic cut included).

Setup on the reception PC:

```sh
python3 -m pip install brother_ql
brother_ql discover            # find the printer URI (e.g. file:///dev/usb/lp0)
node server/printAgent.mjs
```

Then, in the dashboard's **Impression** modal, set the agent URL
(default `http://127.0.0.1:9100`) — this setting lives in `localStorage`
(`etp-ql800-agent`) because it is specific to each workstation. The QL-800
button in the attendee table prints instantly, with the same rules as the
classic print (checked in + group assigned); on failure it falls back to the
classic print window.

Agent environment variables: `QL800_HOST` (`127.0.0.1`), `QL800_PORT`
(`9100`), `QL800_MODEL` (`QL-800`), `QL800_PRINTER` (`file:///dev/usb/lp0`),
`QL800_LABEL` (`62`). Pure logic (payload validation, CLI args) lives in
`server/ql800Print.mjs` and is unit-tested; the frontend pieces are
`src/services/badgeCanvas.ts`, `src/services/printAgentApi.ts` and
`src/types/ql800.ts`.

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
