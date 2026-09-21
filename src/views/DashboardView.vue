<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import EventSelector from '@/components/EventSelector.vue'
import AttendeeTable from '@/components/AttendeeTable.vue'
import { useEventsStore } from '@/stores/events'
import { useAttendeesStore } from '@/stores/attendees'

const eventsStore = useEventsStore()
const attendeesStore = useAttendeesStore()
const { events, isLoading: eventsLoading, error: eventsError } = storeToRefs(eventsStore)
const {
  attendees,
  isLoading: attendeesLoading,
  error: attendeesError,
} = storeToRefs(attendeesStore)

onMounted(() => {
  eventsStore.loadEvents()
})

function onEventSelect(eventId: number) {
  attendeesStore.loadAttendees(eventId)
}
</script>

<template>
  <main class="dashboard">
    <h1>Participants</h1>

    <EventSelector :events="events" :loading="eventsLoading" @select="onEventSelect" />
    <p v-if="eventsError" class="error" role="alert">{{ eventsError }}</p>

    <section v-if="attendeesStore.selectedEventId != null" class="attendees">
      <AttendeeTable :attendees="attendees" :loading="attendeesLoading" />
      <p v-if="attendeesError" class="error" role="alert">{{ attendeesError }}</p>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
}

.error {
  color: #c0392b;
}
</style>
