<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
    ArrowsRightLeftIcon,
    Cog6ToothIcon,
} from '@heroicons/vue/24/outline'

defineProps<{
    availableEventCount: number
}>()

const emit = defineEmits<{
    (e: 'open-settings'): void
    (e: 'open-event-picker'): void
}>()

/* Live clock */
const now = ref(new Date())
let clockInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    clockInterval = setInterval(() => {
        now.value = new Date()
    }, 1000)
})

onBeforeUnmount(() => {
    if (clockInterval) clearInterval(clockInterval)
})

const timeLabel = computed(() =>
    now.value.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    })
)

const dateLabel = computed(() =>
    now.value.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })
)
</script>

<template>
    <header class="slide-in-down relative z-20 flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
        <!-- Clock -->
        <div class="flex items-baseline gap-4">
            <p
                class="display text-3xl font-bold leading-none tracking-[-.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-4xl">
                {{ timeLabel }}
            </p>
            <p class="hidden text-[12.5px] text-white/60 sm:block">
                {{ dateLabel }}
            </p>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3">
            <button type="button"
                class="group inline-flex items-center gap-2.5 border-2 border-white/25 bg-ink/60 px-4 py-3 text-[13px] font-bold text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="availableEventCount === 0" @click="emit('open-event-picker')">
                <ArrowsRightLeftIcon class="h-4 w-4 transition-transform group-hover:rotate-180" />
            </button>

            <button type="button"
                class="group grid h-12 w-12 shrink-0 place-items-center border-2 border-white/25 bg-ink/60 text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink"
                aria-label="Pengaturan" @click="emit('open-settings')">
                <Cog6ToothIcon class="h-5 w-5 transition-transform group-hover:rotate-90" />
            </button>
        </div>
    </header>
</template>