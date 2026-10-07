<script setup lang="ts">
import { ref } from 'vue'
import {
    ClipboardDocumentIcon,
    CheckCircleIcon,
    ArrowTopRightOnSquareIcon,
} from '@heroicons/vue/24/outline'

const props = withDefaults(
    defineProps<{
        qrUrl: string
        publicUrl: string
        loading?: boolean
    }>(),
    {
        loading: false,
    }
)

const copied = ref(false)

async function copyPublicUrl() {
    try {
        await navigator.clipboard.writeText(props.publicUrl)
        copied.value = true
        setTimeout(() => (copied.value = false), 2000)
    } catch (e) {
        console.error('Copy failed:', e)
    }
}
</script>

<template>
    <div class="flex flex-col items-center h-full justify-center ">
        <!-- Skeleton -->
        <template v-if="loading">
            <div class="h-52 w-52 animate-pulse border-4 border-ink/20 bg-paper-soft sm:h-56 sm:w-56" />
            <div class="mt-4 h-3 w-48 animate-pulse bg-ink/10" />
            <div class="mt-4 flex w-full gap-2">
                <div class="h-10 flex-1 animate-pulse bg-ink/10" />
                <div class="h-10 w-10 animate-pulse bg-ink/10" />
            </div>
        </template>

        <!-- Content -->
        <template v-else>
            <div class="border-4 border-ink bg-white p-4 shadow-brutal-lg">
                <img :src="qrUrl" alt="QR Code" class="h-52 w-52 sm:h-56 sm:w-56" />
            </div>

            <p class="mt-4 text-center text-[12.5px] leading-5 text-ink/70">
                Scan QR untuk membuka galeri foto Anda.
            </p>
        </template>
    </div>
</template>