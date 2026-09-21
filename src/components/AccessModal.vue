<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAccessList, saveAccessList } from '@/services/authApi'

const props = defineProps<{
  token: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const emails = ref<string[]>([])
const newEmail = ref('')
const loading = ref(true)
const saving = ref(false)
const status = ref<{ kind: 'error' | 'ok'; message: string } | null>(null)

onMounted(async () => {
  try {
    emails.value = (await fetchAccessList(props.token)).emails
  } catch {
    status.value = { kind: 'error', message: t('access.loadError') }
  } finally {
    loading.value = false
  }
})

function addEmail() {
  const value = newEmail.value.trim().toLowerCase()
  if (!value) return
  if (!emails.value.includes(value)) emails.value = [...emails.value, value]
  newEmail.value = ''
}

function removeEmail(email: string) {
  emails.value = emails.value.filter((e) => e !== email)
}

async function save() {
  saving.value = true
  status.value = null
  try {
    emails.value = (await saveAccessList(props.token, emails.value)).emails
    status.value = { kind: 'ok', message: t('access.saved') }
  } catch (e) {
    status.value = {
      kind: 'error',
      message: e instanceof Error && e.message === 'invalid_emails'
        ? t('access.invalid')
        : t('access.saveError'),
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="overlay" role="presentation" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="access-title">
      <header class="modal-header">
        <h2 id="access-title">{{ t('access.title') }}</h2>
        <button
          type="button"
          class="close"
          :aria-label="t('access.close')"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <p class="intro">{{ t('access.intro') }}</p>

      <p v-if="loading" class="state">{{ t('table.loading') }}</p>
      <template v-else>
        <p v-if="emails.length === 0" class="state">{{ t('access.empty') }}</p>
        <ul v-else class="email-list">
          <li v-for="email in emails" :key="email" class="email-row">
            <span>{{ email }}</span>
            <button
              type="button"
              class="btn-remove"
              :aria-label="`${t('access.remove')} ${email}`"
              @click="removeEmail(email)"
            >
              {{ t('access.remove') }}
            </button>
          </li>
        </ul>

        <form class="add-row" @submit.prevent="addEmail">
          <input
            v-model="newEmail"
            type="email"
            class="add-input"
            :placeholder="t('access.addPlaceholder')"
            :aria-label="t('access.addPlaceholder')"
          />
          <button type="submit" class="btn-secondary">{{ t('access.add') }}</button>
        </form>

        <p v-if="status" class="status" :class="status.kind" role="status">
          {{ status.message }}
        </p>

        <footer class="actions-footer">
          <button type="button" class="btn-secondary" @click="emit('close')">
            {{ t('access.close') }}
          </button>
          <button type="button" class="btn-primary" :disabled="saving" @click="save">
            {{ saving ? t('access.saving') : t('access.save') }}
          </button>
        </footer>
      </template>
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
  max-width: 32rem;
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
  margin-bottom: 1rem;
}

.modal-header h2 {
  font-size: 1.25rem;
}

.close {
  border: none;
  background: var(--color-background-mute);
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  cursor: pointer;
}

.intro {
  font-size: 0.88rem;
  opacity: 0.65;
  margin-bottom: 1rem;
}

.state {
  opacity: 0.6;
}

.email-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.email-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  font-size: 0.9rem;
}

.btn-remove {
  border: none;
  background: none;
  color: #dc2626;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.add-row {
  display: flex;
  gap: 0.6rem;
  margin-top: 1rem;
}

.add-input {
  flex: 1;
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.9rem;
}

.status {
  margin-top: 0.9rem;
  font-size: 0.88rem;
}

.status.ok {
  color: #15803d;
}

.status.error {
  color: #dc2626;
}

.actions-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-primary {
  border: none;
  border-radius: 10px;
  padding: 0.6rem 1.2rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: wait;
}

.btn-secondary {
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 0.55rem 1rem;
  font-weight: 600;
  color: var(--color-accent);
  background: transparent;
  cursor: pointer;
}
</style>
