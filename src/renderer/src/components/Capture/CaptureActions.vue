<script setup lang="ts">
import { CameraIcon, ArrowRightIcon } from '@heroicons/vue/24/outline'

withDefaults(
    defineProps<{
        capturing?: boolean
        isFinishing?: boolean
        hasPendingUploads?: boolean
        totalCaptures?: number
        disabledCapture?: boolean
        disabledFinish?: boolean
    }>(),
    {
        capturing: false,
        isFinishing: false,
        hasPendingUploads: false,
        totalCaptures: 0,
        disabledCapture: false,
        disabledFinish: false,
    }
)

const emit = defineEmits<{
    (e: 'capture'): void
    (e: 'finish'): void
}>()
</script>

<template>
    <div class="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <!-- Jepret -->
        <button type="button"
            class="display inline-flex items-center justify-center gap-4 border-4 border-ink bg-lime px-8 py-4 text-2xl font-bold text-ink shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-60 sm:text-3xl"
            :disabled="disabledCapture || capturing" @click="emit('capture')">
            <CameraIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9" :class="capturing && 'animate-pulse'" />
            <span class="tracking-[-.02em]">
                {{ capturing ? 'Memproses...' : 'Jepret!' }}
            </span>
        </button>

        <!-- Lanjut -->
        <button type="button"
            class="display inline-flex items-center justify-center gap-3 border-4 border-ink bg-ink px-8 py-4 text-2xl font-bold text-white shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-40 sm:text-3xl"
            :disabled="disabledFinish || isFinishing || totalCaptures === 0 || hasPendingUploads"
            @click="emit('finish')">
            <span class="tracking-[-.02em]">
                {{
                    isFinishing
                        ? '...'
                        : hasPendingUploads
                            ? 'Uploading...'
                            : 'Lanjut'
                }}
            </span>
            <ArrowRightIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
        </button>
    </div>
</template>