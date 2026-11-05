<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
    CameraIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import { useCamera } from '@/composables/useCamera'

/* =========================================================
   Props
   ========================================================= */
const props = withDefaults(
    defineProps<{
        cameraSettings?: Record<string, any>
        orientation?: string
        /** Auto-start preview saat mounted (default: true) */
        autoStart?: boolean
    }>(),
    {
        cameraSettings: () => ({}),
        orientation: 'portrait',
        autoStart: true,
    }
)

/* =========================================================
   Camera via composable (IPC)
   ========================================================= */
const {
    connected,
    connecting,
    detecting,
    connectedModel,
    livePreviewUrl,
    error: connectionError,
    detect,
    connect,
    connectById,
    disconnect,
    capture: captureFromCamera,
    startPreview,
    stopPreview,
    selectedCameraId,
} = useCamera()

/* =========================================================
   State
   ========================================================= */
const autoConnecting = ref(false)
const manualFallback = ref(false) // tampilkan tombol manual kalau auto-connect gagal

/* =========================================================
   AUTO-CONNECT FLOW
   =========================================================
   1. Kalau sudah connected → langsung start preview
   2. Kalau belum → coba auto-connect by saved ID
   3. Kalau tidak ada saved ID → fallback ke camera pertama
   4. Kalau semua gagal → tampilkan tombol manual
   ========================================================= */
const initializeCamera = async () => {
    if (connected.value) {
        startPreview()
        return
    }

    autoConnecting.value = true

    try {
        // Detect kamera yang tersedia
        const list = await detect()

        if (list.length === 0) {
            // Tidak ada camera terdeteksi → biarkan user lihat pesan
            return
        }

        // Coba auto-connect by saved ID
        if (selectedCameraId.value) {
            const result = await connectById(selectedCameraId.value)
            if (result && connected.value) {
                startPreview()
                return
            }
            console.warn(
                `[CameraPreview] Saved camera "${selectedCameraId.value}" tidak ditemukan, fallback ke camera pertama.`
            )
        }

        // Fallback: connect ke camera pertama
        const result = await connect(0)
        if (result && connected.value) {
            startPreview()
            return
        }

        // Kalau sampai sini, gagal auto-connect
        manualFallback.value = true
    } catch (err) {
        console.error('[CameraPreview] Auto-connect failed:', err)
        manualFallback.value = true
    } finally {
        autoConnecting.value = false
    }
}


const previewImage = ref<HTMLImageElement | null>(null)
const recordingCanvas = ref<HTMLCanvasElement | null>(null)

let animationFrameId: number | null = null

const drawCanvas = () => {
    const image = previewImage.value
    const canvas = recordingCanvas.value

    if (!image || !canvas) {
        animationFrameId = requestAnimationFrame(drawCanvas)
        return
    }

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    if (image.complete && image.naturalWidth > 0) {
        const scale = Math.min(
            canvas.width / image.naturalWidth,
            canvas.height / image.naturalHeight,
        )

        const width = image.naturalWidth * scale
        const height = image.naturalHeight * scale

        const x = (canvas.width - width) / 2
        const y = (canvas.height - height) / 2

        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.drawImage(image, x, y, width, height)
    }

    animationFrameId = requestAnimationFrame(drawCanvas)
}

watch(livePreviewUrl, async (url) => {
    if (!url) return

    await nextTick()

    if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(drawCanvas)
    }
})

const recordMotion = (durationMs = 3000): Promise<Blob> => {
    const canvas = recordingCanvas.value

    if (!canvas) {
        throw new Error('Canvas belum siap')
    }

    const stream = canvas.captureStream(15)

    const mimeType = 'video/webm;codecs=vp8'

    if (!MediaRecorder.isTypeSupported(mimeType)) {
        stream.getTracks().forEach(track => track.stop())
        throw new Error('WebM VP8 tidak didukung')
    }

    const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
    })

    const chunks: Blob[] = []

    return new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data)
        }

        recorder.onerror = () => {
            stream.getTracks().forEach(track => track.stop())
            reject(new Error('Gagal merekam Motion Photo'))
        }

        recorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop())

            resolve(new Blob(chunks, { type: mimeType }))
        }

        recorder.start()

        window.setTimeout(() => {
            if (recorder.state === 'recording') {
                recorder.stop()
            }
        }, durationMs)
    })
}

/* =========================================================
   Manual connect (fallback)
   ========================================================= */
const handleManualConnect = async () => {
    manualFallback.value = false
    await initializeCamera()
}

/* =========================================================
   Expose API untuk parent (Capture.vue)
   ========================================================= */
defineExpose({
    captureImage: async () => {
        if (!connected.value) {
            throw new Error('Kamera belum terhubung.')
        }

        const res = await captureFromCamera()
        return {
            base64: res.data,
            mimeType: 'image/jpeg',
            filename: `capture-${Date.now()}.jpg`,
        }
    },
    isConnected: () => connected.value,
    disconnectCamera: () => disconnect(),
    reconnect: () => initializeCamera(),
    recordMotion,
})

/* =========================================================
   Lifecycle
   ========================================================= */
onMounted(() => {
    if (props.autoStart) {
        initializeCamera()
    }
})

onBeforeUnmount(() => {
    stopPreview()

    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
    }
})

/* =========================================================
   Computed — apa yang ditampilkan
   ========================================================= */
const isLoading = computed(
    () => autoConnecting.value || detecting.value || connecting.value
)

const showEmptyState = computed(() => !livePreviewUrl.value && !isLoading.value)
</script>

<template>
    <div class="relative flex h-full w-full items-center justify-center"
        :class="orientation === 'landscape' ? 'aspect-video' : 'aspect-[3/4]'">

        <!-- Canvas untuk recording -->
        <canvas v-if="livePreviewUrl" ref="recordingCanvas" class="pointer-events-none absolute -left-[99999px]"
            width="1920" height="1080" />

        <!-- ============ LIVE PREVIEW ============ -->
        <img v-if="livePreviewUrl" ref="previewImage" :src="livePreviewUrl" alt="Live preview"
            class="h-full w-full object-contain" />

        <!-- ============ LOADING STATE ============ -->
        <div v-else-if="isLoading" class="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div class="h-12 w-12 animate-spin border-4 border-lime/30 border-t-lime" />
            <div>
                <p class="display text-base font-bold text-white">
                    {{
                        detecting
                            ? 'Mencari kamera...'
                            : connecting
                                ? 'Menghubungkan...'
                                : 'Menyiapkan preview...'
                    }}
                </p>
                <p class="mt-1 text-[12.5px] leading-5 text-white/60">
                    Mohon tunggu sebentar
                </p>
            </div>
        </div>

        <!-- ============ EMPTY / ERROR STATE ============ -->
        <div v-else-if="showEmptyState" class="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span class="grid h-20 w-20 place-items-center border-2 border-lime bg-lime/15">
                <CameraIcon class="h-10 w-10 text-lime" />
            </span>

            <!-- Error message -->
            <div v-if="connectionError">
                <p class="display text-base font-bold text-white">
                    Gagal Terhubung
                </p>
                <p class="mt-1 max-w-sm text-[12.5px] leading-5 text-white/60">
                    {{ connectionError }}
                </p>
            </div>

            <!-- No camera selected -->
            <div v-else-if="!selectedCameraId">
                <p class="display text-base font-bold text-white">
                    Kamera Belum Dipilih
                </p>
                <p class="mt-1 max-w-sm text-[12.5px] leading-5 text-white/60">
                    Buka Pengaturan → tab Kamera untuk memilih kamera.
                </p>
            </div>

            <!-- Generic fallback -->
            <div v-else>
                <p class="display text-base font-bold text-white">
                    Kamera Tidak Siap
                </p>
                <p class="mt-1 max-w-sm text-[12.5px] leading-5 text-white/60">
                    Klik tombol di bawah untuk mencoba lagi.
                </p>
            </div>

            <!-- Manual connect button (fallback) -->
            <button type="button"
                class="display inline-flex items-center gap-3 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all duration-150 active:translate-y-1 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-60"
                :disabled="isLoading" @click="handleManualConnect">
                <ArrowPathIcon class="h-5 w-5" :class="isLoading && 'animate-spin'" />
                {{
                    autoConnecting
                        ? 'Menghubungkan...'
                        : 'Coba Hubungkan'
                }}
            </button>
        </div>

        <!-- ============ LIVE BADGE ============ -->
        <div v-if="connected && livePreviewUrl"
            class="absolute left-3 top-3 inline-flex items-center gap-1.5 border border-lime/40 bg-ink/70 px-2 py-0.5 backdrop-blur-sm">
            <span class="h-2 w-2 animate-pulse rounded-full bg-rose" />
            <span class="text-[10px] font-bold uppercase tracking-wider text-lime">
                LIVE
            </span>
        </div>

        <!-- ============ CAMERA MODEL BADGE (optional) ============ -->
        <div v-if="connected && connectedModel && livePreviewUrl"
            class="absolute right-3 top-3 inline-flex items-center gap-1.5 border border-white/20 bg-ink/70 px-2 py-0.5 backdrop-blur-sm">
            <CameraIcon class="h-3 w-3 text-white/60" />
            <span class="text-[10px] font-semibold text-white/80">
                {{ connectedModel }}
            </span>
        </div>
    </div>
</template>