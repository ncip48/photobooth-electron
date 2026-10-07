<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
</script>

<template>
    <div class="card shrink-0 overflow-hidden">
        <div class="border-b-2 border-ink bg-lime px-5 py-4">
            <div class="flex items-start gap-3">
                <span class="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-paper-soft">
                    <SparklesIcon class="h-5 w-5 text-ink" />
                </span>
                <div>
                    <p class="eyebrow text-ink/60">Terima Kasih!</p>
                    <p class="display mt-1 text-xl font-bold leading-tight tracking-tight text-ink">
                        Senang melayani Anda
                    </p>
                </div>
            </div>
        </div>

        <div class="px-5 py-3.5">
            <p class="text-[12.5px] leading-5 text-ink/70">
                Hasil photostrip Anda sudah siap. Simpan kode QR atau kirim ke
                email Anda agar bisa diakses kapan saja.
            </p>
        </div>
    </div>
</template>