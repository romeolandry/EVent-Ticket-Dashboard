<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <header>
    <span class="title">Event Ticket Plus</span>
  </header>

  <RouterView />
</template>

<style scoped>
header {
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-border);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
}
</style>
