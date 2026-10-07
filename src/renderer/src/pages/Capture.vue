<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import CaptureGallery from '@/components/Capture/CaptureGallery.vue'
import CaptureStage from '@/components/Capture/CaptureStage.vue'
import CaptureActions from '@/components/Capture/CaptureActions.vue'
import { useCamera } from '@/composables/useCamera'
import { useCaptures, type CaptureItem } from '@/composables/useCaptures'
import { useActiveEvent } from '@/composables/useEvents'

const route = useRoute()
const router = useRouter()
const sessionId = computed(() => route.params.sessionId as string)
const templateId = computed(() => route.params.templateId as string)

/* Event */
const { data: event, isLoading: eventLoading } = useActiveEvent()

/* Camera */
const { connected, capture: captureFromCamera, stopPreview, startPreview } =
    useCamera()

const stageRef = ref<InstanceType<typeof CaptureStage> | null>(null)

/* Captures */
const {
    captures: gallery,
    totalCaptures,
    hasPendingUploads,
    isLoading: galleryLoading,
    uploadCapture,
    deleteCapture,
    finishCapture,
    deletingId,
    isFinishing,

    totalDropzone,
    isTemplateLoading,
} = useCaptures(sessionId, templateId)

/* =========================================================
   Session timer
   ========================================================= */
const totalSeconds = ref(300)
const remaining = ref(300)
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStarted = false

const isSimpleMode = computed(() => {
    return Boolean(event.value?.is_simple && templateId.value)
})

const startTimer = () => {
    // Simple mode tidak menggunakan timer
    if (isSimpleMode.value) return

    stopTimer()

    timerInterval = setInterval(() => {
        if (remaining.value > 0) {
            remaining.value--
        } else {
            stopTimer()
            finishSession()
        }
    }, 1000)
}

const stopTimer = () => {
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
}

watch(
    () => event.value,
    (evt) => {
        if (!evt || timerStarted) return

        // Simple mode: jangan inisialisasi / jalankan timer
        if (isSimpleMode.value) {
            stopTimer()
            return
        }

        totalSeconds.value = evt.time_take_picture ?? 300
        remaining.value = totalSeconds.value
        timerStarted = true
        startTimer()
    },
    { immediate: true }
)

const mmss = computed(() => {
    const m = Math.floor(remaining.value / 60)
    const s = remaining.value % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const isExpired = computed(() => {
    // Simple mode tidak pernah expired karena timer
    if (isSimpleMode.value) return false

    return remaining.value <= 0
})

const isLowTime = computed(() => {
    // Simple mode tidak memiliki low-time state
    if (isSimpleMode.value) return false

    return remaining.value <= 10 && remaining.value > 0
})

const isSetMaxCapture = computed(() => {
    // Simple event:
    // limit berasal dari template
    if (event?.value?.is_simple) {
        return Boolean(
            templateId &&
            totalDropzone.value > 0
        )
    }

    // Non-simple event:
    // limit berasal dari event.max_capture
    return Boolean(
        event?.value?.max_capture &&
        event.value.max_capture > 0
    )
})

const maxCapture = computed(() => {
    if (event?.value?.is_simple) {
        return totalDropzone.value
    }

    return event?.value?.max_capture ?? 0
})

const isReachMaxCapture = computed(() => {
    return (
        isSetMaxCapture.value &&
        totalCaptures.value >= maxCapture.value
    )
})

/* =========================================================
   Capture state
   ========================================================= */
const capturing = ref(false)
const countdown = ref(0)
const captureError = ref('')

/* =========================================================
   Preview review
   ========================================================= */
const reviewingPhoto = ref<CaptureItem | null>(null)
const previewDuration = ref(5)
const previewRemaining = ref(0)
let previewInterval: ReturnType<typeof setInterval> | null = null

const startReview = (photo: CaptureItem) => {
    stopReview()

    const duration = Math.max(1, event.value?.preview_timer ?? 5)

    reviewingPhoto.value = photo
    previewDuration.value = duration
    previewRemaining.value = duration

    previewInterval = setInterval(() => {
        if (previewRemaining.value > 0) {
            previewRemaining.value--
        }
        if (previewRemaining.value <= 0) {
            stopReview()
        }
    }, 1000)
}

const stopReview = () => {
    if (previewInterval) {
        clearInterval(previewInterval)
        previewInterval = null
    }
    reviewingPhoto.value = null
    previewRemaining.value = 0
}

const skipReview = () => stopReview()

/* =========================================================
   Take picture
   ========================================================= */
const takePicture = async () => {
    if (capturing.value || isExpired.value || reviewingPhoto.value) return
    if (!event.value) {
        captureError.value = 'Event belum dimuat.'
        return
    }
    if (!connected.value) {
        captureError.value = 'Kamera belum terhubung.'
        return
    }

    capturing.value = true
    captureError.value = ''

    const countdownFrom = event.value.countdown_timer ?? 3
    for (let i = countdownFrom; i > 0; i--) {
        countdown.value = i
        await new Promise((r) => setTimeout(r, 1000))
    }
    countdown.value = 0

    try {
        const data = await captureFromCamera()
        if (!data?.data) throw new Error('Gagal mengambil gambar.')

        const tempId = `temp-${Date.now()}`

        startReview({
            id: tempId,
            filename: `capture-${Date.now()}.jpg`,
            url: data.data,
            uploading: true,
            failed: false,
            created_at: new Date().toISOString(),
        })

        uploadCapture(data.data, 'image/jpeg', tempId).catch((err) => {
            console.error('Upload failed:', err)
        })
    } catch (err: any) {
        console.error('Capture failed:', err)
        captureError.value = err?.message ?? 'Gagal mengambil gambar.'
    } finally {
        capturing.value = false
    }
}

/* =========================================================
   Delete
   ========================================================= */
const deleteError = ref('')

const deletePhoto = async (item: CaptureItem) => {
    if (item.uploading) return
    deleteError.value = ''
    try {
        await deleteCapture(item.id)
    } catch (err: any) {
        console.error('Delete failed:', err)
        deleteError.value = err?.message ?? 'Gagal menghapus foto.'
    }
}

/* =========================================================
   Finish
   ========================================================= */
const finishSession = async () => {
    if (isFinishing.value) return
    if (totalCaptures.value === 0) {
        captureError.value = 'Belum ada foto yang diambil.'
        return
    }
    if (hasPendingUploads.value) {
        captureError.value = 'Tunggu upload foto selesai...'
        return
    }

    stopTimer()

    try {
        await finishCapture()
        router.push({
            name: 'editor',
            params: { sessionId: sessionId.value },
        })
    } catch (err) {
        // Error sudah di-set
    }
}

/* =========================================================
   Keyboard
   ========================================================= */
const onKeydown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
        e.preventDefault()
        reviewingPhoto.value ? skipReview() : takePicture()
    }
    if (e.code === 'Enter' && e.ctrlKey) {
        e.preventDefault()
        finishSession()
    }
}

/* =========================================================
   Lifecycle
   ========================================================= */
onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    if (connected.value) startPreview()
})

onBeforeUnmount(() => {
    stopTimer()
    stopReview()
    stopPreview()
    window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink">
        <main
            class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 sm:p-6 lg:grid-cols-[360px_1fr] lg:gap-5">
            <!-- KIRI: Gallery -->
            <aside class="order-2 flex min-h-0 flex-col lg:order-1">
                <CaptureGallery :gallery="gallery" :total-captures="totalCaptures" :gallery-loading="galleryLoading"
                    :deleting-id="deletingId" :delete-error="deleteError" @delete="deletePhoto"
                    :max-capture="totalDropzone" />
            </aside>

            <!-- KANAN: Stage + Actions -->
            <section class="order-1 flex min-h-0 flex-col gap-4 lg:order-2">
                <CaptureStage ref="stageRef" :event="event ?? null" :event-loading="eventLoading"
                    :mmss="isSimpleMode ? null : mmss" :is-expired="isSimpleMode ? false : isExpired"
                    :is-low-time="isSimpleMode ? false : isLowTime" :countdown="countdown"
                    :reviewing-photo="reviewingPhoto" :preview-duration="previewDuration"
                    :preview-remaining="previewRemaining" :total-captures="totalCaptures" @skip-review="skipReview" />

                <!-- Error -->
                <div v-if="captureError" class="flex shrink-0 items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] leading-5 text-ink">{{ captureError }}</p>
                </div>

                <!-- Actions -->
                <CaptureActions :capturing="capturing" :is-finishing="isFinishing"
                    :has-pending-uploads="hasPendingUploads" :total-captures="totalCaptures" :disabled-capture="isExpired ||
                        !!reviewingPhoto ||
                        eventLoading ||
                        !event ||
                        isReachMaxCapture
                        " :disabled-finish="eventLoading || !event" @capture="takePicture" @finish="finishSession" />
            </section>
        </main>
    </div>
</template>