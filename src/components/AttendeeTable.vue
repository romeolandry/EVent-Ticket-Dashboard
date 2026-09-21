<script setup lang="ts">
import { computed } from 'vue'
import type { Attendee } from '@/types/tickets'

const props = withDefaults(
  defineProps<{
    attendees: Attendee[]
    loading?: boolean
  }>(),
  { loading: false },
)

/** Colonnes dynamiques : union des clés des champs personnalisés de tous les participants. */
const dynamicColumns = computed<string[]>(() => {
  const keys = new Set<string>()
  for (const attendee of props.attendees) {
    for (const key of Object.keys(attendee.fields)) {
      keys.add(key)
    }
  }
  return [...keys]
})
</script>

<template>
  <div class="attendee-table">
    <p v-if="loading" class="state">Chargement des participants…</p>
    <p v-else-if="attendees.length === 0" class="state">Aucun participant à afficher.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Nom</th>
          <th>Email</th>
          <th>Billet</th>
          <th>Présent</th>
          <th v-for="column in dynamicColumns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="attendee in attendees" :key="attendee.id">
          <td>{{ attendee.name }}</td>
          <td>{{ attendee.email }}</td>
          <td>{{ attendee.ticket }}</td>
          <td>{{ attendee.checkedIn ? 'Oui' : 'Non' }}</td>
          <td v-for="column in dynamicColumns" :key="column">
            {{ attendee.fields[column] ?? '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  text-align: left;
}

.state {
  color: var(--color-text);
  opacity: 0.7;
}
</style>
