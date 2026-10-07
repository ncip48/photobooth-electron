<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useEvents, useActiveEvent } from '@/composables/useEvents'

const router = useRouter()
const { data: events, isLoading } = useEvents()
const { data: defaultEvent, setDefaultEvent } = useActiveEvent()

const selectEvent = (eventId: string) => {
    setDefaultEvent(eventId)
    router.push({ name: 'start' })
}

const isCurrent = (eventId: string) => defaultEvent.value?.id === eventId
</script>

<template>
    <div class="min-h-screen bg-paper text-ink">
        <header class="border-b-2 border-ink bg-paper-soft px-6 py-5">
            <h1 class="display text-2xl font-bold tracking-tight">
                Pilih Event
            </h1>
            <p class="mt-1 text-[13px] text-ink/60">
                Event yang dipilih akan menjadi default kiosk.
            </p>
        </header>

        <main class="mx-auto max-w-6xl px-6 py-8">
            <div v-if="isLoading" class="text-center text-ink/60">
                Loading events...
            </div>

            <div v-else-if="!events || events.length === 0" class="card grid place-items-center px-6 py-16 text-center">
                <p class="text-ink/60">Belum ada event tersedia.</p>
            </div>

            <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <button v-for="evt in events" :key="evt.id" type="button"
                    class="card flex flex-col overflow-hidden text-left transition-transform hover:-translate-y-1"
                    :class="isCurrent(evt.id) && 'ring-4 ring-blue'" @click="selectEvent(evt.id)">
                    <!-- Thumbnail -->
                    <div class="relative h-40 border-b-2 border-ink bg-ink">
                        <img v-if="evt.background_url" :src="evt.background_url" :alt="evt.title"
                            class="h-full w-full object-cover" />
                        <div v-else class="grid-pattern h-full w-full opacity-40" />

                        <!-- Current badge -->
                        <div v-if="isCurrent(evt.id)"
                            class="display absolute right-3 top-3 border-2 border-ink bg-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                            Default
                        </div>
                    </div>

                    <!-- Info -->
                    <div class="flex flex-1 flex-col gap-2 p-4">
                        <p class="display text-[15px] font-bold text-ink">
                            {{ evt.title }}
                        </p>
                        <p v-if="evt.subtitle" class="line-clamp-2 text-[12.5px] text-ink/60">
                            {{ evt.subtitle }}
                        </p>
                        <p v-if="evt.location" class="mt-auto flex items-center gap-1.5 text-[12px] text-ink/55">
                            <MapPinIcon class="h-3.5 w-3.5" />
                            {{ evt.location }}
                        </p>
                    </div>
                </button>
            </div>
        </main>
    </div>
</template>