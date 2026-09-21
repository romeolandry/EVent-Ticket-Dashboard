<script setup lang="ts">
import type { WpEvent } from '@/types/tickets'

defineProps<{
  events: WpEvent[]
  loading?: boolean
}>()

const emit = defineEmits<{
  select: [eventId: number]
}>()

function onChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  const eventId = Number(value)
  if (!Number.isNaN(eventId)) {
    emit('select', eventId)
  }
}
</script>

<template>
  <div class="event-selector">
    <label for="event-select">Événement</label>
    <select id="event-select" :disabled="loading" @change="onChange">
      <option value="" disabled selected>
        {{ loading ? 'Chargement des événements…' : 'Choisissez un événement' }}
      </option>
      <option v-for="event in events" :key="event.id" :value="event.id">
        {{ event.title }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.event-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 28rem;
}

select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 1rem;
}
</style>
