<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    ClockIcon,
    CameraIcon,
    ArrowRightIcon,
    PhotoIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
} from '@heroicons/vue/24/outline'
import CameraPreview from '@/components/Capture/CameraPreview.vue'
import { useCamera } from '@/composables/useCamera'
import { useCaptures, type CaptureItem } from '@/composables/useCaptures'
import { useActiveEvent } from '@/composables/useEvents'

const route = useRoute()
const router = useRouter()

const sessionId = computed(() => route.params.sessionId as string)

/* =========================================================
   Active event
   ========================================================= */
const { data: event, isLoading: eventLoading } = useActiveEvent()

/* =========================================================
   Camera
   ========================================================= */
const { connected, capture: captureFromCamera, stopPreview, startPreview } =
    useCamera()

const cameraRef = ref<InstanceType<typeof CameraPreview> | null>(null)

/* =========================================================
   Captures — via TanStack Query
   ========================================================= */
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
} = useCaptures(sessionId)

/* =========================================================
   Session timer
   ========================================================= */
const totalSeconds = ref(300)
const remaining = ref(300)
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStarted = false

const startTimer = () => {
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

const isExpired = computed(() => remaining.value <= 0)
const isLowTime = computed(() => remaining.value <= 10 && remaining.value > 0)

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

const previewPercent = computed(() => {
    if (previewDuration.value <= 0) return 0
    return (previewRemaining.value / previewDuration.value) * 100
})

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

    /* Countdown */
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
            <!-- ============ KIRI: Gallery ============ -->
            <aside class="order-2 flex min-h-0 flex-col lg:order-1">
                <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
                    <!-- Header -->
                    <header
                        class="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-soft px-4 py-3">
                        <div class="flex items-center gap-2.5">
                            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                                <PhotoIcon class="h-4 w-4 text-ink" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="eyebrow text-ink/50">
                                    Hasil Jepretan
                                </p>
                                <p class="display text-[13.5px] font-bold text-ink"
                                    :class="galleryLoading && 'text-ink/40'">
                                    <template v-if="galleryLoading">
                                        <span class="inline-block h-3 w-16 animate-pulse bg-ink/10" />
                                    </template>
                                    <template v-else>
                                        {{ totalCaptures }} foto
                                    </template>
                                </p>
                            </div>
                        </div>
                    </header>

                    <div class="min-h-0 flex-1 overflow-y-auto p-3">
                        <div v-if="deleteError" class="mb-3 flex items-start gap-2.5 border-2 border-ink bg-rose p-3">
                            <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                            <p class="text-[12px] leading-5 text-ink">
                                {{ deleteError }}
                            </p>
                        </div>

                        <!-- ============================================================
                             SKELETON LOADING
                             ============================================================ -->
                        <div v-if="galleryLoading" class="space-y-3">
                            <div v-for="i in 3" :key="i"
                                class="relative overflow-hidden border-2 border-ink/20 bg-paper-soft">
                                <!-- Image skeleton -->
                                <div class="aspect-[3/4] w-full animate-pulse bg-ink/10" />

                                <!-- Number badge skeleton -->
                                <div
                                    class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink/20 bg-paper-soft text-[11px] font-bold text-ink/20">
                                    {{ i }}
                                </div>
                            </div>
                        </div>

                        <!-- ============================================================
                             EMPTY STATE
                             ============================================================ -->
                        <div v-else-if="gallery.length === 0"
                            class="grid h-full place-items-center px-4 py-10 text-center">
                            <div>
                                <span class="mx-auto grid h-16 w-16 place-items-center border-2 border-ink bg-paper">
                                    <CameraIcon class="h-7 w-7 text-ink/30" />
                                </span>
                                <p class="display mt-4 text-[13.5px] font-bold text-ink/60">
                                    Belum ada foto
                                </p>
                                <p class="mt-1 text-[12px] text-ink/45">
                                    Tekan "Jepret" untuk mulai
                                </p>
                            </div>
                        </div>

                        <!-- ============================================================
                             GALLERY LIST
                             ============================================================ -->
                        <div v-else class="space-y-3">
                            <div v-for="(item, idx) in gallery" :key="item.id ?? idx"
                                class="group relative overflow-hidden border-2 border-ink bg-paper-soft">
                                <img :src="item.url" :alt="item.filename" class="block w-full object-cover" :class="[
                                    item.uploading && 'opacity-70',
                                    item.failed && 'grayscale',
                                ]" />

                                <!-- Number badge -->
                                <div
                                    class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink bg-lime text-[11px] font-bold text-ink">
                                    {{ idx + 1 }}
                                </div>

                                <!-- Uploading overlay -->
                                <div v-if="item.uploading"
                                    class="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-sm">
                                    <div class="flex flex-col items-center gap-2">
                                        <div class="h-6 w-6 animate-spin border-2 border-white/30 border-t-white" />
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-white">
                                            Uploading
                                        </span>
                                    </div>
                                </div>

                                <!-- Failed -->
                                <div v-if="item.failed"
                                    class="absolute inset-0 grid place-items-center bg-rose/80 backdrop-blur-sm">
                                    <div class="flex flex-col items-center gap-2 px-3 text-center">
                                        <ExclamationTriangleIcon class="h-6 w-6 text-ink" />
                                        <span class="text-[10px] font-bold uppercase tracking-wider text-ink">
                                            Gagal Upload
                                        </span>
                                    </div>
                                </div>

                                <!-- Delete -->
                                <button v-if="!item.uploading" type="button"
                                    class="absolute right-2 top-2 grid h-8 w-8 place-items-center border-2 border-ink bg-rose text-ink shadow-brutal-sm transition-all active:translate-y-0.5 hover:bg-[#b3261e] hover:text-white disabled:cursor-wait disabled:opacity-60"
                                    :disabled="deletingId === item.id" :aria-label="`Hapus foto ${idx + 1}`"
                                    title="Hapus foto" @click.stop="deletePhoto(item)">
                                    <XMarkIcon class="h-4 w-4" :class="deletingId === item.id &&
                                        'animate-pulse'
                                        " />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <!-- ============ KANAN: Camera ============ -->
            <section class="order-1 flex min-h-0 flex-col gap-4 lg:order-2">
                <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
                    <!-- Header -->
                    <header
                        class="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-soft px-4 py-3">
                        <div class="flex min-w-0 items-center gap-2.5">
                            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                                <CameraIcon class="h-4 w-4 text-ink" />
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="eyebrow text-ink/50">
                                    Kamera Live
                                </p>
                                <p class="display truncate text-[13.5px] font-bold text-ink"
                                    :class="eventLoading && 'text-ink/40'">
                                    <template v-if="eventLoading || !event">
                                        <span class="inline-block h-3.5 w-32 animate-pulse bg-ink/10" />
                                    </template>
                                    <template v-else>
                                        {{ event.title }}
                                    </template>
                                </p>
                            </div>
                        </div>

                        <!-- Timer -->
                        <div class="flex shrink-0 items-center gap-2 border-2 px-3 py-1.5 transition-colors" :class="eventLoading
                                ? 'border-ink/20 bg-paper'
                                : isExpired
                                    ? 'border-[#b3261e] bg-rose'
                                    : isLowTime
                                        ? 'border-ink bg-amber'
                                        : 'border-ink bg-paper'
                            ">
                            <template v-if="eventLoading">
                                <span class="inline-block h-4 w-14 animate-pulse bg-ink/10" />
                            </template>
                            <template v-else>
                                <ClockIcon class="h-3.5 w-3.5 shrink-0" :class="isLowTime && !isExpired
                                        ? 'animate-pulse text-ink'
                                        : 'text-ink/60'
                                    " />
                                <span
                                    class="display text-base font-bold leading-none tracking-tight tabular-nums text-ink sm:text-lg">
                                    {{ mmss }}
                                </span>
                            </template>
                        </div>
                    </header>

                    <!-- Preview area -->
                    <div class="relative min-h-0 flex-1 bg-ink">
                        <!-- ============================================================
                             SKELETON LOADING (camera)
                             ============================================================ -->
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
                            <Transition enter-active-class="transition duration-300 ease-out"
                                enter-from-class="opacity-0" enter-to-class="opacity-100"
                                leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100"
                                leave-to-class="opacity-0">
                                <div v-if="reviewingPhoto"
                                    class="absolute inset-0 z-30 flex cursor-pointer flex-col bg-ink"
                                    @click="skipReview">
                                    <!-- TOP LOADING BAR -->
                                    <div class="shrink-0 border-b-2 border-ink bg-paper-soft">
                                        <div class="h-1.5 w-full bg-paper" role="progressbar"
                                            :aria-valuenow="previewRemaining" aria-valuemin="0"
                                            :aria-valuemax="previewDuration">
                                            <div class="h-full bg-blue transition-[width] duration-1000 ease-linear"
                                                :style="{
                                                    width: previewPercent + '%',
                                                }" />
                                        </div>

                                        <div class="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                                            <div class="flex min-w-0 items-center gap-2.5">
                                                <span
                                                    class="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-lime">
                                                    <PhotoIcon class="h-3.5 w-3.5 text-ink" />
                                                </span>
                                                <p class="display truncate text-[12.5px] font-bold text-ink">
                                                    Foto #{{
                                                        totalCaptures
                                                    }}
                                                    tersimpan
                                                </p>
                                            </div>

                                            <span
                                                class="display shrink-0 text-base font-bold tabular-nums text-ink sm:text-lg">
                                                {{ previewRemaining }}s
                                            </span>
                                        </div>
                                    </div>

                                    <div class="relative grid min-h-0 flex-1 place-items-center p-3 sm:p-5">
                                        <img :src="reviewingPhoto.url" :alt="reviewingPhoto.filename"
                                            class="max-h-full max-w-full object-contain" />
                                    </div>

                                    <div class="shrink-0 border-t-2 border-ink bg-paper-soft px-4 py-2.5 text-center">
                                        <p class="text-[10.5px] uppercase tracking-[.2em] text-ink/45">
                                            Ketuk atau tekan
                                            <span class="rounded border border-ink/25 px-1.5 py-0.5 text-ink/70">
                                                Spasi
                                            </span>
                                            untuk lanjut
                                        </p>
                                    </div>
                                </div>
                            </Transition>
                        </template>
                    </div>
                </div>

                <!-- Error -->
                <div v-if="captureError" class="flex shrink-0 items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] leading-5 text-ink">
                        {{ captureError }}
                    </p>
                </div>

                <!-- Actions -->
                <div class="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <button type="button"
                        class="display inline-flex items-center justify-center gap-4 border-4 border-ink bg-lime px-8 py-4 text-2xl font-bold text-ink shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-60 sm:text-3xl"
                        :disabled="capturing ||
                            isExpired ||
                            !!reviewingPhoto ||
                            eventLoading ||
                            !event
                            " @click="takePicture">
                        <CameraIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9" :class="capturing && 'animate-pulse'" />
                        <span class="tracking-[-.02em]">
                            {{ capturing ? 'Memproses...' : 'Jepret!' }}
                        </span>
                    </button>

                    <button type="button"
                        class="display inline-flex items-center justify-center gap-3 border-4 border-ink bg-ink px-8 py-4 text-2xl font-bold text-white shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-40 sm:text-3xl"
                        :disabled="isFinishing ||
                            totalCaptures === 0 ||
                            hasPendingUploads ||
                            eventLoading ||
                            !event
                            " @click="finishSession">
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
            </section>
        </main>
    </div>
</template>