<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldLabel } from '@/services/fieldLabels'
import { pingPrintAgent } from '@/services/printAgentApi'
import type { BadgeConfig } from '@/types/badge'
import type { Ql800Config } from '@/types/ql800'

const props = defineProps<{
  config: BadgeConfig
  /** Config de l'agent local QL-800 (propre au poste). */
  ql800Config: Ql800Config
  /** Titre de l'événement sélectionné (placeholder du champ titre). */
  eventTitle: string
  /** Clés des champs personnalisés présents sur les participants chargés. */
  availableFieldKeys: string[]
  /** Nombre de groupes de travail configurables. */
  groupCount: number
  /** Emails exclus de la répartition automatique (pour cet événement). */
  excludedEmails: string[]
  /** Emails des participants chargés (suggestions de l'autocomplete). */
  attendeeEmails: string[]
}>()

const emit = defineEmits<{
  save: [config: BadgeConfig]
  saveQl800: [config: Ql800Config]
  close: []
  groupCountChange: [count: number]
  autoAssign: []
  addExclusion: [email: string]
  removeExclusion: [email: string]
}>()

const exclusionInput = ref('')

function onAddExclusion() {
  const email = exclusionInput.value.trim()
  if (!email) return
  emit('addExclusion', email)
  exclusionInput.value = ''
}

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

const ql800Draft = ref<Ql800Config>({ ...props.ql800Config })
watch(
  () => props.ql800Config,
  (config) => {
    ql800Draft.value = { ...config }
  },
)

const ql800Testing = ref(false)
const ql800TestMessage = ref('')

async function testQl800Agent() {
  ql800Testing.value = true
  ql800TestMessage.value = ''
  try {
    const status = await pingPrintAgent(ql800Draft.value.agentUrl)
    ql800TestMessage.value = status.brotherQl
      ? t('printer.ql800TestOk', { model: status.model ?? 'QL-800', label: status.label ?? '62' })
      : t('printer.ql800TestNoCli')
  } catch {
    ql800TestMessage.value = t('printer.ql800TestKo')
  } finally {
    ql800Testing.value = false
  }
}

function onSave() {
  // config BadgeConfig (partagée) + config agent QL-800 (locale au poste)
  emit('saveQl800', { ...ql800Draft.value })
  emit('save', draft.value)
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
        <label class="check-row">
          <input v-model="draft.showLogo" type="checkbox" />
          {{ t('printer.showLogo') }}
        </label>

        <p class="sub">{{ t('printer.colorMode') }}</p>
        <label class="check-row indent">
          <input v-model="draft.colorMode" type="radio" value="color" name="color-mode" />
          {{ t('printer.colorColor') }}
        </label>
        <label class="check-row indent">
          <input v-model="draft.colorMode" type="radio" value="bw" name="color-mode" />
          {{ t('printer.colorBw') }}
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

        <p class="sub section-gap">{{ t('printer.excludedTitle') }}</p>
        <div class="group-row">
          <input
            id="excluded-email"
            v-model="exclusionInput"
            type="email"
            list="attendee-emails"
            class="text-input exclusion-input"
            :placeholder="t('printer.excludedPlaceholder')"
            :aria-label="t('printer.excludedTitle')"
            @keydown.enter.prevent="onAddExclusion"
          />
          <datalist id="attendee-emails">
            <option
              v-for="email in attendeeEmails"
              :key="email"
              :value="email"
            />
          </datalist>
          <button type="button" class="btn-secondary" @click="onAddExclusion">
            {{ t('printer.addExcluded') }}
          </button>
        </div>
        <ul v-if="excludedEmails.length > 0" class="exclusion-list">
          <li v-for="email in excludedEmails" :key="email" class="exclusion-item">
            <span class="exclusion-email">{{ email }}</span>
            <button
              type="button"
              class="exclusion-remove"
              :aria-label="t('printer.removeExcluded', { email })"
              @click="emit('removeExclusion', email)"
            >
              ✕
            </button>
          </li>
        </ul>
        <p v-else class="sub">{{ t('printer.excludedEmpty') }}</p>
      </section>

      <section class="config-section">
        <h3>{{ t('printer.ql800Section') }}</h3>
        <label class="field-label" for="ql800-agent-url">
          {{ t('printer.ql800AgentLabel') }}
        </label>
        <div class="group-row">
          <input
            id="ql800-agent-url"
            v-model="ql800Draft.agentUrl"
            type="url"
            class="text-input exclusion-input"
            placeholder="http://127.0.0.1:9100"
          />
          <button
            type="button"
            class="btn-secondary"
            :disabled="ql800Testing"
            @click="testQl800Agent"
          >
            {{ ql800Testing ? t('printer.ql800Testing') : t('printer.ql800Test') }}
          </button>
        </div>
        <p v-if="ql800TestMessage" class="sub" role="status">{{ ql800TestMessage }}</p>
        <p class="sub">{{ t('printer.ql800Hint') }}</p>
      </section>

      <footer class="actions-footer">
        <button type="button" class="btn-secondary" @click="emit('close')">
          {{ t('printer.cancel') }}
        </button>
        <button type="button" class="btn-primary" @click="onSave">
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
  max-height: 85dvh;
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
  flex-wrap: wrap;
}

.section-gap {
  margin-top: 1.1rem;
}

.exclusion-input {
  flex: 1;
  margin-top: 0;
}

.exclusion-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.7rem;
}

.exclusion-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-background-mute);
  font-size: 0.82rem;
}

.exclusion-email {
  overflow-wrap: anywhere;
}

.exclusion-remove {
  border: none;
  background: none;
  padding: 0.1rem;
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.55;
  font-size: 0.75rem;
  line-height: 1;
}

.exclusion-remove:hover {
  opacity: 1;
  color: var(--color-accent);
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

@media (max-width: 640px) {
  .overlay {
    padding: 0.5rem;
  }

  .modal {
    padding: 1.25rem 1rem;
    border-radius: 12px;
    max-height: 92vh;
    max-height: 92dvh;
  }

  .text-input {
    font-size: 1rem;
  }

  .group-row {
    gap: 0.6rem;
  }

  .exclusion-input {
    flex: 1 1 100%;
  }

  .indent {
    margin-left: 0.9rem;
  }
}
</style>
