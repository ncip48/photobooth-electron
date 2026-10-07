<script setup lang="ts">
import { ref } from 'vue'
import { CameraIcon } from '@heroicons/vue/24/outline'
import CameraPreview from './CameraPreview.vue'
import CaptureTimerPill from './CaptureTimerPill.vue'
import CaptureReviewOverlay from './CaptureReviewOverlay.vue'
import type { CaptureItem } from '@/composables/useCaptures'

interface EventShape {
    title: string
    orientation: string
    preview_timer?: number | null
}

withDefaults(
    defineProps<{
        event: EventShape | null
        eventLoading?: boolean
        mmss: string | null
        isExpired?: boolean
        isLowTime?: boolean
        countdown?: number
        reviewingPhoto?: CaptureItem | null
        previewDuration?: number
        previewRemaining?: number
        totalCaptures?: number
    }>(),
    {
        eventLoading: false,
        isExpired: false,
        isLowTime: false,
        countdown: 0,
        reviewingPhoto: null,
        previewDuration: 5,
        previewRemaining: 0,
        totalCaptures: 0,
    }
)

const emit = defineEmits<{
    (e: 'skip-review'): void
}>()

const cameraRef = ref<InstanceType<typeof CameraPreview> | null>(null)

defineExpose({ cameraRef })
</script>

<template>
    <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <div class="flex min-w-0 items-center gap-2.5">
                <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                    <CameraIcon class="h-4 w-4 text-ink" />
                </span>
                <div class="min-w-0 flex-1">
                    <p class="eyebrow text-ink/50">Kamera Live</p>
                    <p class="display truncate text-[13.5px] font-bold text-ink" :class="eventLoading && 'text-ink/40'">
                        <template v-if="eventLoading || !event">
                            <span class="inline-block h-3.5 w-32 animate-pulse bg-ink/10" />
                        </template>
                        <template v-else>
                            {{ event.title }}
                        </template>
                    </p>
                </div>
            </div>

            <CaptureTimerPill v-if="!!mmss" :mmss="mmss" :is-expired="isExpired" :is-low-time="isLowTime"
                :loading="eventLoading" />
        </header>

        <!-- Preview area -->
        <div class="relative min-h-0 flex-1 bg-ink">
            <!-- Skeleton -->
            <div v-if="eventLoading || !event" class="absolute inset-0 grid place-items-center">
                <div class="flex flex-col items-center gap-4 text-center">
                    <div class="h-16 w-16 animate-pulse border-2 border-lime/30 bg-lime/10" />
                    <div class="h-3 w-32 animate-pulse bg-white/10" />
                    <div class="h-3 w-40 animate-pulse bg-white/5" />
                </div>
            </div>

            <template v-else>
                <CameraPreview v-show="!reviewingPhoto" ref="cameraRef" :orientation="event.orientation" />

                <!-- Countdown -->
                <div v-if="countdown > 0"
                    class="absolute inset-0 z-20 grid place-items-center bg-ink/40 backdrop-blur-sm">
                    <p
                        class="display text-[140px] font-bold leading-none text-lime drop-shadow-[0_8px_30px_rgba(0,0,0,0.7)] sm:text-[200px] lg:text-[240px]">
                        {{ countdown }}
                    </p>
                </div>

                <!-- Review overlay -->
                <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0"
                    enter-to-class="opacity-100" leave-active-class="transition duration-200 ease-in"
                    leave-from-class="opacity-100" leave-to-class="opacity-0">
                    <CaptureReviewOverlay v-if="reviewingPhoto" :photo="reviewingPhoto"
                        :preview-duration="previewDuration" :preview-remaining="previewRemaining"
                        :total-captures="totalCaptures" @skip="emit('skip-review')" />
                </Transition>
            </template>
        </div>
    </div>
</template>