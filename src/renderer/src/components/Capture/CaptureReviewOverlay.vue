<script setup lang="ts">
import { computed } from 'vue'
import { PhotoIcon } from '@heroicons/vue/24/outline'
import type { CaptureItem } from '@/composables/useCaptures'

const props = defineProps<{
    photo: CaptureItem
    previewDuration: number
    previewRemaining: number
    totalCaptures: number
}>()

const emit = defineEmits<{
    (e: 'skip'): void
}>()

const previewPercent = computed(() => {
    if (props.previewDuration <= 0) return 0
    return (props.previewRemaining / props.previewDuration) * 100
})
</script>

<template>
    <div class="absolute inset-0 z-30 flex cursor-pointer flex-col bg-ink" @click="emit('skip')">
        <!-- TOP LOADING BAR -->
        <div class="shrink-0 border-b-2 border-ink bg-paper-soft">
            <div class="h-1.5 w-full bg-paper" role="progressbar" :aria-valuenow="previewRemaining" aria-valuemin="0"
                :aria-valuemax="previewDuration">
                <div class="h-full bg-blue transition-[width] duration-1000 ease-linear"
                    :style="{ width: previewPercent + '%' }" />
            </div>

            <div class="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div class="flex min-w-0 items-center gap-2.5">
                    <span class="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-lime">
                        <PhotoIcon class="h-3.5 w-3.5 text-ink" />
                    </span>
                    <p class="display truncate text-[12.5px] font-bold text-ink">
                        Foto #{{ totalCaptures }} tersimpan
                    </p>
                </div>

                <span class="display shrink-0 text-base font-bold tabular-nums text-ink sm:text-lg">
                    {{ previewRemaining }}s
                </span>
            </div>
        </div>

        <div class="relative grid min-h-0 flex-1 place-items-center p-3 sm:p-5">
            <img :src="photo.url" :alt="photo.filename" class="max-h-full max-w-full object-contain" />
        </div>
    </div>
</template>