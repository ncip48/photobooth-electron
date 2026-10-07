<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
    (e: 'close'): void
}>()
</script>

<template>
    <header
        class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b-2 border-ink bg-paper-soft px-6 py-5">
        <div class="min-w-0 flex-1">
            <h1 class="display mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Pilih Event
            </h1>
            <p class="mt-1 text-[13px] text-ink/60">
                Event yang dipilih akan menjadi default kiosk.
            </p>
        </div>

        <!-- Close -->
        <button type="button"
            class="grid h-11 w-11 shrink-0 place-items-center border-2 border-ink bg-paper-soft text-ink shadow-brutal-sm transition-all active:translate-y-0.5 hover:bg-rose"
            aria-label="Tutup" title="Tutup" @click="emit('close')">
            <XMarkIcon class="h-5 w-5" />
        </button>
    </header>
</template>