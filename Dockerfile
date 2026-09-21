# ---- Build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps : nécessaire avec npm 10.9.8 sur ce projet (voir AGENTS.md)
ENV NODE_OPTIONS=--dns-result-order=ipv4first
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# ---- Production ----
# Node : sert la SPA + l'API d'authentification (liste d'emails hors racine web)
FROM node:22-alpine
WORKDIR /app

COPY --from=build /app/dist ./dist
COPY server ./server

ENV PORT=8080 \
    DATA_DIR=/data

# SUPERUSER_EMAIL / VITE_WP_* : à fournir au runtime (jamais dans l'image).
# /data : volume contenant allowed-emails.json (fichier inaccessible via HTTP).
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8080

USER node
CMD ["node", "server/index.mjs"]
