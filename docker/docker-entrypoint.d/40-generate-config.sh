#!/bin/sh
# Génère config.js à partir des variables d'environnement du conteneur.
set -eu

escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_WP_API_URL: "$(escape_js "${VITE_WP_API_URL:-}")",
  VITE_WP_AUTH_USER: "$(escape_js "${VITE_WP_AUTH_USER:-}")",
  VITE_WP_AUTH_PASSWORD: "$(escape_js "${VITE_WP_AUTH_PASSWORD:-}")"
};
EOF
