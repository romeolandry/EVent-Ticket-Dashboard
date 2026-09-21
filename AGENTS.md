# Event Ticket Plus — Dashboard

Application Vue 3 + Composition API + TypeScript + Pinia (Vite) pour visualiser
les participants d'événements issus d'un site WordPress (The Events Calendar /
Event Tickets Plus).

## Commandes

- `npm run dev` : serveur de développement
- `npm run test:unit -- run` : tests Vitest
- `npm run lint` : oxlint + eslint (avec --fix)
- `npm run build` : type-check (vue-tsc) + build Vite
- `npm run format` : Prettier

## Configuration

- Copier `.env.example` en `.env` et renseigner `VITE_WP_API_URL`
  (URL du site WordPress, sans slash final).
- Authentification Basic optionnelle : `VITE_WP_AUTH_USER` et
  `VITE_WP_AUTH_PASSWORD` (mot de passe applicatif WordPress). Si définis,
  un en-tête `Authorization: Basic …` est ajouté à chaque requête API.
- API consommées : `/wp-json/tribe/events/v1/events` et
  `/wp-json/tribe/tickets/v1/attendees?event=<id>`.

## Spécificités de l'environnement

- IPv6 cassée vers registry.npmjs.org : préfixer les commandes npm avec
  `NODE_OPTIONS=--dns-result-order=ipv4first`.
- npm 10.9.8 échoue avec « edgesOut » sur ce projet :
  utiliser `npm install --legacy-peer-deps`.
