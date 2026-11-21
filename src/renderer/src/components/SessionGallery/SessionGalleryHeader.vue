<script setup lang="ts">
import { XMarkIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

defineProps<{ loading?: boolean }>()

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'refresh'): void
}>()
</script>

<template>
    <header
        class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-2 border-ink bg-paper-soft px-6 py-5">
        <div class="min-w-0 flex-1">
            <h1 class="display mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Session Gallery
            </h1>
            <p class="mt-1 text-[13px] text-ink/60">
                Koleksi photostrip dari event ini.
            </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
            <button type="button"
                class="grid h-11 w-11 place-items-center border-2 border-ink bg-paper-soft text-ink shadow-brutal-sm transition-all hover:bg-lime active:translate-y-0.5 disabled:opacity-50"
                aria-label="Muat ulang" title="Muat ulang" :disabled="loading" @click="emit('refresh')">
                <ArrowPathIcon class="h-5 w-5" :class="loading && 'animate-spin'" />
            </button>

            <button type="button"
                class="grid h-11 w-11 place-items-center border-2 border-ink bg-paper-soft text-ink shadow-brutal-sm transition-all hover:bg-rose active:translate-y-0.5"
                aria-label="Tutup" title="Tutup" @click="emit('close')">
                <XMarkIcon class="h-5 w-5" />
            </button>
        </div>
    </header>
</template>