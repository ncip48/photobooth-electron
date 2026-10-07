<script setup lang="ts">
import { MapPinIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'

interface EventShape {
    id: string
    title: string
    subtitle?: string | null
    location?: string | null
    background_url?: string | null
}

defineProps<{
    event: EventShape
    current?: boolean
}>()

const emit = defineEmits<{
    (e: 'select'): void
}>()
</script>

<template>
    <button type="button"
        class="card group relative flex flex-col overflow-hidden text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-brutal-xl active:translate-y-0 active:shadow-brutal-md"
        :class="current && 'ring-4 ring-blue'" @click="emit('select')">

        <!-- Thumbnail -->
        <div class="relative h-40 border-b-2 border-ink bg-ink">
            <img v-if="event.background_url" :src="event.background_url" :alt="event.title"
                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div v-else class="grid-pattern h-full w-full opacity-40" />

            <!-- Current badge -->
            <div v-if="current"
                class="display absolute right-3 top-3 flex items-center gap-1.5 border-2 border-ink bg-lime px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
                <CheckCircleIcon class="h-3 w-3" />
                Default
            </div>
        </div>

        <!-- Info -->
        <div class="flex flex-1 flex-col gap-2 p-4">
            <p class="display text-[15px] font-bold leading-snug text-ink">
                {{ event.title }}
            </p>

            <p v-if="event.subtitle" class="line-clamp-2 text-[12.5px] leading-5 text-ink/60">
                {{ event.subtitle }}
            </p>

            <p v-if="event.location" class="mt-auto flex items-center gap-1.5 text-[12px] text-ink/55">
                <MapPinIcon class="h-3.5 w-3.5 shrink-0" />
                <span class="line-clamp-1">{{ event.location }}</span>
            </p>
        </div>
    </button>
</template>