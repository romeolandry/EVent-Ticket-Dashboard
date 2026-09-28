<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useNotificationsStore } from '@/stores/notifications'

const { t } = useI18n()
const notificationsStore = useNotificationsStore()
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <div v-for="notif in notificationsStore.notifications" :key="notif.id" class="toast">
      <span class="message">{{ notif.message }}</span>
      <button
        type="button"
        class="dismiss"
        :aria-label="t('notify.dismiss')"
        @click="notificationsStore.dismiss(notif.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(24rem, calc(100vw - 2.5rem));
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.85rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.message {
  flex: 1;
}

.dismiss {
  border: none;
  background: none;
  cursor: pointer;
  color: var(--color-text);
  opacity: 0.5;
  font-size: 0.8rem;
  line-height: 1;
  padding: 0.15rem;
}

.dismiss:hover {
  opacity: 1;
  color: var(--color-accent);
}
</style>
