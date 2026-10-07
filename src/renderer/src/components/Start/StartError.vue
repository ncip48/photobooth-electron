<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'

const emit = defineEmits<{
    (e: 'reload'): void
}>()
</script>

<template>
    <div class="fade-in mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <div class="grid h-20 w-20 place-items-center border-2 border-rose bg-rose/20">
            <SparklesIcon class="h-10 w-10 text-rose" />
        </div>
        <div>
            <p class="eyebrow text-rose">Gagal Memuat</p>
            <h1 class="display mt-3 text-3xl font-bold text-white">
                Tidak dapat terhubung ke server
            </h1>
            <p class="mt-2 text-[14px] leading-6 text-white/70">
                Pastikan backend berjalan dan coba muat ulang.
            </p>
        </div>
        <button type="button"
            class="display inline-flex items-center gap-3 border-4 border-ink bg-lime px-8 py-4 text-xl font-bold text-ink shadow-brutal-xl active:translate-y-1 active:shadow-brutal-sm"
            @click="emit('reload')">
            Muat Ulang
        </button>
    </div>
</template>