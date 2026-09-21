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
FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/docker-entrypoint.d/40-generate-config.sh /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh

EXPOSE 80
# Les variables VITE_WP_* sont injectées dans /usr/share/nginx/html/config.js
# au démarrage du conteneur (pas de secret figé dans l'image).
