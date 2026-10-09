<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import Modal from '@/components/UI/Modal.vue'
import Button from '@/components/UI/Button.vue'
import Input from '@/components/UI/Input.vue'
import Badge from '@/components/UI/Badge.vue'
import {
    Cog6ToothIcon,
    CameraIcon,
    PrinterIcon,
    ArrowsRightLeftIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    PhotoIcon,
    PlayIcon,
    XMarkIcon,
    InformationCircleIcon,
    ArrowPathIcon,
} from '@heroicons/vue/24/outline'
import { photoboothApi } from '@/lib/api'
import { useCamera } from '@/composables/useCamera'
import {
    useActiveEvent,
} from '@/composables/useEvents'

// import PrintSettingsModal from '@/components/Start/PrintSettingsModal.vue'

import { usePrint } from '@/composables/usePrint'

// const { settings: printSettings } = usePrint()
// const showPrintModal = ref(false)

/* =========================================================
   Props & Emits
   ========================================================= */
const props = withDefaults(
    defineProps<{
        show: boolean
        activeEvent: any | null
        cameraSettings?: Record<string, any>
        availableEventsCount?: number
    }>(),
    {
        cameraSettings: () => ({}),
        availableEventsCount: 0,
    }
)

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'go-to-dashboard'): void
    (e: 'go-to-event-picker'): void
}>()

/* =========================================================
   TanStack Query
   ========================================================= */
const queryClient = useQueryClient()

/* =========================================================
   Tabs
   ========================================================= */
type TabKey = 'general' | 'camera' | 'print'

const activeTab = ref<TabKey>('general')

const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'general', label: 'Umum', icon: Cog6ToothIcon },
    { key: 'camera', label: 'Kamera', icon: CameraIcon },
    { key: 'print', label: 'Cetak', icon: PrinterIcon },
]

/* Reset tab ke 'general' setiap modal dibuka */
watch(
    () => props.show,
    (open) => {
        if (open) activeTab.value = 'general'
    }
)

/* =========================================================
   ============ TAB: GENERAL ============
   ========================================================= */
const generalForm = ref({
    title: '',
    subtitle: '',
    background: null as File | null,
})

const backgroundPreview = ref<string | null>(null)

/* Sync dari activeEvent */
watch(
    () => props.activeEvent,
    (evt) => {
        if (!evt) return
        generalForm.value.title = evt.title ?? ''
        generalForm.value.subtitle = evt.subtitle ?? ''
        generalForm.value.background = null
        backgroundPreview.value = evt.background_url ?? null
    },
    { immediate: true }
)

const handleBackgroundChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    generalForm.value.background = file

    const reader = new FileReader()
    reader.onload = (ev) => {
        backgroundPreview.value = ev.target?.result as string
    }
    reader.readAsDataURL(file)
}

const generalMutation = useMutation({
    mutationFn: async () => {
        const fd = new FormData()
        fd.append('title', generalForm.value.title)
        fd.append('subtitle', generalForm.value.subtitle ?? '')
        if (generalForm.value.background) {
            fd.append('background', generalForm.value.background)
        }
        // fd.append('_method', 'PUT')
        return photoboothApi.saveGeneralSettings(fd)
    },
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ['photobooth', 'active-event'],
        })
        queryClient.invalidateQueries({
            queryKey: ['photobooth', 'events'],
        })
    },
})

const generalError = ref('')
const generalSuccess = ref(false)

const submitGeneral = () => {
    generalError.value = ''
    generalSuccess.value = false

    if (!generalForm.value.title?.trim()) {
        generalError.value = 'Judul event wajib diisi.'
        return
    }

    generalMutation.mutate(undefined, {
        onSuccess: () => {
            generalSuccess.value = true
            setTimeout(() => (generalSuccess.value = false), 2500)
        },
        onError: (err: any) => {
            generalError.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal menyimpan pengaturan.'
        },
    })
}

const resetGeneral = () => {
    const evt = props.activeEvent
    generalForm.value.title = evt?.title ?? ''
    generalForm.value.subtitle = evt?.subtitle ?? ''
    generalForm.value.background = null
    backgroundPreview.value = evt?.background_url ?? null
    generalError.value = ''
    generalSuccess.value = false
}

const generalProcessing = computed(() => generalMutation.isPending.value)

/* =========================================================
   ============ CAMERA ============
   ========================================================= */
const {
    detecting,
    connecting,
    connected,
    connectedModel,
    cameras,
    livePreviewUrl,
    error: cameraError,
    detect,
    connect,
    connectById,
    disconnect,
    capture: capturePhoto,
    getConfig: getCameraConfig,
    setConfigValue,
    startPreview,
    stopPreview,
    selectedCameraId,
    forgetSelectedCamera
} = useCamera()

/* =========================================================
   Camera config tree
   ========================================================= */
const cameraConfig = ref<any>(null)
const loadingCameraConfig = ref(false)

let cameraRequestId = 0
let closing = false
let cameraChangeInProgress = false

/* =========================================================
   Auto-detect + auto-connect saat modal dibuka ke tab camera
   ========================================================= */
let initInFlight = false

watch(
    () => [props.show, activeTab.value] as const,
    async ([show, tab], [wasShow, wasTab]) => {
        if (!show || tab !== 'camera') {
            cameraRequestId++
            await stopPreview()
            return
        }

        // inisialisasi hanya saat transisi masuk ke tab/modal camera
        if ((!wasShow || wasTab !== 'camera') && !initInFlight) {
            initInFlight = true
            try {
                await initializeCamera()
            } finally {
                initInFlight = false
            }
        }
    },
    { immediate: true }
)

/* =========================================================
   Handle camera dropdown change
   ========================================================= */
const handleCameraChange = async (cameraId: string) => {
    if (!cameraId || closing || cameraChangeInProgress) return
    if (cameraId === selectedCameraId.value && connected.value) return

    cameraChangeInProgress = true
    cameraRequestId++
    const requestId = cameraRequestId

    try {
        await stopPreview()
        cameraConfig.value = null

        // Disconnect dulu KALAU ada kamera aktif (BUKAN "if connected.value")
        // — `connected.value` bisa stale kalau preview sudah di-stop.
        await disconnect()

        if (closing || !props.show || requestId !== cameraRequestId) return

        const idx = cameras.value.findIndex((c) => c.id === cameraId)
        if (idx < 0) {
            error.value = `Camera ${cameraId} tidak ditemukan.`
            return
        }

        await connect(idx)
        if (closing || !props.show || !connected.value) return

        await loadCameraConfig()
        if (!closing && props.show && connected.value) startPreview()
    } catch (err) {
        console.error('Gagal mengganti kamera:', err)
        error.value = (err as Error)?.message ?? 'Gagal mengganti kamera.'
    } finally {
        cameraChangeInProgress = false
    }
}


/* =========================================================
   Config keys yang ditampilkan (dari camera)
   ========================================================= */
interface ConfigNode {
    key: string
    label: string
    current: string | number | null
    choices: string[]
    writable: boolean
}

interface CameraConfigDefinition {
    key: string
    label: string
    path: string[]
}

const CAMERA_CONFIG_KEYS: CameraConfigDefinition[] = [
    {
        key: 'aperture',
        label: 'Aperture',
        path: ['main', 'children', 'capturesettings', 'children', 'aperture'],
    },
    {
        key: 'shutterspeed',
        label: 'Shutter Speed',
        path: ['main', 'children', 'capturesettings', 'children', 'shutterspeed'],
    },
    {
        key: 'iso',
        label: 'ISO',
        path: ['main', 'children', 'imgsettings', 'children', 'iso'],
    },
    {
        key: 'whitebalance',
        label: 'White Balance',
        path: ['main', 'children', 'imgsettings', 'children', 'whitebalance'],
    },
]

interface ConfigNode {
    key: string
    label: string
    current: string | number | null
    choices: string[]
    writable: boolean
}

function getConfigByPath(config: any, path: string[]): any {
    return path.reduce((current, segment) => {
        if (current == null) return undefined
        return current[segment]
    }, config)
}

const availableConfigs = computed<ConfigNode[]>(() => {
    const config = cameraConfig.value

    if (!config) return []

    return CAMERA_CONFIG_KEYS.flatMap((definition) => {
        const node = getConfigByPath(config, definition.path)

        if (!node) return []

        const rawChoices =
            Array.isArray(node.choices)
                ? node.choices
                : Array.isArray(node.choices?.values)
                    ? node.choices.values
                    : Array.isArray(node.values)
                        ? node.values
                        : []

        return [
            {
                key: definition.key,
                label: definition.label,
                current: node.value ?? node.current ?? null,
                choices: rawChoices.map(String),
                writable: node.readonly !== true,
            },
        ]
    })
})

/* =========================================================
   Test capture overlay
   ========================================================= */
const testStatus = ref<'idle' | 'capturing' | 'success' | 'error'>('idle')
const testImageUrl = ref<string | null>(null)
const testOverlayOpen = ref(false)
const testOverlayRemaining = ref(0)
const testOverlayDuration = ref(5)
let testOverlayInterval: ReturnType<typeof setInterval> | null = null

const testOverlayPercent = computed(() => {
    if (testOverlayDuration.value <= 0) return 0
    return (testOverlayRemaining.value / testOverlayDuration.value) * 100
})

const startTestOverlay = () => {
    stopTestOverlay()
    testOverlayOpen.value = true
    testOverlayDuration.value = 5
    testOverlayRemaining.value = 5

    testOverlayInterval = setInterval(() => {
        if (testOverlayRemaining.value > 0) {
            testOverlayRemaining.value--
        }
        if (testOverlayRemaining.value <= 0) {
            stopTestOverlay()
        }
    }, 1000)
}

const stopTestOverlay = () => {
    if (testOverlayInterval) {
        clearInterval(testOverlayInterval)
        testOverlayInterval = null
    }
    testOverlayOpen.value = false
    testOverlayRemaining.value = 0
}

const testCapture = async () => {
    if (testStatus.value === 'capturing' || !connected.value) return

    testStatus.value = 'capturing'
    testImageUrl.value = null

    try {
        const res = await capturePhoto()
        testImageUrl.value = res.data
        testStatus.value = 'success'
        startTestOverlay()
    } catch (err) {
        console.error('Test capture failed:', err)
        testStatus.value = 'error'
    }
}

/* =========================================================
   Update config (dropdown onchange)
   ========================================================= */
const updateCameraConfig = async (
    key: string,
    value: string,
) => {
    if (!connected.value || !value || closing) return

    try {
        await setConfigValue(key, String(value))
        await loadCameraConfig()
    } catch (err) {
        console.error(`Failed to set ${key}:`, err)
    }
}

/* =========================================================
   Lifecycle
   ========================================================= */
// watch(
//     () => props.show,
//     (open) => {
//         if (!open) {
//             stopPreview()
//         }
//     }
// )

onBeforeUnmount(() => {
    stopPreview()
    stopTestOverlay()
})

/* =========================================================
   Lifecycle — pause preview kalau modal ditutup
   ========================================================= */
// watch(
//     () => props.show,
//     (open) => {
//         if (!open) {
//             stopPreview()
//         } else if (connected.value) {
//             startPreview()
//         }
//     }
// )

const { setDefaultEvent } = useActiveEvent()

const openEventPicker = () => {
    emit('go-to-event-picker')
}

/* =========================================================
   ============ TAB: PRINT ============
   ========================================================= */
const {
    printers,
    loading: printLoading,
    printing,
    error: printError,
    settings: printSettings,
    loadPrinters,
    updateSettings: updatePrintSettings,
    resetSettings: resetPrintSettings,
} = usePrint()

/* Paper sizes (mm) untuk preview */
interface DetectedPaper {
    id: string
    name: string
    widthMicrons: number | null
    heightMicrons: number | null
    source: 'driver'
}

interface DriverOptionChoice {
    value: string
    label: string
}

interface DriverOption {
    id: string
    label: string
    choices: DriverOptionChoice[]
    defaultValue?: string
}

interface DetectedPrinterCapabilities {
    printerName: string
    platform: string
    source: 'windows-driver' | 'cups-driver'
    papers: DetectedPaper[]
    options?: DriverOption[]
    warning?: string
}

const PAPER_SIZES: Record<
    string,
    { width: number; height: number; label: string }
> = {
    '4x6': { width: 101.6, height: 152.4, label: '4×6 inci' },
    '5x7': { width: 127, height: 177.8, label: '5×7 inci' },
    A4: { width: 210, height: 297, label: 'A4' },
    Letter: { width: 215.9, height: 279.4, label: 'Letter' },
}

const detectedPapers = ref<DetectedPaper[]>([])
const capabilitiesLoading = ref(false)
const capabilitiesError = ref('')
const capabilitiesWarning = ref('')
const capabilityRequestId = ref(0)

const detectedPaperOptions = computed(() =>
    detectedPapers.value.filter(
        (paper) =>
            paper.widthMicrons !== null &&
            paper.heightMicrons !== null &&
            paper.widthMicrons > 0 &&
            paper.heightMicrons > 0,
    ),
)

const detectedDriverOptions = ref<DriverOption[]>([])

const driverOptionIds = {
    media: 'EPIJ_Medi',
    quality: 'EPIJ_Qual',
    borderless: 'EPIJ_Bdls',
} as const

const getDriverOption = (id: string) =>
    computed(() =>
        detectedDriverOptions.value.find(
            (option) => option.id === id,
        ),
    )

const mediaOption = getDriverOption(driverOptionIds.media)
const qualityOption = getDriverOption(driverOptionIds.quality)
const borderlessOption = getDriverOption(driverOptionIds.borderless)

function updateDriverOption(id: string, value: string) {
    const option = detectedDriverOptions.value.find(
        (item) => item.id === id,
    )

    if (!option?.choices.some((choice) => choice.value === value)) {
        return
    }

    updatePrintSettings({
        driverOptions: {
            ...(printSettings.value.driverOptions ?? {}),
            [id]: value,
        },
    })
}

const availablePaperOptions = computed(() => {
    const options: Record<
        string,
        { width: number; height: number; label: string }
    > = { ...PAPER_SIZES }

    for (const paper of detectedPaperOptions.value) {
        options[paper.id] = {
            width: paper.widthMicrons! / 1000,
            height: paper.heightMicrons! / 1000,
            label: `${paper.name} (${(
                paper.widthMicrons! / 1000
            ).toFixed(1)} × ${(
                paper.heightMicrons! / 1000
            ).toFixed(1)} mm)`,
        }
    }

    return options
})

const currentPaper = computed(() => {
    const detected = detectedPaperOptions.value.find(
        (paper) => paper.id === printSettings.value.pageSize,
    )

    if (detected) {
        return {
            width: detected.widthMicrons! / 1000,
            height: detected.heightMicrons! / 1000,
            label: detected.name,
        }
    }

    return (
        PAPER_SIZES[printSettings.value.pageSize] ??
        PAPER_SIZES['4x6']
    )
})

async function loadPrinterCapabilities(printerName: string) {
    const requestId = ++capabilityRequestId.value

    detectedPapers.value = []
    detectedDriverOptions.value = []
    capabilitiesError.value = ''
    capabilitiesWarning.value = ''

    if (!printerName) {
        capabilitiesLoading.value = false
        return
    }

    capabilitiesLoading.value = true

    try {
        const result = await window.electron.print.getPrinterCapabilities(
            printerName,
        ) as {
            success: boolean
            capabilities: DetectedPrinterCapabilities | null
            error?: string
        }

        if (requestId !== capabilityRequestId.value) return

        console.log("DAMN BRO", result)

        if (!result.success || !result.capabilities) {
            throw new Error(
                result.error ?? 'Gagal membaca ukuran kertas dari driver.',
            )
        }

        detectedPapers.value = result.capabilities.papers
        detectedDriverOptions.value =
            result.capabilities.options ?? []
        capabilitiesWarning.value =
            result.capabilities.warning ?? ''
    } catch (err) {
        if (requestId !== capabilityRequestId.value) return

        capabilitiesError.value =
            err instanceof Error
                ? err.message
                : 'Gagal membaca kemampuan printer.'
    } finally {
        if (requestId === capabilityRequestId.value) {
            capabilitiesLoading.value = false
        }
    }
}

function selectPaper(paperId: string) {
    updatePrintSettings({ pageSize: paperId })
}

watch(
    () => printSettings.value.deviceName,
    (printerName) => {
        void loadPrinterCapabilities(printerName)
    },
    { immediate: true },
)

/* ============ Preview dimensions ============ */
const PREVIEW_MAX_WIDTH = 240

const printPreviewDimensions = computed(() => {
    const paper = currentPaper.value
    const aspect = paper.width / paper.height
    const width = PREVIEW_MAX_WIDTH
    const height = width / aspect
    return { width, height }
})

const printScaledDimensions = computed(() => {
    const s = printSettings.value.scaleFactor / 100
    return {
        width: printPreviewDimensions.value.width * s,
        height: printPreviewDimensions.value.height * s,
    }
})

const printMarginDisplay = computed(() => {
    const paper = currentPaper.value
    const displayWidthPx = printPreviewDimensions.value.width
    const mmToPx = displayWidthPx / paper.width

    return {
        top: printSettings.value.marginTop * mmToPx,
        bottom: printSettings.value.marginBottom * mmToPx,
        left: printSettings.value.marginLeft * mmToPx,
        right: printSettings.value.marginRight * mmToPx,
    }
})

/* Load printers saat tab Print dibuka */
watch(activeTab, async (tab) => {
    if (tab === 'print' && printers.value.length === 0) {
        await loadPrinters()
    }
})


async function loadCameraConfig() {
    if (closing || !props.show || !connected.value) return

    const requestId = ++cameraRequestId
    loadingCameraConfig.value = true

    try {
        const config = await getCameraConfig()

        if (
            closing ||
            !props.show ||
            requestId !== cameraRequestId
        ) {
            return
        }

        cameraConfig.value = config
    } catch (err) {
        if (closing || requestId !== cameraRequestId) return

        cameraConfig.value = null
        console.error('Failed to load camera config:', err)
    } finally {
        if (requestId === cameraRequestId) {
            loadingCameraConfig.value = false
        }
    }
}

async function initializeCamera() {
    if (closing || !props.show || activeTab.value !== 'camera' || cameraChangeInProgress) return

    try {
        if (!connected.value) {
            await detect()
            if (!props.show || activeTab.value !== 'camera') return
            if (cameras.value.length === 0) return

            const savedId = selectedCameraId.value
            const hasSaved = !!savedId && cameras.value.some(c => c.id === savedId)

            if (hasSaved) {
                await connectById(savedId!)
            } else {
                if (savedId) forgetSelectedCamera()
                await connect(0)
            }
        }

        // Cek sekali lagi SETELAH semua await
        if (closing || !props.show || activeTab.value !== 'camera') return
        if (!connected.value) return

        await loadCameraConfig()

        if (!closing && props.show && activeTab.value === 'camera' && connected.value) {
            startPreview()
        }
    } catch (err) {
        console.error('Gagal menginisialisasi kamera:', err)
    }
}


// set closing true saat modal mau ditutup
const handleClose = () => {
    if (closing) return
    closing = true
    cameraRequestId++
    stopPreview()
    stopTestOverlay()
    cameraConfig.value = null
    emit('close')
}

// reset closing saat modal dibuka lagi
watch(
    () => props.show,
    (open) => {
        if (open) {
            closing = false
            return
        }
        cameraRequestId++
        stopPreview()
        stopTestOverlay()
        cameraConfig.value = null
    }
)

// const handleClose = () => {
//     stopPreview()
//     stopTestOverlay()
//     cameraConfig.value = null

//     emit('close')
// }

onBeforeUnmount(() => {
    cameraRequestId++
    stopPreview()
    stopTestOverlay()

    // Fallback jika komponen dilepas tanpa melalui handleClose().
    // if (connected.value) {
    //     void disconnect().catch((err) => {
    //         console.error(
    //             'Gagal disconnect kamera saat unmount:',
    //             err,
    //         )
    //     })
    // }
})
</script>

<template>
    <Modal :show="show" title="Pengaturan Kiosk" subtitle="Konfigurasi umum, kamera, dan cetak" max-width="4xl"
        :closeable="true" @close="handleClose">
        <!-- ============================================================
             TABS
             ============================================================ -->
        <div class="border-b-2 border-ink">
            <div class="flex" role="tablist">
                <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
                    class="flex items-center gap-2 border-r-2 border-ink px-5 py-3 text-[13px] font-bold transition-colors last:border-r-0"
                    :class="activeTab === tab.key
                        ? 'bg-ink text-white'
                        : 'bg-paper-soft text-ink hover:bg-lime'
                        " :aria-selected="activeTab === tab.key" @click="activeTab = tab.key">
                    <component :is="tab.icon" class="h-4 w-4" />
                    {{ tab.label }}
                </button>
            </div>
        </div>

        <!-- ============================================================
             TAB CONTENT
             ============================================================ -->
        <div class="max-h-[60vh] overflow-y-auto px-5 py-5">
            <!-- ====================================================
                 TAB: GENERAL
                 ==================================================== -->
            <div v-if="activeTab === 'general'" class="space-y-5">
                <div v-if="!activeEvent" class="flex items-start gap-3 border-2 border-ink bg-amber p-4">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] text-ink/80">
                        Belum ada event aktif. Pilih event dulu untuk mengubah
                        pengaturan.
                    </p>
                </div>

                <template v-else>
                    <Input v-model="generalForm.title" label="Judul Event" placeholder="cth. Wedding Sarah & John"
                        :error="generalError && !generalForm.title ? generalError : ''" :required="true" />

                    <Input v-model="generalForm.subtitle" label="Subtitle" placeholder="cth. 21 September 2026" />

                    <!-- Background upload -->
                    <div>
                        <label class="eyebrow mb-2 block text-ink/60">
                            Background Event
                        </label>

                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
                            <div class="relative aspect-[3/4] overflow-hidden border-2 border-ink bg-paper">
                                <img v-if="backgroundPreview" :src="backgroundPreview" alt="Preview"
                                    class="h-full w-full object-cover" />
                                <div v-else class="grid h-full w-full place-items-center">
                                    <PhotoIcon class="h-8 w-8 text-ink/30" />
                                </div>
                            </div>

                            <div class="space-y-3">
                                <input type="file" accept="image/*" class="file-input w-full"
                                    @change="handleBackgroundChange" />
                                <p class="text-[11.5px] leading-5 text-ink/55">
                                    Rekomendasi: 1080×1920 (portrait) atau 1920×1080
                                    (landscape). Maks 5MB.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Feedback -->
                    <div v-if="generalError" class="flex items-start gap-2 border-2 border-ink bg-rose p-3">
                        <XCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                        <p class="text-[12px] leading-5 text-ink">
                            {{ generalError }}
                        </p>
                    </div>

                    <div v-if="generalSuccess" class="flex items-start gap-2 border-2 border-ink bg-lime p-3">
                        <CheckCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                        <p class="text-[12px] leading-5 text-ink">
                            Pengaturan umum berhasil disimpan.
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="flex flex-wrap justify-end gap-2 border-t-2 border-ink pt-4">
                        <Button type="button" variant="paper" size="sm" :disabled="generalProcessing"
                            @click="resetGeneral">
                            Reset
                        </Button>
                        <Button type="button" variant="primary" size="sm" :icon="CheckCircleIcon"
                            :loading="generalProcessing" :disabled="generalProcessing" @click="submitGeneral">
                            {{ generalProcessing ? 'Menyimpan...' : 'Simpan Umum' }}
                        </Button>
                    </div>
                </template>
            </div>

            <!-- ====================================================
     TAB: CAMERA
     ==================================================== -->
            <div v-else-if="activeTab === 'camera'" class="space-y-5">
                <!-- Error banner -->
                <div v-if="cameraError" class="flex items-start gap-3 border-2 border-ink bg-rose p-4">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <div class="min-w-0">
                        <p class="display text-[13.5px] font-bold text-ink">
                            Kamera Bermasalah
                        </p>
                        <p class="mt-1 text-[12px] leading-5 text-ink/70">
                            {{ cameraError }}
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <!-- ============ LEFT: Live Preview + Test Overlay ============ -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <p class="eyebrow text-ink/60">Live Preview</p>
                            <Badge :tone="connected ? 'lime' : 'grey'" :dot="true">
                                {{
                                    connected
                                        ? connectedModel ?? 'Terhubung'
                                        : 'Belum terhubung'
                                }}
                            </Badge>
                        </div>

                        <!-- Preview container -->
                        <div class="relative aspect-[4/3] overflow-hidden border-2 border-ink bg-ink">
                            <!-- Live preview -->
                            <img v-if="livePreviewUrl" :src="livePreviewUrl" alt="Live preview"
                                class="h-full w-full object-contain" />

                            <!-- Empty state -->
                            <div v-else class="grid h-full w-full place-items-center text-center">
                                <div class="p-6">
                                    <CameraIcon class="mx-auto h-12 w-12 text-white/30" />
                                    <p class="mt-3 text-[13px] text-white/60">
                                        {{
                                            detecting
                                                ? 'Mendeteksi kamera...'
                                                : connecting
                                                    ? 'Menghubungkan...'
                                                    : cameras.length === 0
                                                        ? 'Tidak ada kamera terdeteksi'
                                                        : 'Pilih kamera untuk memulai preview'
                                        }}
                                    </p>
                                </div>
                            </div>

                            <!-- LIVE badge -->
                            <div v-if="connected && livePreviewUrl && !testOverlayOpen"
                                class="absolute left-3 top-3 inline-flex items-center gap-1.5 border border-lime/40 bg-ink/70 px-2 py-0.5 backdrop-blur-sm">
                                <span class="h-2 w-2 animate-pulse rounded-full bg-rose" />
                                <span class="text-[10px] font-bold uppercase tracking-wider text-lime">
                                    LIVE
                                </span>
                            </div>

                            <!-- Test capture overlay -->
                            <Transition enter-active-class="transition duration-300 ease-out"
                                enter-from-class="opacity-0" enter-to-class="opacity-100"
                                leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100"
                                leave-to-class="opacity-0">
                                <div v-if="testOverlayOpen && testImageUrl"
                                    class="absolute inset-0 z-20 flex flex-col bg-ink">
                                    <!-- TOP PROGRESS BAR -->
                                    <div class="shrink-0 border-b-2 border-ink bg-paper-soft">
                                        <div class="h-1.5 w-full bg-paper" role="progressbar"
                                            :aria-valuenow="testOverlayRemaining" aria-valuemin="0"
                                            :aria-valuemax="testOverlayDuration">
                                            <div class="h-full bg-blue transition-[width] duration-1000 ease-linear"
                                                :style="{
                                                    width: testOverlayPercent + '%',
                                                }" />
                                        </div>

                                        <div class="flex items-center justify-between gap-3 px-4 py-2.5">
                                            <div class="flex min-w-0 items-center gap-2.5">
                                                <span
                                                    class="grid h-7 w-7 shrink-0 place-items-center border-2 border-ink bg-lime">
                                                    <CheckCircleIcon class="h-3.5 w-3.5 text-ink" />
                                                </span>
                                                <p class="display truncate text-[12.5px] font-bold text-ink">
                                                    Hasil Test Kamera
                                                </p>
                                            </div>

                                            <div class="flex shrink-0 items-center gap-2">
                                                <span class="display text-base font-bold tabular-nums text-ink">
                                                    {{ testOverlayRemaining }}s
                                                </span>
                                                <button type="button"
                                                    class="grid h-7 w-7 place-items-center border-2 border-ink bg-paper-soft transition-colors hover:bg-lime"
                                                    aria-label="Tutup" @click="stopTestOverlay">
                                                    <XMarkIcon class="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- PHOTO -->
                                    <div class="relative grid min-h-0 flex-1 place-items-center p-3">
                                        <img :src="testImageUrl" alt="Test capture result"
                                            class="max-h-full max-w-full object-contain" />
                                    </div>

                                    <!-- BOTTOM HINT -->
                                    <div class="shrink-0 border-t-2 border-ink bg-paper-soft px-4 py-2 text-center">
                                        <p class="text-[10.5px] uppercase tracking-[.2em] text-ink/45">
                                            Otomatis tutup dalam
                                            {{ testOverlayRemaining }} detik
                                        </p>
                                    </div>
                                </div>
                            </Transition>

                            <!-- Test button (tengah) -->
                            <div v-if="connected && !testOverlayOpen"
                                class="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                                <button type="button"
                                    class="pointer-events-auto display inline-flex items-center gap-3 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all duration-150 active:translate-y-1 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-60"
                                    :disabled="testStatus === 'capturing'" @click="testCapture">
                                    <PlayIcon class="h-5 w-5" :class="testStatus === 'capturing' && 'animate-pulse'
                                        " />
                                    {{
                                        testStatus === 'capturing'
                                            ? 'Mengambil...'
                                            : 'Tes Kamera'
                                    }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- ============ RIGHT: Dynamic Config ============ -->
                    <div class="space-y-4">
                        <!-- ========== CAMERA DROPDOWN ========== -->
                        <div>
                            <div class="mb-2 flex items-center justify-between">
                                <label class="eyebrow text-ink/60">Kamera</label>
                                <button type="button"
                                    class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue hover:underline disabled:opacity-50"
                                    :disabled="detecting" @click="detect">
                                    <ArrowPathIcon class="h-3 w-3" :class="detecting && 'animate-spin'" />
                                    {{ detecting ? 'Mendeteksi...' : 'Refresh' }}
                                </button>
                            </div>

                            <!-- Loading -->
                            <div v-if="detecting && cameras.length === 0"
                                class="flex items-center gap-2 border-2 border-ink bg-paper-soft px-3 py-2.5">
                                <div class="h-4 w-4 animate-spin border-2 border-ink/20 border-t-ink" />
                                <span class="text-[12.5px] text-ink/60">
                                    Mencari kamera...
                                </span>
                            </div>

                            <!-- No cameras -->
                            <div v-else-if="cameras.length === 0"
                                class="flex items-start gap-2 border-2 border-ink bg-amber p-3">
                                <ExclamationTriangleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                                <p class="text-[12px] leading-5 text-ink/80">
                                    Tidak ada kamera terdeteksi. Pastikan kamera sudah
                                    tercolok & dalam mode PTP.
                                </p>
                            </div>

                            <!-- Dropdown -->
                            <select v-else :value="selectedCameraId ?? ''"
                                class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13px] text-ink focus:border-blue focus:outline-none"
                                :disabled="connecting" @change="
                                    handleCameraChange(
                                        ($event.target as HTMLSelectElement).value
                                    )
                                    ">
                                <option value="" disabled>Pilih kamera</option>
                                <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
                                    {{ cam.model }}
                                </option>
                            </select>
                            <p v-if="connecting" class="mt-1.5 text-[11.5px] text-ink/55">
                                Menghubungkan ke kamera...
                            </p>
                        </div>

                        <!-- ========== CONFIG DROPDOWNS ========== -->
                        <!-- Loading config -->
                        <div v-if="connected && !cameraConfig"
                            class="flex items-center gap-2 border-2 border-ink bg-paper-soft px-3 py-2.5">
                            <div class="h-4 w-4 animate-spin border-2 border-ink/20 border-t-ink" />
                            <span class="text-[12.5px] text-ink/60">
                                Memuat konfigurasi kamera...
                            </span>
                        </div>

                        <!-- Config tidak tersedia -->
                        <div v-else-if="connected && availableConfigs.length === 0"
                            class="flex items-start gap-2 border-2 border-ink/20 bg-paper-soft p-3">
                            <InformationCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/50" />
                            <p class="text-[11.5px] leading-5 text-ink/60">
                                Kamera tidak expose konfigurasi (ISO, Aperture, dll).
                            </p>
                        </div>

                        <!-- Config tidak connected -->
                        <div v-else-if="!connected"
                            class="flex items-start gap-2 border-2 border-ink/20 bg-paper-soft p-3">
                            <InformationCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/50" />
                            <p class="text-[11.5px] leading-5 text-ink/60">
                                Pilih kamera dulu untuk melihat konfigurasi.
                            </p>
                        </div>

                        <!-- Dynamic config dropdowns -->
                        <template v-else>
                            <div v-for="cfg in availableConfigs" :key="cfg.key" class="space-y-1.5">
                                <label class="eyebrow block text-ink/60">
                                    {{ cfg.label }}
                                </label>

                                <select :value="cfg.current ?? ''"
                                    class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13px] text-ink focus:border-blue focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    :disabled="!cfg.writable || cfg.choices.length === 0" @change="
                                        updateCameraConfig(
                                            cfg.key,
                                            ($event.target as HTMLSelectElement).value
                                        )
                                        ">
                                    <option v-if="cfg.choices.length === 0" :value="cfg.current ?? ''">
                                        {{ cfg.current ?? '(tidak ada opsi)' }}
                                    </option>
                                    <option v-for="opt in cfg.choices" :key="opt" :value="opt">
                                        {{ opt }}
                                    </option>
                                </select>
                            </div>
                        </template>

                        <!-- Info -->
                        <div class="flex items-start gap-2 border-2 border-ink/20 bg-paper-soft p-3">
                            <InformationCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/50" />
                            <p class="text-[11.5px] leading-5 text-ink/60">
                                Konfigurasi diambil langsung dari kamera. Perubahan
                                dikirim langsung ke kamera saat dipilih.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ====================================================
     TAB: PRINT
     ==================================================== -->
            <div v-else-if="activeTab === 'print'" class="space-y-5">
                <div class="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <!-- ============ LEFT: Preview ============ -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <p class="eyebrow text-ink/60">Preview</p>
                            <Badge tone="grey">{{ currentPaper.label }}</Badge>
                        </div>

                        <!-- Preview canvas -->
                        <div class="flex justify-center border-2 border-ink bg-paper-soft p-4">
                            <div class="relative border-2 border-ink bg-white shadow-brutal-sm" :style="{
                                width: printPreviewDimensions.width + 'px',
                                height: printPreviewDimensions.height + 'px',
                            }">
                                <!-- Margin area -->
                                <div class="pointer-events-none absolute border-2 border-dashed border-blue/50" :style="{
                                    top: printMarginDisplay.top + 'px',
                                    left: printMarginDisplay.left + 'px',
                                    right: printMarginDisplay.right + 'px',
                                    bottom: printMarginDisplay.bottom + 'px',
                                }" />

                                <!-- Content placeholder -->
                                <div class="pointer-events-none absolute" :style="{
                                    top: '50%',
                                    left: '50%',
                                    width: printScaledDimensions.width + 'px',
                                    height: printScaledDimensions.height + 'px',
                                    transform: 'translate(-50%, -50%)',
                                }">
                                    <div
                                        class="grid h-full w-full place-items-center border border-dashed border-ink/30 bg-lime/20">
                                        <PhotoIcon class="h-8 w-8 text-ink/30" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Preview info -->
                        <div class="grid grid-cols-2 gap-2 text-[11.5px]">
                            <div class="border-2 border-ink/20 bg-paper-soft p-2.5">
                                <p class="eyebrow text-ink/50">Kertas</p>
                                <p class="display mt-0.5 font-bold text-ink">
                                    {{ currentPaper.width }} × {{ currentPaper.height }} mm
                                </p>
                            </div>
                            <div class="border-2 border-ink/20 bg-paper-soft p-2.5">
                                <p class="eyebrow text-ink/50">Skala</p>
                                <p class="display mt-0.5 font-bold text-ink">
                                    {{ printSettings.scaleFactor }}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- ============ RIGHT: Settings ============ -->
                    <div class="space-y-5">
                        <!-- Error banner -->
                        <div v-if="printError" class="flex items-start gap-2 border-2 border-ink bg-rose p-3">
                            <XCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                            <p class="text-[12px] leading-5 text-ink">
                                {{ printError }}
                            </p>
                        </div>

                        <!-- Printer -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                Printer
                            </label>
                            <div v-if="printLoading" class="text-[12.5px] text-ink/50">
                                Memuat printer...
                            </div>
                            <select v-else :value="printSettings.deviceName"
                                class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13.5px] text-ink focus:border-blue focus:outline-none"
                                @change="
                                    updatePrintSettings({
                                        deviceName: ($event.target as HTMLSelectElement).value,
                                    })
                                    ">
                                <option value="" disabled>Pilih printer</option>
                                <option v-for="p in printers" :key="p.name" :value="p.name">
                                    {{ p.displayName || p.name }}
                                    {{ p.isDefault ? '(Default)' : '' }}
                                </option>
                            </select>
                            <button type="button"
                                class="mt-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue hover:underline"
                                @click="loadPrinters">
                                <ArrowPathIcon class="h-3 w-3" />
                                Refresh printer
                            </button>
                        </div>


                        <!-- Paper Size: berdasarkan kemampuan driver -->
                        <div>
                            <div class="mb-2 flex items-center justify-between gap-2">
                                <label class="eyebrow text-ink/60">
                                    Ukuran Kertas
                                </label>

                                <button type="button"
                                    class="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-blue hover:underline disabled:opacity-50"
                                    :disabled="capabilitiesLoading || !printSettings.deviceName"
                                    @click="loadPrinterCapabilities(printSettings.deviceName)">
                                    <ArrowPathIcon class="h-3 w-3" :class="capabilitiesLoading && 'animate-spin'" />
                                    {{ capabilitiesLoading ? 'Membaca...' : 'Deteksi ulang' }}
                                </button>
                            </div>

                            <div v-if="capabilitiesLoading"
                                class="border-2 border-ink/20 bg-paper-soft p-3 text-[12px] text-ink/60">
                                Membaca ukuran kertas dari driver printer...
                            </div>

                            <div v-else-if="capabilitiesError"
                                class="border-2 border-ink bg-rose p-3 text-[12px] leading-5 text-ink">
                                {{ capabilitiesError }}
                            </div>

                            <div v-else-if="!printSettings.deviceName"
                                class="border-2 border-ink/20 bg-paper-soft p-3 text-[12px] text-ink/60">
                                Pilih printer terlebih dahulu.
                            </div>

                            <div v-else-if="detectedPaperOptions.length === 0"
                                class="border-2 border-ink bg-amber p-3 text-[12px] leading-5 text-ink">
                                Driver tidak memberikan ukuran kertas dengan dimensi yang dapat
                                dikenali. Ukuran standar di bawah bukan hasil deteksi driver.
                            </div>

                            <div v-else class="flex flex-wrap gap-2">
                                <button v-for="paper in detectedPaperOptions" :key="paper.id" type="button"
                                    class="display border-2 px-3 py-2 text-[12.5px] font-bold transition-colors" :class="printSettings.pageSize === paper.id
                                        ? 'border-ink bg-ink text-white'
                                        : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                        " @click="selectPaper(paper.id)">
                                    {{ paper.name }}
                                    <span class="ml-1 text-[10px] font-normal">
                                        {{ (paper.widthMicrons! / 1000).toFixed(1) }} ×
                                        {{ (paper.heightMicrons! / 1000).toFixed(1) }} mm
                                    </span>
                                </button>
                            </div>

                            <!-- Media Type dari driver -->
                            <div class="space-y-2">
                                <label class="eyebrow block text-ink/60">
                                    Jenis Kertas
                                </label>

                                <select v-if="mediaOption" :value="printSettings.driverOptions?.EPIJ_Medi ??
                                    mediaOption.defaultValue ??
                                    ''
                                    " class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13px] text-ink focus:border-blue focus:outline-none"
                                    @change="
                                        updateDriverOption(
                                            'EPIJ_Medi',
                                            ($event.target as HTMLSelectElement).value
                                        )
                                        ">
                                    <option v-for="choice in mediaOption.choices" :key="choice.value"
                                        :value="choice.value">
                                        {{ choice.label }}
                                    </option>
                                </select>

                                <p v-else class="text-[12px] text-ink/50">
                                    Opsi jenis kertas tidak tersedia dari driver.
                                </p>
                            </div>

                            <!-- Print Quality dari driver -->
                            <div class="space-y-2">
                                <label class="eyebrow block text-ink/60">
                                    Kualitas Cetak
                                </label>

                                <select v-if="qualityOption" :value="printSettings.driverOptions?.EPIJ_Qual ??
                                    qualityOption.defaultValue ??
                                    ''
                                    " class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13px] text-ink focus:border-blue focus:outline-none"
                                    @change="
                                        updateDriverOption(
                                            'EPIJ_Qual',
                                            ($event.target as HTMLSelectElement).value
                                        )
                                        ">
                                    <option v-for="choice in qualityOption.choices" :key="choice.value"
                                        :value="choice.value">
                                        {{ choice.label }}
                                    </option>
                                </select>

                                <p v-else class="text-[12px] text-ink/50">
                                    Opsi kualitas tidak tersedia dari driver.
                                </p>
                            </div>

                            <!-- Borderless dari driver -->
                            <div v-if="borderlessOption"
                                class="flex items-center justify-between gap-3 border-2 border-ink/20 bg-paper-soft p-3">
                                <div>
                                    <p class="text-[13px] font-bold text-ink">
                                        Cetak tanpa tepi
                                    </p>
                                    <p class="mt-1 text-[11px] text-ink/55">
                                        Mengikuti opsi borderless yang disediakan driver.
                                    </p>
                                </div>

                                <select :value="printSettings.driverOptions?.EPIJ_Bdls ??
                                    borderlessOption.defaultValue ??
                                    ''
                                    " class="max-w-36 border-2 border-ink bg-white px-2 py-2 text-[12px] text-ink focus:border-blue focus:outline-none"
                                    @change="
                                        updateDriverOption(
                                            'EPIJ_Bdls',
                                            ($event.target as HTMLSelectElement).value
                                        )
                                        ">
                                    <option v-for="choice in borderlessOption.choices" :key="choice.value"
                                        :value="choice.value">
                                        {{ choice.label }}
                                    </option>
                                </select>
                            </div>

                            <p v-if="capabilitiesWarning" class="mt-2 text-[11px] leading-5 text-ink/60">
                                {{ capabilitiesWarning }}
                            </p>
                        </div>


                        <!-- Margins -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                Margin (mm)
                            </label>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <p class="mb-1 text-[11px] text-ink/50">Atas</p>
                                    <Input :model-value="printSettings.marginTop" type="number" :min="0" :max="50"
                                        :step="0.5" @update:model-value="
                                            (v) => updatePrintSettings({ marginTop: Number(v) })
                                        " />
                                </div>
                                <div>
                                    <p class="mb-1 text-[11px] text-ink/50">Bawah</p>
                                    <Input :model-value="printSettings.marginBottom" type="number" :min="0" :max="50"
                                        :step="0.5" @update:model-value="
                                            (v) => updatePrintSettings({ marginBottom: Number(v) })
                                        " />
                                </div>
                                <div>
                                    <p class="mb-1 text-[11px] text-ink/50">Kiri</p>
                                    <Input :model-value="printSettings.marginLeft" type="number" :min="0" :max="50"
                                        :step="0.5" @update:model-value="
                                            (v) => updatePrintSettings({ marginLeft: Number(v) })
                                        " />
                                </div>
                                <div>
                                    <p class="mb-1 text-[11px] text-ink/50">Kanan</p>
                                    <Input :model-value="printSettings.marginRight" type="number" :min="0" :max="50"
                                        :step="0.5" @update:model-value="
                                            (v) => updatePrintSettings({ marginRight: Number(v) })
                                        " />
                                </div>
                            </div>
                        </div>

                        <!-- Scale -->
                        <div>
                            <div class="mb-2 flex items-center justify-between">
                                <label class="eyebrow text-ink/60">Skala</label>
                                <span class="display text-[13px] font-bold tabular-nums text-ink">
                                    {{ printSettings.scaleFactor }}%
                                </span>
                            </div>
                            <input :value="printSettings.scaleFactor" type="range" min="10" max="100" step="1"
                                class="range-input w-full" @input="
                                    (e) =>
                                        updatePrintSettings({
                                            scaleFactor: Number(
                                                (e.target as HTMLInputElement).value
                                            ),
                                        })
                                " />
                            <div class="mt-1 flex justify-between text-[10.5px] text-ink/40">
                                <span>10%</span>
                                <span>50%</span>
                                <span>100%</span>
                            </div>
                        </div>

                        <!-- Reset -->
                        <div class="flex justify-end border-t-2 border-ink pt-4">
                            <Button type="button" variant="paper" size="sm" :icon="ArrowPathIcon"
                                @click="resetPrintSettings">
                                Reset ke Default
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
</template>

<style scoped>
/* Range input brutalist */
.range-input {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    background: #fffdf8;
    border: 2px solid #20201e;
    cursor: pointer;
}

.range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 18px;
    width: 18px;
    background: #d9ed93;
    border: 2px solid #20201e;
    cursor: grab;
}

.range-input::-webkit-slider-thumb:active {
    cursor: grabbing;
    background: #2945e8;
}

.range-input::-moz-range-thumb {
    height: 18px;
    width: 18px;
    background: #d9ed93;
    border: 2px solid #20201e;
    border-radius: 0;
    cursor: grab;
}
</style>