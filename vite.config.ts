import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  // En dev : le serveur Node tourne sur le port 8890
  // (DATA_DIR=/tmp/etp-data SUPERUSER_EMAIL=… node server/index.mjs)
  server: {
    proxy: {
      '/api': 'http://localhost:8890',
      '/wp-api': 'http://localhost:8890',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
