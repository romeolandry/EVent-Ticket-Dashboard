<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type AppLocale } from '@/i18n'

const { t, locale } = useI18n()

function onLocaleChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as AppLocale)
}
</script>

<template>
  <header>
    <span class="badge-logo">ET+</span>
    <div class="brand">
      <span class="title">{{ t('app.title') }}</span>
      <span class="tagline">{{ t('app.tagline') }}</span>
    </div>
    <select
      class="lang-select"
      :value="locale"
      :aria-label="t('language.label')"
      @change="onLocaleChange"
    >
      <option v-for="lang in SUPPORTED_LOCALES" :key="lang" :value="lang">
        {{ lang.toUpperCase() }}
      </option>
    </select>
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

.lang-select {
  margin-left: auto;
  appearance: none;
  padding: 0.35rem 1.8rem 0.35rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right 0.6rem center;
  color: var(--color-text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.lang-select:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}
</style>
