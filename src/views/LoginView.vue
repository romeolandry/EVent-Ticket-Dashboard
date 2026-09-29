<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const errorKey = ref('')
const submitting = ref(false)

async function onSubmit() {
  errorKey.value = ''
  submitting.value = true
  try {
    await auth.login(email.value)
    router.push({ name: 'dashboard' })
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    errorKey.value =
      message === 'not_allowed'
        ? 'auth.denied'
        : message === 'invalid_email'
          ? 'auth.invalid'
          : 'auth.error'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <form class="login-card" @submit.prevent="onSubmit">
      <h1>{{ t('auth.title') }}</h1>
      <p class="subtitle">{{ t('auth.subtitle') }}</p>

      <label for="login-email">{{ t('auth.emailLabel') }}</label>
      <input
        id="login-email"
        v-model="email"
        type="email"
        required
        autocomplete="email"
        autofocus
        :placeholder="t('auth.emailPlaceholder')"
      />

      <p v-if="errorKey" class="error" role="alert">{{ t(errorKey) }}</p>

      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? t('auth.submitting') : t('auth.submit') }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: 100%;
  max-width: 26rem;
  padding: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-background-soft);
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
}

h1 {
  font-size: 1.4rem;
}

.subtitle {
  font-size: 0.92rem;
  opacity: 0.65;
}

label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

input {
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.95rem;
}

input:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

.btn-primary {
  margin-top: 0.4rem;
  border: none;
  border-radius: 10px;
  padding: 0.75rem;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: wait;
}

.error {
  padding: 0.6rem 0.85rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, #dc2626 40%, transparent);
  background: color-mix(in srgb, #dc2626 8%, transparent);
  color: #dc2626;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .login-page {
    padding: 1rem;
  }

  .login-card {
    padding: 1.5rem;
  }

  input {
    font-size: 1rem;
  }
}
</style>
