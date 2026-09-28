<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import EventSelector from '@/components/EventSelector.vue'
import AttendeeTable from '@/components/AttendeeTable.vue'
import StatsModal from '@/components/StatsModal.vue'
import PrinterConfigModal from '@/components/PrinterConfigModal.vue'
import { useEventsStore } from '@/stores/events'
import { useAttendeesStore } from '@/stores/attendees'
import { useNotificationsStore } from '@/stores/notifications'
import { arrivalDay } from '@/services/attendeeStats'
import { attendeesToCsv } from '@/services/csvExport'
import { fieldLabel } from '@/services/fieldLabels'
import {
  loadBadgeConfig,
  saveBadgeConfig,
  type BadgeConfig,
} from '@/types/badge'
import { useI18n } from 'vue-i18n'
import type { Attendee } from '@/types/tickets'

const { t } = useI18n()

const eventsStore = useEventsStore()
const attendeesStore = useAttendeesStore()
const notifications = useNotificationsStore()
const { events, isLoading: eventsLoading, error: eventsError } = storeToRefs(eventsStore)
const {
  attendees,
  isLoading: attendeesLoading,
  error: attendeesError,
  pendingActionId,
  groupMap,
  groupCount,
} = storeToRefs(attendeesStore)

const showStats = ref(false)
const showPrinterConfig = ref(false)
const badgeConfig = ref<BadgeConfig>(loadBadgeConfig())
const nameFilter = ref('')
const arrivalFilter = ref('')
const groupFilter = ref('')
const checkInFilter = ref('')
const checkedInCount = computed(() => attendees.value.filter((a) => a.checkedIn).length)
const arrivalOptions = computed(() =>
  [...new Set(attendees.value.map(arrivalDay).filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b),
  ),
)
const groupOptions = computed(() => Array.from({ length: groupCount.value }, (_, i) => i + 1))
const availableFieldKeys = computed(() => [
  ...new Set(attendees.value.flatMap((a) => Object.keys(a.fields))),
])
const filteredAttendees = computed(() => {
  const query = nameFilter.value.trim().toLowerCase()
  return attendees.value.filter((a) => {
    if (query && !a.name.toLowerCase().includes(query)) return false
    if (arrivalFilter.value && arrivalDay(a) !== arrivalFilter.value) return false
    if (groupFilter.value && String(groupMap.value[a.id] ?? '') !== groupFilter.value)
      return false
    if (checkInFilter.value === 'yes' && !a.checkedIn) return false
    if (checkInFilter.value === 'no' && a.checkedIn) return false
    return true
  })
})

const PAGE_SIZE = 25
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filteredAttendees.value.length / PAGE_SIZE)))
const pagedAttendees = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredAttendees.value.slice(start, start + PAGE_SIZE)
})

watch([nameFilter, arrivalFilter, groupFilter, checkInFilter], () => (page.value = 1))
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

onMounted(() => {
  eventsStore.loadEvents()
})

function onEventSelect(eventId: number) {
  showStats.value = false
  showPrinterConfig.value = false
  nameFilter.value = ''
  arrivalFilter.value = ''
  groupFilter.value = ''
  checkInFilter.value = ''
  page.value = 1
  attendeesStore.loadAttendees(eventId)
}

function onSavePrinterConfig(config: BadgeConfig) {
  badgeConfig.value = config
  saveBadgeConfig(config)
  showPrinterConfig.value = false
}

function onSetGroup(attendeeId: number, group: number | null) {
  attendeesStore.setGroup(attendeeId, group)
  const name = attendees.value.find((a) => a.id === attendeeId)?.name ?? String(attendeeId)
  notifications.notify(
    group == null
      ? t('notify.groupRemoved', { name })
      : t('notify.groupAssigned', { name, n: group }),
  )
}

function onGroupCountChange(count: number) {
  attendeesStore.setGroupCount(count)
  notifications.notify(t('notify.groupCountChanged', { count: groupCount.value }))
}

function onAutoAssignGroups() {
  attendeesStore.autoAssignGroups()
  notifications.notify(
    t('notify.groupsAutoAssigned', { count: groupCount.value, s: groupCount.value > 1 ? 's' : '' }),
  )
}

function exportCsv() {
  if (attendees.value.length === 0) return
  const blob = new Blob(
    [
      attendeesToCsv(attendees.value, {
        name: t('csv.name'),
        email: t('csv.email'),
        ticket: t('csv.ticket'),
        present: t('csv.present'),
        yes: t('csv.yes'),
        no: t('csv.no'),
      },
      (key) => fieldLabel(key, t)),
    ],
    { type: 'text/csv;charset=utf-8' },
  )
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `participants-evenement-${attendeesStore.selectedEventId}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function printBadge(attendee: Attendee) {
  const config = badgeConfig.value
  const eventTitle =
    config.customTitle.trim() ||
    (events.value.find((e) => e.id === attendeesStore.selectedEventId)?.title ?? '')
  const group = groupMap.value[attendee.id]
  const iconUrl = new URL(`${import.meta.env.BASE_URL}favicon.png`, window.location.origin).href
  const bw = config.colorMode === 'bw'

  const lines: string[] = []
  if (config.showLogo) {
    lines.push(`<img class="logo" src="${iconUrl}" alt="">`)
  }
  if (config.showEventTitle && eventTitle) {
    lines.push(`<p class="event">${escapeHtml(eventTitle)}</p>`)
  }
  lines.push(`<p class="name">${escapeHtml(attendee.name)}</p>`)
  if (config.showGroup && group != null) {
    lines.push(`<p class="group">${escapeHtml(t('badge.group', { n: group }))}</p>`)
  }
  if (config.showTicket && attendee.ticket) {
    lines.push(`<p class="ticket">${escapeHtml(attendee.ticket)}</p>`)
  }
  if (config.showEmail && attendee.email) {
    lines.push(`<p class="email">${escapeHtml(attendee.email)}</p>`)
  }
  for (const key of config.fieldKeys) {
    const value = attendee.fields[key]
    if (value) {
      lines.push(
        `<p class="custom"><strong>${escapeHtml(fieldLabel(key, t))}</strong> : ${escapeHtml(value)}</p>`,
      )
    }
  }

  const win = window.open('', '_blank', 'width=420,height=600')
  if (!win) return
  win.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(t('badge.title', { name: attendee.name }))}</title>
<link rel="icon" type="image/png" href="${iconUrl}">
<link rel="apple-touch-icon" href="${iconUrl}">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; }
  .badge { border: 2px solid #333; border-radius: 16px; padding: 24px; width: 340px; }
  .logo { width: 48px; height: 48px; object-fit: contain; margin-bottom: 12px; }
  .event { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 16px; }
  .name { font-size: 28px; font-weight: 700; margin: 0 0 8px; }
  .group { display: inline-block; font-size: 14px; font-weight: 700; color: #fff; background: #4f46e5; border-radius: 999px; padding: 2px 12px; margin: 0 0 8px; }
  .ticket { font-size: 16px; color: #4f46e5; font-weight: 600; margin: 0 0 4px; }
  .email { font-size: 13px; color: #666; margin: 0 0 10px; }
  .custom { font-size: 13px; margin: 0 0 4px; }
  ${bw ? `
  .badge { border-color: #000; }
  .logo { filter: grayscale(1); }
  .event, .email { color: #000; }
  .ticket { color: #000; }
  .group { background: #000; color: #fff; }
  ` : ''}
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="badge">
    ${lines.join('\n    ')}
  </div>
</body>
</html>`)
  win.document.close()
  win.addEventListener('load', () => {
    win.focus()
    win.print()
  })
}
</script>

<template>
  <main class="dashboard">
    <div class="dashboard-header">
      <div>
        <h1>{{ t('dashboard.title') }}</h1>
        <p class="subtitle">{{ t('dashboard.subtitle') }}</p>
      </div>
      <div v-if="attendeesStore.selectedEventId != null" class="header-actions">
        <button type="button" class="btn-secondary-plain" @click="showPrinterConfig = true">
          {{ t('dashboard.printerConfig') }}
        </button>
        <button
          type="button"
          class="btn-primary"
          :disabled="attendeesLoading || attendees.length === 0"
          @click="showStats = true"
        >
          {{ t('dashboard.stats') }}
        </button>
      </div>
    </div>

    <EventSelector :events="events" :loading="eventsLoading" @select="onEventSelect" />
    <p v-if="eventsError" class="error" role="alert">{{ eventsError }}</p>

    <section v-if="attendeesStore.selectedEventId != null" class="attendees">
      <div v-if="!attendeesLoading && attendees.length > 0" class="summary">
        <div class="chip">
          <span class="chip-value">{{ attendees.length }}</span>
          <span class="chip-label">{{ t('dashboard.registered') }}</span>
        </div>
        <div class="chip">
          <span class="chip-value">{{ checkedInCount }}</span>
          <span class="chip-label">{{ t('dashboard.checkedIn') }}</span>
        </div>
      </div>

      <div v-if="!attendeesLoading && attendees.length > 0" class="toolbar">
        <input
          v-model="nameFilter"
          type="search"
          class="search-input"
          :placeholder="t('dashboard.nameFilterPlaceholder')"
          :aria-label="t('dashboard.nameFilterAria')"
        />
        <select
          v-if="arrivalOptions.length > 0"
          v-model="arrivalFilter"
          class="filter-select"
          :aria-label="t('dashboard.arrivalFilterAria')"
        >
          <option value="">{{ t('dashboard.arrivalFilterAll') }}</option>
          <option v-for="option in arrivalOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
        <select
          v-model="groupFilter"
          class="filter-select"
          :aria-label="t('dashboard.groupFilterAria')"
        >
          <option value="">{{ t('dashboard.groupFilterAll') }}</option>
          <option v-for="n in groupOptions" :key="n" :value="String(n)">
            {{ t('dashboard.groupOption', { n }) }}
          </option>
        </select>
        <select
          v-model="checkInFilter"
          class="filter-select"
          :aria-label="t('dashboard.checkInFilterAria')"
        >
          <option value="">{{ t('dashboard.checkInFilterAll') }}</option>
          <option value="yes">{{ t('dashboard.checkInFilterYes') }}</option>
          <option value="no">{{ t('dashboard.checkInFilterNo') }}</option>
        </select>
        <span
          v-if="nameFilter.trim() || arrivalFilter || groupFilter || checkInFilter"
          class="filter-count"
        >
          {{
            t('dashboard.resultCount', {
              shown: filteredAttendees.length,
              total: attendees.length,
            })
          }}
        </span>
        <button type="button" class="btn-secondary" @click="exportCsv">
          {{ t('dashboard.exportCsv') }}
        </button>
      </div>

      <AttendeeTable
        :attendees="pagedAttendees"
        :columns-of="filteredAttendees"
        :loading="attendeesLoading"
        :pending-action-id="pendingActionId"
        :groups="groupMap"
        :group-count="groupCount"
        @check-in="attendeesStore.updateCheckIn($event, true)"
        @check-out="attendeesStore.updateCheckIn($event, false)"
        @print="printBadge"
        @set-group="onSetGroup"
      />
      <nav
        v-if="!attendeesLoading && pageCount > 1"
        class="pagination"
        :aria-label="t('pagination.label')"
      >
        <button
          type="button"
          class="page-btn"
          :disabled="page === 1"
          @click="page--"
        >
          {{ t('pagination.previous') }}
        </button>
        <span class="page-info">
          {{
            t('pagination.info', {
              page,
              pages: pageCount,
              total: filteredAttendees.length,
            })
          }}
        </span>
        <button
          type="button"
          class="page-btn"
          :disabled="page === pageCount"
          @click="page++"
        >
          {{ t('pagination.next') }}
        </button>
      </nav>
      <p v-if="attendeesError" class="error" role="alert">{{ attendeesError }}</p>
    </section>

    <PrinterConfigModal
      v-if="showPrinterConfig"
      :config="badgeConfig"
      :event-title="
        events.find((e) => e.id === attendeesStore.selectedEventId)?.title ?? ''
      "
      :available-field-keys="availableFieldKeys"
      :group-count="groupCount"
      @save="onSavePrinterConfig"
      @close="showPrinterConfig = false"
      @group-count-change="onGroupCountChange"
      @auto-assign="onAutoAssignGroups"
    />

    <StatsModal v-if="showStats" :attendees="attendees" @close="showStats = false" />
  </main>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

h1 {
  font-size: 1.75rem;
  line-height: 1.2;
}

.subtitle {
  color: var(--color-text);
  opacity: 0.6;
  font-size: 0.95rem;
}

.btn-primary {
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-accent) 35%, transparent);
  transition:
    background 0.2s,
    transform 0.15s,
    box-shadow 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-soft);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-accent) 40%, transparent);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.btn-secondary-plain {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.65rem 1.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-background);
  cursor: pointer;
  transition: border-color 0.2s;
}

.btn-secondary-plain:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.summary {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 8rem;
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background-soft);
}

.chip-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.chip-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.attendees {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-input {
  width: 100%;
  max-width: 24rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-size: 0.95rem;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.search-input::placeholder {
  opacity: 0.55;
}

.search-input:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

.filter-select {
  appearance: none;
  padding: 0.6rem 2.2rem 0.6rem 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-background-soft)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right 0.8rem center;
  color: var(--color-text);
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.filter-select:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 25%, transparent);
}

.filter-count {
  font-size: 0.85rem;
  opacity: 0.6;
}

.btn-secondary {
  margin-left: auto;
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  padding: 0.6rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-accent);
  background: transparent;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.btn-secondary:hover {
  color: var(--color-accent-contrast);
  background: var(--color-accent);
}

.error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, #dc2626 40%, transparent);
  background: color-mix(in srgb, #dc2626 8%, transparent);
  color: #dc2626;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.page-btn {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.5rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-background);
  cursor: pointer;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.85rem;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
</style>
