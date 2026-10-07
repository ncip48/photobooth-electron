<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
</script>

<template>
    <div class="card flex shrink-0 items-start gap-2.5 border-2 border-ink bg-amber px-4 py-3">
        <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
        <p class="text-[12px] leading-5 text-ink">
            Pastikan Anda sudah <strong>menyimpan QR code</strong> atau
            <strong>mengirim ke email</strong> sebelum menekan Selesai.
        </p>
    </div>
</template>