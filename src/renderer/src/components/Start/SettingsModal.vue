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
                <div class="grid place-items-center border-2 border-ink bg-paper-soft px-6 py-12 text-center">
                    <span class="grid h-16 w-16 place-items-center border-2 border-ink bg-paper">
                        <PrinterIcon class="h-8 w-8 text-ink/40" />
                    </span>
                    <p class="display mt-4 text-[15px] font-bold text-ink">
                        Pengaturan Cetak
                    </p>
                    <p class="mt-2 max-w-md text-[12.5px] leading-6 text-ink/60">
                        Konfigurasi printer, ukuran kertas, jumlah cetakan, dan
                        opsi lain akan tersedia di versi berikutnya.
                    </p>
                    <Badge tone="amber" class="mt-4">Segera Hadir</Badge>
                </div>
            </div>
        </div>
    </Modal>
</template>