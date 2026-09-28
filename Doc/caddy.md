# Caddy as a reverse proxy

Documentation for exposing the **Event Ticket Plus Dashboard** application
(Docker container listening on port `8080`, published on the host via
`${PORT:-8080}`) behind [Caddy](https://caddyserver.com/), which provides
automatic HTTPS (Let's Encrypt) and TLS termination.

## Overview

```
Browser ──HTTPS──▶ Caddy (443) ──HTTP──▶ 127.0.0.1:8080 ──▶ container
```

- Caddy listens on 80/443 and manages TLS certificates automatically.
- The application container does **not need to be publicly exposed**:
  the port should only be reachable from the host (or from the shared
  Docker network if Caddy itself is containerized).

## Case 1: Caddy installed on the host (systemd)

### 1. Bind the container port to localhost only

In `docker-compose.yml`, bind the port to `127.0.0.1` only, to avoid
direct exposure on all interfaces:

```yaml
ports:
  - '127.0.0.1:${PORT:-8080}:8080'
```

Then restart:

```bash
docker compose up -d
```

### 2. Minimal Caddyfile (`/etc/caddy/Caddyfile`)

```caddy
dashboard.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

Caddy obtains and renews the certificate automatically (the domain must
point to the server and ports 80/443 must be open).

### 3. Reload Caddy

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile   # optional: formatting
sudo systemctl reload caddy
```

### 4. Verification

```bash
curl -I https://dashboard.example.com/healthz
# expected: HTTP/2 200
```

## Case 2: Caddy in Docker (same compose stack)

Add a `caddy` service to the project. Both containers communicate
through the internal network: target the service name (`dashboard:8080`)
and the host port is no longer published at all.

```yaml
services:
  dashboard:
    build: .
    container_name: eventticketplus-dashboard
    # no "ports" section: unreachable from outside
    environment:
      WP_API_URL: ${WP_API_URL:-${VITE_WP_API_URL:-}}
      WP_AUTH_USER: ${WP_AUTH_USER:-${VITE_WP_AUTH_USER:-}}
      WP_AUTH_PASSWORD: ${WP_AUTH_PASSWORD:-${VITE_WP_AUTH_PASSWORD:-}}
      SUPERUSER_EMAIL: ${SUPERUSER_EMAIL:-}
    volumes:
      - etp-data:/data
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:8080/healthz']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    container_name: eventticketplus-caddy
    ports:
      - '80:80'
      - '443:443'
      - '443:443/udp'   # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      dashboard:
        condition: service_healthy
    restart: unless-stopped

volumes:
  etp-data:
  caddy-data:
  caddy-config:
```

`Caddyfile` at the project root:

```caddy
dashboard.example.com {
	reverse_proxy dashboard:8080
}
```

```bash
docker compose up -d --build
```

> Do not commit certificates or keys: they live in the `caddy-data`
> volume (back it up along with `etp-data`).

## Useful Caddyfile options

```caddy
dashboard.example.com {
	reverse_proxy dashboard:8080 {
		# Mirror the Docker healthcheck on the Caddy side (optional)
		health_uri /healthz
		health_interval 10s
	}

	# Security headers
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		X-Frame-Options "DENY"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	# Compression
	encode gzip zstd

	# Access logs (volume or stdout)
	log {
		output stdout
		format console
	}
}
```

## Local / self-signed HTTPS (testing on LAN or by IP)

Without a public domain name, two options:

```caddy
# Caddy's internal CA: self-signed certificate (browser warning)
https://192.168.1.10 {
	tls internal
	reverse_proxy 127.0.0.1:8080
}
```

```caddy
# Plain HTTP on port 80 (trusted network only)
:80 {
	reverse_proxy 127.0.0.1:8080
}
```

## Things to watch out for

- **`X-Forwarded-*` headers**: Caddy sets them automatically, so the
  application's Node server (`server/index.mjs`) receives the original
  client IP and scheme.
- **`/api/auth` and `/wp-api/*`** go through the proxy like everything
  else: no special rules are needed since the application is
  monolithic (SPA + API on the same port).
- **Session cookies**: served exclusively over HTTPS behind Caddy,
  they can be marked `Secure` without breaking access.
- **TLS renewal**: automatic; the domain must remain reachable for the
  HTTP-01 challenge (port 80 open) or use the DNS challenge
  (`tls { dns … }` with your provider's plugin).
- **Never expose** the `/data` volume (`allowed-emails.json`): it is
  not served by any endpoint anyway.

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| 502 Bad Gateway | The `dashboard` container is not healthy / wrong port in the Caddyfile |
| Certificate not issued | Ports 80/443 blocked (firewall) or DNS does not point to the server |
| Redirect loop | The app does not force HTTPS itself: check for duplicate TLS config |
| Healthcheck failing | `docker compose ps` then `docker compose logs dashboard` |

```bash
# Caddy logs (systemd)
journalctl -u caddy -f

# Caddy logs (docker)
docker compose logs -f caddy
```
