<script setup lang="ts">
import { useRouter } from 'vue-router'
import EventPickerHeader from '@/components/EventPicker/EventPickerHeader.vue'
import EventPickerSkeleton from '@/components/EventPicker/EventPickerSkeleton.vue'
import EventPickerEmpty from '@/components/EventPicker/EventPickerEmpty.vue'
import EventCard from '@/components/EventPicker/EventCard.vue'
import { useEvents, useActiveEvent } from '@/composables/useEvents'

const router = useRouter()
const { data: events, isLoading, refetch } = useEvents()
const { data: defaultEvent, setDefaultEvent } = useActiveEvent()

const selectEvent = (eventId: string) => {
    setDefaultEvent(eventId)
    router.push({ name: 'start' })
}

const close = () => {
    router.push({ name: 'start' })
}

const retry = () => {
    refetch()
}

const isCurrent = (eventId: string) => defaultEvent.value?.id === eventId
</script>

<template>
    <div class="min-h-screen bg-paper text-ink">
        <EventPickerHeader @close="close" />

        <main class="mx-auto max-w-6xl px-6 py-8">
            <!-- Skeleton -->
            <EventPickerSkeleton v-if="isLoading" />

            <!-- Empty -->
            <EventPickerEmpty v-else-if="!events || events.length === 0" @retry="retry" />

            <!-- Grid -->
            <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <EventCard v-for="evt in events" :key="evt.id" :event="evt" :current="isCurrent(evt.id)"
                    @select="selectEvent(evt.id)" />
            </div>
        </main>
    </div>
</template>