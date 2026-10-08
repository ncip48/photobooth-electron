<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import Modal from '@/components/UI/Modal.vue'
import Button from '@/components/UI/Button.vue'
import Input from '@/components/UI/Input.vue'
import Badge from '@/components/UI/Badge.vue'
import {
    PrinterIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    PhotoIcon,
} from '@heroicons/vue/24/outline'
import { usePrint } from '@/composables/usePrint'

/* =========================================================
   Props & Emits
   ========================================================= */
const props = withDefaults(
    defineProps<{
        show: boolean
        /** URL photostrip yang mau dicetak */
        imageUrl?: string
        /** Default paper size */
        defaultPaperSize?: string
    }>(),
    {
        imageUrl: '',
        defaultPaperSize: '4x6',
    }
)

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'printed'): void
}>()

/* =========================================================
   Print composable
   ========================================================= */
const {
    printers,
    loading: loadingPrinters,
    printing,
    error: printError,
    settings,
    loadPrinters,
    print: doPrint,
    printWithDialog,
    updateSettings,
    resetSettings,
} = usePrint()

/* =========================================================
   Paper sizes (mm)
   ========================================================= */
const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
    '4x6': { width: 101.6, height: 152.4, label: '4×6 inci' },
    '5x7': { width: 127, height: 177.8, label: '5×7 inci' },
    A4: { width: 210, height: 297, label: 'A4' },
    Letter: { width: 215.9, height: 279.4, label: 'Letter' },
}

const currentPaper = computed(
    () =>
        PAPER_SIZES[settings.value.pageSize] ?? PAPER_SIZES['4x6']
)

/* =========================================================
   Preview dimensions
   ========================================================= */
const PREVIEW_MAX_WIDTH = 260

const previewDimensions = computed(() => {
    const paper = currentPaper.value
    const aspect = paper.width / paper.height
    const width = PREVIEW_MAX_WIDTH
    const height = width / aspect
    return { width, height }
})

const scaledDimensions = computed(() => {
    const s = settings.value.scaleFactor / 100
    return {
        width: previewDimensions.value.width * s,
        height: previewDimensions.value.height * s,
    }
})

const marginDisplay = computed(() => {
    const paper = currentPaper.value
    const displayWidthPx = previewDimensions.value.width
    const mmToPx = displayWidthPx / paper.width

    return {
        top: settings.value.marginTop * mmToPx,
        bottom: settings.value.marginBottom * mmToPx,
        left: settings.value.marginLeft * mmToPx,
        right: settings.value.marginRight * mmToPx,
    }
})

/* =========================================================
   Lifecycle
   ========================================================= */
watch(
    () => props.show,
    async (open) => {
        if (open) {
            // Set default paper size kalau belum ada
            if (!settings.value.pageSize) {
                updateSettings({ pageSize: props.defaultPaperSize })
            }
            // Load printers kalau belum
            if (printers.value.length === 0) {
                await loadPrinters()
            }
        }
    }
)

onMounted(() => {
    if (props.show) loadPrinters()
})

/* =========================================================
   Actions
   ========================================================= */
const submitPrint = async () => {
    if (!settings.value.deviceName) {
        printError.value = 'Pilih printer dulu.'
        return
    }

    try {
        await doPrint()
        emit('printed')
    } catch {
        // Error sudah di-set
    }
}

const submitWithDialog = async () => {
    try {
        await printWithDialog()
        emit('printed')
    } catch {
        // Error sudah di-set
    }
}
</script>

<template>
    <Modal :show="show" title="Pengaturan Cetak" subtitle="Atur printer, margin, dan skala sebelum cetak"
        max-width="4xl" :closeable="!printing" @close="emit('close')">
        <div class="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <!-- ============================================================
                 LEFT: Preview
                 ============================================================ -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <p class="eyebrow text-ink/60">Preview</p>
                    <Badge tone="grey">{{ currentPaper.label }}</Badge>
                </div>

                <!-- Preview canvas -->
                <div class="flex justify-center border-2 border-ink bg-paper-soft p-4">
                    <div class="relative border-2 border-ink bg-white shadow-brutal-sm" :style="{
                        width: previewDimensions.width + 'px',
                        height: previewDimensions.height + 'px',
                    }">
                        <!-- Margin area -->
                        <div class="pointer-events-none absolute border-2 border-dashed border-blue/50" :style="{
                            top: marginDisplay.top + 'px',
                            left: marginDisplay.left + 'px',
                            right: marginDisplay.right + 'px',
                            bottom: marginDisplay.bottom + 'px',
                        }" />

                        <!-- Content -->
                        <img v-if="imageUrl" :src="imageUrl" alt="Preview"
                            class="pointer-events-none absolute object-contain" :style="{
                                top: '50%',
                                left: '50%',
                                width: scaledDimensions.width + 'px',
                                height: 'auto',
                                transform: 'translate(-50%, -50%)',
                            }" />
                        <div v-else class="grid h-full w-full place-items-center">
                            <PhotoIcon class="h-12 w-12 text-ink/20" />
                        </div>
                    </div>
                </div>

                <!-- Info -->
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
                            {{ settings.scaleFactor }}%
                        </p>
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 RIGHT: Settings
                 ============================================================ -->
            <div class="space-y-5">
                <!-- Printer -->
                <div>
                    <label class="eyebrow mb-2 block text-ink/60">
                        Printer
                    </label>
                    <div v-if="loadingPrinters" class="text-[12.5px] text-ink/50">
                        Memuat printer...
                    </div>
                    <select v-else :value="settings.deviceName"
                        class="w-full border-2 border-ink bg-paper-soft px-3 py-2.5 text-[13.5px] text-ink focus:border-blue focus:outline-none"
                        @change="
                            updateSettings({
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
                            class="display border-2 px-3 py-2 text-[12.5px] font-bold transition-colors" :class="settings.pageSize === key
                                ? 'border-ink bg-ink text-white'
                                : 'border-ink/20 bg-paper-soft text-ink hover:border-ink hover:bg-lime'
                                " @click="updateSettings({ pageSize: key })">
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
                            <Input :model-value="settings.marginTop" type="number" :min="0" :max="50" :step="0.5"
                                @update:model-value="
                                    (v) => updateSettings({ marginTop: Number(v) })
                                " />
                        </div>
                        <div>
                            <p class="mb-1 text-[11px] text-ink/50">Bawah</p>
                            <Input :model-value="settings.marginBottom" type="number" :min="0" :max="50" :step="0.5"
                                @update:model-value="
                                    (v) => updateSettings({ marginBottom: Number(v) })
                                " />
                        </div>
                        <div>
                            <p class="mb-1 text-[11px] text-ink/50">Kiri</p>
                            <Input :model-value="settings.marginLeft" type="number" :min="0" :max="50" :step="0.5"
                                @update:model-value="
                                    (v) => updateSettings({ marginLeft: Number(v) })
                                " />
                        </div>
                        <div>
                            <p class="mb-1 text-[11px] text-ink/50">Kanan</p>
                            <Input :model-value="settings.marginRight" type="number" :min="0" :max="50" :step="0.5"
                                @update:model-value="
                                    (v) => updateSettings({ marginRight: Number(v) })
                                " />
                        </div>
                    </div>
                </div>

                <!-- Scale -->
                <div>
                    <div class="mb-2 flex items-center justify-between">
                        <label class="eyebrow text-ink/60">Skala</label>
                        <span class="display text-[13px] font-bold tabular-nums text-ink">
                            {{ settings.scaleFactor }}%
                        </span>
                    </div>
                    <input :value="settings.scaleFactor" type="range" min="10" max="100" step="1"
                        class="range-input w-full" @input="
                            (e) =>
                                updateSettings({
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

                <!-- Copies -->
                <div>
                    <label class="eyebrow mb-2 block text-ink/60">
                        Jumlah Salinan
                    </label>
                    <Input :model-value="settings.copies" type="number" :min="1" :max="10" @update:model-value="
                        (v) => updateSettings({ copies: Number(v) })
                    " />
                </div>

                <!-- Options -->
                <div class="flex flex-wrap gap-4">
                    <label class="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink/75">
                        <span class="toggle">
                            <input :checked="settings.color" type="checkbox" @change="
                                (e) =>
                                    updateSettings({
                                        color: (e.target as HTMLInputElement)
                                            .checked,
                                    })
                            " />
                            <span class="toggle-track" />
                            <span class="toggle-thumb" />
                        </span>
                        Warna
                    </label>
                    <label class="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink/75">
                        <span class="toggle">
                            <input :checked="settings.landscape" type="checkbox" @change="
                                (e) =>
                                    updateSettings({
                                        landscape: (
                                            e.target as HTMLInputElement
                                        ).checked,
                                    })
                            " />
                            <span class="toggle-track" />
                            <span class="toggle-thumb" />
                        </span>
                        Landscape
                    </label>
                </div>

                <!-- Error -->
                <div v-if="printError" class="flex items-start gap-2 border-2 border-ink bg-rose p-3">
                    <XCircleIcon class="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                    <p class="text-[12px] leading-5 text-ink">
                        {{ printError }}
                    </p>
                </div>

                <!-- Info -->
                <div class="border-2 border-ink/20 bg-paper-soft p-3 text-[11.5px] leading-5 text-ink/60">
                    <p>
                        <strong>Tips:</strong> Kalau perlu pengaturan lanjutan
                        (borderless, print quality), klik
                        <strong>"Buka Dialog Sistem"</strong>.
                    </p>
                </div>
            </div>
        </div>

        <!-- ============================================================
             FOOTER
             ============================================================ -->
        <template #footer>
            <Button type="button" variant="paper" size="sm" :icon="ArrowPathIcon" :disabled="printing"
                @click="resetSettings">
                Reset
            </Button>

            <Button type="button" variant="paper" size="sm" :icon="PrinterIcon"
                :disabled="printing || !settings.deviceName" @click="submitWithDialog">
                Buka Dialog Sistem
            </Button>

            <Button type="button" variant="primary" size="sm" :icon="CheckCircleIcon" :loading="printing"
                :disabled="printing || !settings.deviceName" @click="submitPrint">
                {{ printing ? 'Mencetak...' : 'Cetak Sekarang' }}
            </Button>
        </template>
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