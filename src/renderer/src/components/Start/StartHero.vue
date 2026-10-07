<script setup lang="ts">
import { PlayIcon } from '@heroicons/vue/24/outline'

interface EventShape {
    title: string
    subtitle?: string | null
}

defineProps<{
    event: EventShape
    starting?: boolean
}>()

const emit = defineEmits<{
    (e: 'start'): void
}>()
</script>

<template>
    <div class="flex w-full max-w-5xl flex-col items-center text-center">
        <!-- Eyebrow -->
        <div
            class="slide-in-down eyebrow mb-8 inline-flex items-center gap-3 border border-lime/40 bg-ink/50 px-4 py-2 backdrop-blur-md">
            <span class="relative flex h-2 w-2 items-center justify-center">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                <span class="relative inline-flex h-2 w-2 rounded-full bg-lime" />
            </span>
            <span class="text-lime">Sesi Photobooth Siap</span>
        </div>

        <!-- Title -->
        <h1
            class="slide-in-up display text-5xl font-bold leading-[1] tracking-[-.045em] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.7)] sm:text-6xl lg:text-7xl xl:text-[7.5rem]">
            {{ event.title }}
        </h1>

        <!-- Divider -->
        <div class="slide-in-up delay-200 mt-8 flex items-center gap-3" aria-hidden="true">
            <span class="h-px w-12 bg-lime/60 sm:w-20" />
            <span class="h-1.5 w-1.5 rotate-45 bg-lime" />
            <span class="h-px w-12 bg-lime/60 sm:w-20" />
        </div>

        <!-- Subtitle -->
        <p v-if="event.subtitle"
            class="slide-in-up delay-300 mt-8 max-w-3xl text-xl leading-9 text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-2xl sm:leading-10">
            {{ event.subtitle }}
        </p>

        <!-- MULAI button -->
        <div class="slide-in-up delay-500 relative mt-20">
            <div class="pointer-events-none absolute -inset-8 rounded-full bg-lime/20 blur-3xl" aria-hidden="true" />

            <div class="breath pointer-events-none absolute -inset-3 border-2 border-lime/30" aria-hidden="true" />

            <button type="button"
                class="group glow-pulse relative inline-flex items-center justify-center gap-5 border-4 border-ink bg-lime px-20 py-8 text-3xl font-bold text-ink transition-all duration-200 active:translate-y-1 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-70 sm:px-28 sm:py-9 sm:text-4xl lg:px-32 lg:py-10 lg:text-5xl"
                :disabled="starting" @click="emit('start')">
                <PlayIcon
                    class="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-110 group-active:scale-95 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
                    :class="starting && 'animate-pulse'" />
                <span class="display tracking-[-.03em]">
                    {{ starting ? 'Memulai...' : 'MULAI' }}
                </span>

                <span class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                    <span
                        class="marquee-accent absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style="animation-play-state: paused" />
                </span>
            </button>
        </div>
    </div>
</template>