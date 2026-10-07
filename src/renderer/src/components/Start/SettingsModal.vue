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
   ============ TAB: CAMERA ============
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
    disconnect,
    capture: capturePhoto,
    getConfig: getCameraConfig,
    setConfigValue,
    startPreview,
    stopPreview,
} = useCamera()

/* --- Camera form (nama + preference) --- */
const cameraForm = ref({
    camera_name: props.cameraSettings?.camera_name ?? '',
    camera_device_id: props.cameraSettings?.camera_device_id ?? '',
    iso: props.cameraSettings?.iso ?? '',
    aperture: props.cameraSettings?.aperture ?? '',
    shutter_speed: props.cameraSettings?.shutter_speed ?? '',
})

watch(
    () => props.cameraSettings,
    (cs) => {
        if (!cs) return
        cameraForm.value.camera_name = cs.camera_name ?? ''
        cameraForm.value.camera_device_id = cs.camera_device_id ?? ''
        cameraForm.value.iso = cs.iso ?? ''
        cameraForm.value.aperture = cs.aperture ?? ''
        cameraForm.value.shutter_speed = cs.shutter_speed ?? ''
    },
    { deep: true }
)

/* --- Camera config tree (untuk choices) --- */
const cameraConfig = ref<any>(null)
const supportedKeys = computed(() =>
    Object.keys(cameraConfig.value ?? {})
)

/* --- Test capture --- */
const testStatus = ref<'idle' | 'capturing' | 'success' | 'error'>('idle')
const testImageUrl = ref<string | null>(null)

/* --- Connect handler --- */
const handleConnect = async () => {
    // 1. Detect dulu
    await detect()

    if (cameras.value.length === 0) {
        console.warn("Tidak ada kamera terdeteksi")
        return
    }

    // 2. Connect ke camera pertama
    await connect(0)

    // 3. Load config tree
    if (connected.value) {
        try {
            cameraConfig.value = await getCameraConfig()
        } catch (err) {
            console.error('Failed to load camera config:', err)
        }
    }
}

/* --- Disconnect --- */
const handleDisconnect = async () => {
    await disconnect()
    cameraConfig.value = null
    testImageUrl.value = null
    testStatus.value = 'idle'
}

/* --- Test capture --- */
const testCapture = async () => {
    if (testStatus.value === 'capturing' || !connected.value) return

    testStatus.value = 'capturing'
    testImageUrl.value = null

    try {
        const res = await capturePhoto()
        testImageUrl.value = res.data
        testStatus.value = 'success'
    } catch (err) {
        console.error('Test capture failed:', err)
        testStatus.value = 'error'
    }
}

/* --- Update config (kirim ke kamera) --- */
const updateCameraConfig = async (key: string, value: string) => {
    if (!connected.value || !value) return
    try {
        await setConfigValue(key, String(value))
        // Refresh config tree (beberapa kamera butuh re-fetch)
        cameraConfig.value = await getCameraConfig()
    } catch (err) {
        console.error(`Failed to set ${key}:`, err)
    }
}

/* --- Camera settings mutation --- */
const cameraMutation = useMutation({
    mutationFn: () => photoboothApi.saveCameraSettings(cameraForm.value),
    onSuccess: () => {
        queryClient.invalidateQueries({
            queryKey: ['photobooth', 'camera-settings'],
        })
    },
})

const cameraSaveError = ref('')
const cameraSaveSuccess = ref(false)

const submitCamera = () => {
    cameraSaveError.value = ''
    cameraSaveSuccess.value = false

    cameraMutation.mutate(undefined, {
        onSuccess: () => {
            cameraSaveSuccess.value = true
            setTimeout(() => (cameraSaveSuccess.value = false), 2500)
        },
        onError: (err: any) => {
            cameraSaveError.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal menyimpan konfigurasi kamera.'
        },
    })
}

const cameraProcessing = computed(() => cameraMutation.isPending.value)

/* --- Camera config choices (dari config tree atau fallback) --- */
const ISO_OPTIONS = ['100', '200', '400', '800', '1600', '3200', '6400']
const APERTURE_OPTIONS = ['f/1.8', 'f/2.0', 'f/2.8', 'f/4.0', 'f/5.6', 'f/8.0', 'f/11']
const SHUTTER_OPTIONS = ['1/1000', '1/500', '1/250', '1/125', '1/60', '1/30', '1/15', '1/8', '1/4', '1/2', '1']

const isoChoices = computed(() => {
    const node = cameraConfig.value?.iso
    if (node?.choices?.length) return node.choices.map(String)
    return ISO_OPTIONS
})

const apertureChoices = computed(() => {
    const node = cameraConfig.value?.aperture
    if (node?.choices?.length) return node.choices.map(String)
    return APERTURE_OPTIONS
})

const shutterChoices = computed(() => {
    const node =
        cameraConfig.value?.['shutter-speed'] ??
        cameraConfig.value?.shutterspeed ??
        cameraConfig.value?.['shutter_speed']
    if (node?.choices?.length) return node.choices.map(String)
    return SHUTTER_OPTIONS
})

/* =========================================================
   Lifecycle — pause preview kalau modal ditutup
   ========================================================= */
watch(
    () => props.show,
    (open) => {
        if (!open) {
            stopPreview()
        } else if (connected.value) {
            startPreview()
        }
    }
)

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
const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
    '4x6': { width: 101.6, height: 152.4, label: '4×6 inci' },
    '5x7': { width: 127, height: 177.8, label: '5×7 inci' },
    A4: { width: 210, height: 297, label: 'A4' },
    Letter: { width: 215.9, height: 279.4, label: 'Letter' },
}

const currentPaper = computed(
    () => PAPER_SIZES[printSettings.value.pageSize] ?? PAPER_SIZES['4x6']
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

onBeforeUnmount(() => {
    stopPreview()
})
</script>

<template>
    <Modal :show="show" title="Pengaturan Kiosk" subtitle="Konfigurasi umum, kamera, dan cetak" max-width="4xl"
        :closeable="true" @close="emit('close')">
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

                <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <!-- ============ LEFT: Live Preview ============ -->
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

                        <div class="relative aspect-[4/3] overflow-hidden border-2 border-ink bg-ink">
                            <img v-if="livePreviewUrl" :src="livePreviewUrl" alt="Live preview"
                                class="h-full w-full object-contain" />
                            <div v-else class="grid h-full w-full place-items-center text-center">
                                <div class="p-6">
                                    <CameraIcon class="mx-auto h-12 w-12 text-white/30" />
                                    <p class="mt-3 text-[13px] text-white/60">
                                        {{
                                            connected
                                                ? 'Menunggu frame...'
                                                : 'Hubungkan kamera untuk memulai preview'
                                        }}
                                    </p>
                                </div>
                            </div>

                            <div v-if="connected && livePreviewUrl"
                                class="absolute left-3 top-3 inline-flex items-center gap-1.5 border border-lime/40 bg-ink/70 px-2 py-0.5 backdrop-blur-sm">
                                <span class="h-2 w-2 animate-pulse rounded-full bg-rose" />
                                <span class="text-[10px] font-bold uppercase tracking-wider text-lime">
                                    LIVE
                                </span>
                            </div>
                        </div>

                        <!-- Buttons -->
                        <div class="flex flex-wrap gap-2">
                            <Button v-if="!connected" variant="primary" size="sm" :icon="CameraIcon"
                                :loading="detecting || connecting" :disabled="detecting || connecting"
                                @click="handleConnect">
                                {{
                                    detecting
                                        ? 'Mendeteksi...'
                                        : connecting
                                            ? 'Menghubungkan...'
                                            : 'Hubungkan Kamera'
                                }}
                            </Button>
                            <Button v-else variant="paper" size="sm" :icon="XMarkIcon" @click="handleDisconnect">
                                Disconnect
                            </Button>

                            <Button v-if="connected" :variant="testStatus === 'success' ? 'lime' : 'paper'
                                " size="sm" :icon="testStatus === 'success'
                                    ? CheckCircleIcon
                                    : PlayIcon
                                    " :loading="testStatus === 'capturing'" :disabled="testStatus === 'capturing'"
                                @click="testCapture">
                                {{
                                    testStatus === 'capturing'
                                        ? 'Mengambil...'
                                        : testStatus === 'success'
                                            ? 'Berhasil!'
                                            : testStatus === 'error'
                                                ? 'Gagal — Coba Lagi'
                                                : 'Test Kamera'
                                }}
                            </Button>
                        </div>

                        <!-- Detected cameras -->
                        <div v-if="cameras.length > 0" class="border-2 border-ink bg-paper-soft p-3">
                            <p class="eyebrow mb-2 text-ink/50">
                                Kamera Terdeteksi ({{ cameras.length }})
                            </p>
                            <ul class="space-y-1">
                                <li v-for="(cam, idx) in cameras" :key="idx"
                                    class="display text-[12px] font-semibold text-ink">
                                    {{ idx + 1 }}. {{ cam.model }}
                                    <span v-if="cam.port" class="text-ink/50">
                                        — {{ cam.port }}
                                    </span>
                                </li>
                            </ul>
                        </div>

                        <!-- Test result -->
                        <div v-if="testImageUrl" class="relative overflow-hidden border-2 border-ink bg-ink">
                            <img :src="testImageUrl" alt="Test capture" class="h-auto w-full object-contain" />
                            <div
                                class="absolute left-3 top-3 border border-lime/40 bg-ink/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime backdrop-blur-sm">
                                Hasil Test
                            </div>
                        </div>
                    </div>

                    <!-- ============ RIGHT: Config ============ -->
                    <div class="space-y-4">
                        <Input v-model="cameraForm.camera_name" label="Nama Kamera" placeholder="cth. Canon EOS 5D"
                            hint="Label untuk kamera ini" />

                        <!-- Supported keys (dari config tree) -->
                        <div v-if="connected && supportedKeys.length > 0" class="border-2 border-ink bg-paper-soft p-3">
                            <p class="eyebrow mb-2 text-ink/50">
                                Config Tersedia ({{ supportedKeys.length }})
                            </p>
                            <div class="flex flex-wrap gap-1">
                                <span v-for="key in supportedKeys.slice(0, 15)" :key="key"
                                    class="display border border-ink/20 bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink/70">
                                    {{ key }}
                                </span>
                                <span v-if="supportedKeys.length > 15" class="text-[10px] text-ink/50">
                                    +{{ supportedKeys.length - 15 }} lainnya
                                </span>
                            </div>
                        </div>

                        <!-- ISO -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                ISO
                            </label>
                            <div class="flex flex-wrap gap-1.5">
                                <button v-for="opt in isoChoices" :key="opt" type="button"
                                    class="display border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" :class="cameraForm.iso === opt
                                        ? 'border-ink bg-ink text-white'
                                        : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                        " :disabled="!connected" @click="
                                            cameraForm.iso = opt;
                                        updateCameraConfig('iso', opt)
                                            ">
                                    {{ opt }}
                                </button>
                            </div>
                        </div>

                        <!-- Aperture -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                Aperture
                            </label>
                            <div class="flex flex-wrap gap-1.5">
                                <button v-for="opt in apertureChoices" :key="opt" type="button"
                                    class="display border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" :class="cameraForm.aperture === opt
                                        ? 'border-ink bg-ink text-white'
                                        : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                        " :disabled="!connected" @click="
                                            cameraForm.aperture = opt;
                                        updateCameraConfig('aperture', opt)
                                            ">
                                    {{ opt }}
                                </button>
                            </div>
                        </div>

                        <!-- Shutter Speed -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                Shutter Speed
                            </label>
                            <div class="flex flex-wrap gap-1.5">
                                <button v-for="opt in shutterChoices" :key="opt" type="button"
                                    class="display border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" :class="cameraForm.shutter_speed === opt
                                        ? 'border-ink bg-ink text-white'
                                        : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                        " :disabled="!connected" @click="
                                            cameraForm.shutter_speed = opt;
                                        updateCameraConfig('shutter-speed', opt)
                                            ">
                                    {{ opt }}
                                </button>
                            </div>
                        </div>

                        <!-- Info hint -->
                        <div class="flex items-start gap-2 border-2 border-ink/20 bg-paper-soft p-3">
                            <InformationCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/50" />
                            <p class="text-[11.5px] leading-5 text-ink/60">
                                Konfigurasi disimpan sebagai default kiosk. Perubahan
                                dikirim langsung ke kamera saat terhubung.
                            </p>
                        </div>

                        <!-- Feedback -->
                        <div v-if="cameraSaveError" class="flex items-start gap-2 border-2 border-ink bg-rose p-3">
                            <XCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                            <p class="text-[12px] leading-5 text-ink">
                                {{ cameraSaveError }}
                            </p>
                        </div>

                        <div v-if="cameraSaveSuccess" class="flex items-start gap-2 border-2 border-ink bg-lime p-3">
                            <CheckCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                            <p class="text-[12px] leading-5 text-ink">
                                Konfigurasi kamera berhasil disimpan.
                            </p>
                        </div>

                        <!-- Save -->
                        <div class="flex justify-end gap-2 border-t-2 border-ink pt-4">
                            <Button type="button" variant="primary" size="sm" :icon="CheckCircleIcon"
                                :loading="cameraProcessing" :disabled="cameraProcessing" @click="submitCamera">
                                {{
                                    cameraProcessing
                                        ? 'Menyimpan...'
                                        : 'Simpan Kamera'
                                }}
                            </Button>
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

                        <!-- Paper Size -->
                        <div>
                            <label class="eyebrow mb-2 block text-ink/60">
                                Ukuran Kertas
                            </label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="(size, key) in PAPER_SIZES" :key="key" type="button"
                                    class="display border-2 px-3 py-2 text-[12.5px] font-bold transition-colors" :class="printSettings.pageSize === key
                                        ? 'border-ink bg-ink text-white'
                                        : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                        " @click="updatePrintSettings({ pageSize: key })">
                                    {{ size.label }}
                                </button>
                            </div>
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