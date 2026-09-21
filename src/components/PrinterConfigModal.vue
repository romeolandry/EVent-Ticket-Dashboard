<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldLabel } from '@/services/fieldLabels'
import type { BadgeConfig } from '@/types/badge'

const props = defineProps<{
  config: BadgeConfig
  /** Titre de l'événement sélectionné (placeholder du champ titre). */
  eventTitle: string
  /** Clés des champs personnalisés présents sur les participants chargés. */
  availableFieldKeys: string[]
  /** Nombre de groupes de travail configurables. */
  groupCount: number
}>()

const emit = defineEmits<{
  save: [config: BadgeConfig]
  close: []
  groupCountChange: [count: number]
  autoAssign: []
}>()

const { t } = useI18n()

const draft = ref<BadgeConfig>({ ...props.config, fieldKeys: [...props.config.fieldKeys] })
watch(
  () => props.config,
  (config) => {
    draft.value = { ...config, fieldKeys: [...config.fieldKeys] }
  },
)

function toggleField(key: string, checked: boolean) {
  draft.value.fieldKeys = checked
    ? [...draft.value.fieldKeys, key]
    : draft.value.fieldKeys.filter((k) => k !== key)
}

function onGroupCountInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isFinite(value) && value >= 1) emit('groupCountChange', value)
}
</script>

<template>
  <div class="overlay" role="presentation" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="printer-config-title">
      <header class="modal-header">
        <h2 id="printer-config-title">{{ t('printer.title') }}</h2>
        <button
          type="button"
          class="close"
          :aria-label="t('printer.close')"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <section class="config-section">
        <h3>{{ t('printer.badgeFields') }}</h3>

        <label class="check-row">
          <input v-model="draft.showEventTitle" type="checkbox" />
          {{ t('printer.showEventTitle') }}
        </label>
        <div v-if="draft.showEventTitle" class="indent">
          <label class="field-label" for="badge-title">{{ t('printer.customTitle') }}</label>
          <input
            id="badge-title"
            v-model="draft.customTitle"
            type="text"
            class="text-input"
            :placeholder="eventTitle"
          />
        </div>

        <label class="check-row">
          <input v-model="draft.showEmail" type="checkbox" />
          {{ t('printer.showEmail') }}
        </label>
        <label class="check-row">
          <input v-model="draft.showTicket" type="checkbox" />
          {{ t('printer.showTicket') }}
        </label>
        <label class="check-row">
          <input v-model="draft.showGroup" type="checkbox" />
          {{ t('printer.showGroup') }}
        </label>

        <template v-if="availableFieldKeys.length > 0">
          <p class="sub">{{ t('printer.customFields') }}</p>
          <label v-for="key in availableFieldKeys" :key="key" class="check-row indent">
            <input
              type="checkbox"
              :checked="draft.fieldKeys.includes(key)"
              @change="toggleField(key, ($event.target as HTMLInputElement).checked)"
            />
            {{ fieldLabel(key, t) }}
          </label>
        </template>
      </section>

      <section class="config-section">
        <h3>{{ t('printer.groups') }}</h3>
        <div class="group-row">
          <label class="field-label" for="group-count">{{ t('printer.groupCount') }}</label>
          <input
            id="group-count"
            type="number"
            class="text-input number-input"
            min="1"
            :value="groupCount"
            @change="onGroupCountInput"
          />
          <button type="button" class="btn-secondary" @click="emit('autoAssign')">
            {{ t('printer.autoAssign') }}
          </button>
        </div>
        <p class="sub">{{ t('printer.groupHint') }}</p>
      </section>

      <footer class="actions-footer">
        <button type="button" class="btn-secondary" @click="emit('close')">
          {{ t('printer.cancel') }}
        </button>
        <button type="button" class="btn-primary" @click="emit('save', draft)">
          {{ t('printer.save') }}
        </button>
      </footer>
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
  max-width: 34rem;
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
}

.config-section + .config-section {
  margin-top: 1.5rem;
}

.config-section h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.3rem 0;
  cursor: pointer;
}

.indent {
  margin-left: 1.4rem;
}

.sub {
  font-size: 0.85rem;
  opacity: 0.6;
  margin: 0.6rem 0 0.25rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.text-input {
  width: 100%;
  margin-top: 0.3rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.9rem;
}

.number-input {
  width: 5rem;
  margin-top: 0;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.btn-primary {
  border: none;
  border-radius: 10px;
  padding: 0.6rem 1.2rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  cursor: pointer;
}

.btn-secondary {
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 0.55rem 1rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-accent);
  background: transparent;
  cursor: pointer;
}

.btn-secondary:hover {
  color: var(--color-accent-contrast);
  background: var(--color-accent);
}

.actions-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.75rem;
}
</style>
