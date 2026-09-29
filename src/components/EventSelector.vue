<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { WpEvent } from '@/types/tickets'

const { t } = useI18n()

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
    <label for="event-select">{{ t('events.label') }}</label>
    <select id="event-select" :disabled="loading" @change="onChange">
      <option value="" disabled selected>
        {{ loading ? t('events.loading') : t('events.placeholder') }}
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

label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

select {
  appearance: none;
  padding: 0.65rem 2.5rem 0.65rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background-soft)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right 0.9rem center;
  color: var(--color-text);
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

select:hover:not(:disabled) {
  border-color: var(--color-border-hover);
}

select:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

select:disabled {
  opacity: 0.55;
  cursor: wait;
}

@media (max-width: 640px) {
  .event-selector {
    max-width: none;
  }

  select {
    font-size: 1rem;
  }
}
</style>
