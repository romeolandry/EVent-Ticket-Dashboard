<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <header>
    <span class="badge-logo">ET+</span>
    <div class="brand">
      <span class="title">Event Ticket Plus</span>
      <span class="tagline">Tableau de bord des participants</span>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 2rem;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-background) 85%, transparent);
  backdrop-filter: blur(10px);
}

.badge-logo {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-accent-contrast);
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-soft));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent) 35%, transparent);
}

.brand {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.title {
  font-size: 1.05rem;
  font-weight: 600;
}

.tagline {
  font-size: 0.75rem;
  color: var(--color-text);
  opacity: 0.6;
}
</style>
