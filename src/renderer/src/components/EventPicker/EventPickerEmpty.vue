<script setup lang="ts">
import { CalendarDaysIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
    (e: 'retry'): void
}>()
</script>

<template>
    <div class="card grid place-items-center px-6 py-20 text-center">
        <span class="grid h-20 w-20 place-items-center border-2 border-ink bg-paper-soft">
            <CalendarDaysIcon class="h-10 w-10 text-ink/30" />
        </span>
        <p class="display mt-5 text-lg font-bold text-ink">
            Belum ada event tersedia
        </p>
        <p class="mt-1 max-w-sm text-[13px] leading-6 text-ink/55">
            Pastikan admin sudah membuat event di dashboard, lalu muat ulang halaman ini.
        </p>
        <button type="button"
            class="display mt-6 inline-flex items-center gap-2 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all active:translate-y-1 active:shadow-brutal-sm"
            @click="emit('retry')">
            Muat Ulang
        </button>
    </div>
</template>