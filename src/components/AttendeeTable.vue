<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldLabel } from '@/services/fieldLabels'
import type { Attendee } from '@/types/tickets'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    attendees: Attendee[]
    /** Liste complète (toutes pages confondues) servant au calcul des colonnes
     * dynamiques — utile quand `attendees` n'est qu'une page. */
    columnsOf?: Attendee[]
    loading?: boolean
    /** Id du participant dont une action (check-in/out) est en cours. */
    pendingActionId?: number | null
    /** Groupes de travail : attendeeId → numéro de groupe. */
    groups?: Record<number, number>
    /** Nombre de groupes disponibles à l'assignation. */
    groupCount?: number
    /** Emails exclus de la répartition automatique (marqueur sur la ligne). */
    excludedEmails?: string[]
  }>(),
  {
    columnsOf: undefined,
    loading: false,
    pendingActionId: null,
    groups: () => ({}),
    groupCount: 4,
    excludedEmails: () => [],
  },
)

defineEmits<{
  checkIn: [attendeeId: number]
  checkOut: [attendeeId: number]
  print: [attendee: Attendee]
  setGroup: [attendeeId: number, group: number | null]
}>()

/** Colonnes dynamiques : union des clés des champs personnalisés de tous les participants. */
const dynamicColumns = computed<string[]>(() => {
  const keys = new Set<string>()
  for (const attendee of props.columnsOf ?? props.attendees) {
    for (const key of Object.keys(attendee.fields)) {
      keys.add(key)
    }
  }
  return [...keys]
})

const excludedSet = computed(
  () => new Set(props.excludedEmails.map((email) => email.trim().toLowerCase())),
)

/** Vrai si l'email du participant est exclu de la répartition automatique. */
function isExcluded(attendee: Attendee): boolean {
  return excludedSet.value.has(attendee.email.trim().toLowerCase())
}

/**
 * Le groupe 1 est réservé aux exclus dès qu'un participant chargé est exclu
 * (columnsOf = toutes pages confondues). Il est alors hors des choix
 * d'assignation manuelle.
 */
const EXCLUDED_GROUP = 1
const reserved = computed(
  () =>
    props.groupCount > EXCLUDED_GROUP &&
    (props.columnsOf ?? props.attendees).some(isExcluded),
)
const selectableGroups = computed(() => {
  const start = reserved.value ? EXCLUDED_GROUP + 1 : EXCLUDED_GROUP
  return Array.from({ length: props.groupCount - start + 1 }, (_, i) => start + i)
})
</script>

<template>
  <div class="attendee-table">
    <p v-if="loading" class="state">{{ t('table.loading') }}</p>
    <p v-else-if="attendees.length === 0" class="state">{{ t('table.empty') }}</p>
    <div v-else class="table-card">
      <table>
        <thead>
          <tr>
            <th>{{ t('table.name') }}</th>
            <th>{{ t('table.email') }}</th>
            <th>{{ t('table.ticket') }}</th>
            <th>{{ t('table.present') }}</th>
            <th v-for="column in dynamicColumns" :key="column">
              {{ fieldLabel(column, t) }}
            </th>
            <th>{{ t('table.group') }}</th>
            <th class="actions-col">{{ t('table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="attendee in attendees" :key="attendee.id">
            <td class="name">
              {{ attendee.name }}
              <span
                v-if="isExcluded(attendee)"
                class="excluded-mark"
                role="img"
                :title="t('table.excludedFromAutoAssign')"
                :aria-label="t('table.excludedFromAutoAssign')"
                >⊘</span
              >
            </td>
            <td>{{ attendee.email }}</td>
            <td>{{ attendee.ticket }}</td>
            <td>
              <span class="badge" :class="attendee.checkedIn ? 'badge-ok' : 'badge-no'">
                {{ attendee.checkedIn ? t('table.yes') : t('table.no') }}
              </span>
            </td>
            <td v-for="column in dynamicColumns" :key="column">
              {{ attendee.fields[column] ?? '' }}
            </td>
            <td>
              <!-- Groupe réservé : pastille fixe, non modifiable -->
              <span
                v-if="isExcluded(attendee)"
                class="group-fixed"
                :title="t('table.excludedFromAutoAssign')"
              >
                {{ groups[attendee.id] ?? 1 }}
              </span>
              <select
                v-else
                class="group-select"
                :class="{ assigned: groups[attendee.id] != null }"
                :value="groups[attendee.id] ?? ''"
                :aria-label="t('table.group')"
                @change="
                  $emit(
                    'setGroup',
                    attendee.id,
                    ($event.target as HTMLSelectElement).value === ''
                      ? null
                      : Number(($event.target as HTMLSelectElement).value),
                  )
                "
              >
                <option value="">—</option>
                <option v-for="n in selectableGroups" :key="n" :value="n">{{ n }}</option>
              </select>
            </td>
            <td class="actions">
              <button
                type="button"
                class="btn-action"
                :disabled="attendee.checkedIn || pendingActionId === attendee.id"
                @click="$emit('checkIn', attendee.id)"
              >
                {{ t('table.checkIn') }}
              </button>
              <button
                type="button"
                class="btn-action"
                :disabled="!attendee.checkedIn || pendingActionId === attendee.id"
                @click="$emit('checkOut', attendee.id)"
              >
                {{ t('table.checkOut') }}
              </button>
              <button
                type="button"
                class="btn-action btn-print"
                :disabled="!attendee.checkedIn || groups[attendee.id] == null"
                :title="
                  groups[attendee.id] == null ? t('table.printNeedsGroup') : undefined
                "
                @click="$emit('print', attendee)"
              >
                {{ t('table.printBadge') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-card {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-background);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th {
  padding: 0.7rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text);
  opacity: 0.65;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

td {
  padding: 0.65rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr {
  transition: background 0.15s;
}

tbody tr:hover {
  background: var(--color-background-soft);
}

.name {
  font-weight: 600;
  white-space: nowrap;
}

.excluded-mark {
  display: inline-block;
  margin-left: 0.4rem;
  color: #b45309;
  font-size: 0.85rem;
  vertical-align: middle;
}

.badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}

.badge-ok {
  color: #15803d;
  background: color-mix(in srgb, #22c55e 15%, transparent);
}

.badge-no {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 15%, transparent);
}

.actions-col {
  text-align: right;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
  white-space: nowrap;
}

.btn-action {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-background);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.btn-action:hover:not(:disabled) {
  border-color: var(--color-accent);
  background: var(--color-background-soft);
}

.btn-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-print:hover:not(:disabled) {
  color: var(--color-accent-contrast);
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.group-select {
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 0.82rem;
  cursor: pointer;
}

.group-select.assigned {
  border-color: var(--color-accent);
  font-weight: 700;
}

.group-fixed {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  background: color-mix(in srgb, #f59e0b 15%, transparent);
  color: #b45309;
  font-size: 0.82rem;
  font-weight: 700;
}

.state {
  color: var(--color-text);
  opacity: 0.7;
}
</style>
