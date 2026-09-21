<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Attendee } from '@/types/tickets'
import { arrivalStats, childrenStats } from '@/services/attendeeStats'

const { t } = useI18n()

const props = defineProps<{
  attendees: Attendee[]
}>()

const emit = defineEmits<{
  close: []
}>()

const children = computed(() => childrenStats(props.attendees))
const arrivals = computed(() => arrivalStats(props.attendees))
const maxAgeCount = computed(() => Math.max(1, ...children.value.byAge.map((a) => a.count)))
const maxArrivalCount = computed(() => Math.max(1, ...arrivals.value.map((a) => a.count)))

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="overlay" role="presentation" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="stats-title">
      <header class="modal-header">
        <h2 id="stats-title">{{ t('stats.title') }}</h2>
        <button
          type="button"
          class="close"
          :aria-label="t('stats.close')"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <section class="stat">
        <h3>{{ t('stats.childrenTitle') }}</h3>
        <p v-if="children.total === 0" class="empty">{{ t('stats.noChildren') }}</p>
        <template v-else>
          <ul class="bars">
            <li v-for="row in children.byAge" :key="row.age" class="bar-row">
              <span class="bar-label">
                {{ t('stats.yearsOld', { age: row.age, s: row.age === '1' ? '' : 's' }) }}
              </span>
              <span class="bar-track">
                <span class="bar-fill" :style="{ width: `${(row.count / maxAgeCount) * 100}%` }" />
              </span>
              <span class="bar-count">{{ row.count }}</span>
            </li>
            <li v-if="children.unknown > 0" class="bar-row muted">
              <span class="bar-label">{{ t('stats.unknownAge') }}</span>
              <span class="bar-track">
                <span
                  class="bar-fill"
                  :style="{ width: `${(children.unknown / maxAgeCount) * 100}%` }"
                />
              </span>
              <span class="bar-count">{{ children.unknown }}</span>
            </li>
          </ul>
          <p class="total">{{ t('stats.totalChildren', { count: children.total }) }}</p>
        </template>
      </section>

      <section class="stat">
        <h3>
          {{ t('stats.arrivalTitle') }} <span class="hint">{{ t('stats.arrivalHint') }}</span>
        </h3>
        <p v-if="arrivals.length === 0" class="empty">{{ t('stats.noArrivals') }}</p>
        <ul v-else class="bars">
          <li v-for="row in arrivals" :key="row.label" class="bar-row">
            <span class="bar-label">{{ row.label }}</span>
            <span class="bar-track">
              <span class="bar-fill" :style="{ width: `${(row.count / maxArrivalCount) * 100}%` }" />
            </span>
            <span class="bar-count">{{ row.count }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 40rem;
  max-height: 85vh;
  overflow-y: auto;
  padding: 1.75rem 2rem;
  border-radius: 16px;
  background: var(--color-background);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.modal-header h2 {
  font-size: 1.25rem;
}

.close {
  border: none;
  background: var(--color-background-mute);
  color: var(--color-text);
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  transition: background 0.2s;
}

.close:hover {
  background: var(--color-border-hover);
}

.stat + .stat {
  margin-top: 1.75rem;
}

.stat h3 {
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.hint {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--color-text);
  opacity: 0.6;
}

.empty {
  opacity: 0.6;
}

.bars {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(10rem, 14rem) 1fr 2.5rem;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.bar-row.muted {
  opacity: 0.65;
}

.bar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  height: 0.65rem;
  border-radius: 999px;
  background: var(--color-background-mute);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-soft));
}

.bar-count {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.total {
  margin-top: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>
