<script setup lang="ts">
import { ArrowsRightLeftIcon, SparklesIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
    (e: 'pick-event'): void
}>()
</script>

<template>
    <div class="fade-in mx-auto flex max-w-xl flex-col items-center gap-7 text-center">
        <div class="grid h-24 w-24 place-items-center border-2 border-lime bg-lime/15 backdrop-blur-sm">
            <SparklesIcon class="h-12 w-12 text-lime" />
        </div>

        <div>
            <p class="eyebrow text-lime">Kiosk Siap</p>
            <h1 class="display mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
                Belum ada event aktif
            </h1>
            <p class="mt-4 text-[15px] leading-7 text-white/70">
                Pilih event dari daftar yang tersedia untuk memulai sesi photobooth.
            </p>
        </div>

        <button type="button"
            class="group inline-flex items-center gap-4 border-4 border-ink bg-lime px-12 py-6 text-xl font-bold text-ink shadow-brutal-xl transition-all active:translate-y-1 active:shadow-brutal-sm sm:px-16 sm:py-7 sm:text-2xl"
            @click="emit('pick-event')">
            <ArrowsRightLeftIcon class="h-7 w-7 sm:h-8 sm:w-8" />
            <span class="display tracking-[-.02em]">Pilih Event</span>
        </button>
    </div>
</template>