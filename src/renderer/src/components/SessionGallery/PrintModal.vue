<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
    XMarkIcon,
    MinusIcon,
    PlusIcon,
    PrinterIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import { formatRupiah } from '@/lib/format'
import { useSessionPrint } from '@/composables/useSessionPrint'
import type { PhotoboothSession } from '@/composables/useSessionGallery'

const props = defineProps<{
    session: PhotoboothSession
}>()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const {
    printing,
    printError,
    printMessage,
    additionalPricePerStrip,
    maxPrintStrip,
    handlePrint,
} = useSessionPrint()

const qty = ref(1)
const MIN_QTY = 1
const MAX_QTY = 10

const alreadyPrintCount = computed(() => props.session.total_prints ?? 0)

const remainingFreePrint = computed(() =>
    Math.max(maxPrintStrip.value - alreadyPrintCount.value, 0),
)

const billableQty = computed(() =>
    Math.max(qty.value - remainingFreePrint.value, 0),
)

const total = computed(() => billableQty.value * additionalPricePerStrip.value)

// Reset qty ketika modal dibuka untuk session berbeda
watch(
    () => props.session.id,
    () => {
        qty.value = 1
    },
)

function inc() {
    if (qty.value < MAX_QTY) qty.value++
}

function dec() {
    if (qty.value > MIN_QTY) qty.value--
}

async function submit() {
    if (printing.value) return
    await handlePrint(props.session, qty.value)
}
</script>

<template>
    <!-- Overlay -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" @click.self="emit('close')">
        <!-- Card -->
        <div class="card relative flex w-full max-w-md flex-col overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between border-b-2 border-ink bg-paper-soft px-4 py-3">
                <div class="min-w-0">
                    <p class="display text-[15px] font-bold text-ink">Cetak Photostrip</p>
                    <p class="mt-0.5 truncate text-[11.5px] text-ink/55">
                        {{ session.preview?.filename ?? 'Photostrip' }}
                    </p>
                </div>
                <button type="button"
                    class="grid h-9 w-9 shrink-0 place-items-center border-2 border-ink bg-paper-soft text-ink shadow-brutal-sm transition-all hover:bg-rose active:translate-y-0.5"
                    aria-label="Tutup" @click="emit('close')">
                    <XMarkIcon class="h-4 w-4" />
                </button>
            </div>

            <!-- Body -->
            <div class="space-y-4 p-4">
                <!-- Qty stepper + price -->
                <div class="border-2 border-ink bg-white">
                    <div class="flex items-stretch border-b-2 border-ink">
                        <button type="button"
                            class="display grid w-16 shrink-0 place-items-center border-r-2 border-ink bg-paper-soft text-2xl font-bold text-ink transition-colors hover:bg-lime active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-paper-soft sm:w-20"
                            :disabled="qty <= MIN_QTY || printing" aria-label="Kurangi" @click="dec">
                            <MinusIcon class="h-6 w-6" />
                        </button>

                        <div class="flex flex-1 items-center justify-center gap-2 py-4">
                            <span class="display text-4xl font-bold tabular-nums leading-none text-ink sm:text-5xl">
                                {{ qty }}
                            </span>
                            <span class="display mt-2 text-[12px] font-bold uppercase tracking-wider text-ink/50">
                                lembar
                            </span>
                        </div>

                        <button type="button"
                            class="display grid w-16 shrink-0 place-items-center border-l-2 border-ink bg-paper-soft text-2xl font-bold text-ink transition-colors hover:bg-lime active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-paper-soft sm:w-20"
                            :disabled="qty >= MAX_QTY || printing" aria-label="Tambah" @click="inc">
                            <PlusIcon class="h-6 w-6" />
                        </button>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-4 py-3">
                        <div class="min-w-0">
                            <p class="eyebrow text-ink/50">Total</p>
                            <p class="display text-[11px] text-ink/55">
                                <template v-if="maxPrintStrip > 0">
                                    {{ qty }} lembar
                                    <span class="text-lime-700">
                                        ({{ Math.min(qty, maxPrintStrip) }} gratis)
                                    </span>
                                    <template v-if="billableQty > 0">
                                        · {{ billableQty }} × {{ formatRupiah(additionalPricePerStrip) }}
                                    </template>
                                </template>
                                <template v-else>
                                    {{ qty }} × {{ formatRupiah(additionalPricePerStrip) }}
                                </template>
                            </p>
                        </div>

                        <p class="display text-2xl font-bold tabular-nums leading-none text-ink sm:text-3xl">
                            {{ formatRupiah(total) }}
                        </p>
                    </div>
                </div>

                <!-- Status -->
                <div v-if="printing || printMessage" class="flex items-start gap-2.5 border-2 border-ink bg-lime p-3.5">
                    <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] leading-5 text-ink">
                        {{ printing ? 'Mengirim ke printer...' : printMessage }}
                    </p>
                </div>

                <div v-if="printError" class="flex items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] leading-5 text-ink">{{ printError }}</p>
                </div>

                <!-- Hint -->
                <p class="text-[11.5px] leading-5 text-ink/55">
                    Photostrip akan dicetak sebanyak qty yang dipilih.
                    Pastikan printer sudah terhubung dan kertas tersedia.
                </p>

                <!-- Button -->
                <button type="button"
                    class="display inline-flex w-full items-center justify-center gap-3 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all active:translate-y-1 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="printing || qty < MIN_QTY" @click="submit">
                    <PrinterIcon class="h-5 w-5" :class="printing && 'animate-pulse'" />
                    {{ printing ? 'Mencetak...' : 'Cetak' }}
                </button>

                <!-- Progress -->
                <Transition enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 -translate-y-1" enter-to-class="opacity-100 translate-y-0"
                    leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100"
                    leave-to-class="opacity-0">
                    <div v-if="printing" class="border-2 border-ink bg-paper-soft">
                        <div class="flex items-center gap-2.5 px-3 py-2.5">
                            <span class="grid h-6 w-6 shrink-0 place-items-center">
                                <span class="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                            </span>
                            <p class="display text-[12px] font-bold text-ink">
                                Mengirim ke printer...
                            </p>
                        </div>
                        <div class="h-1.5 w-full overflow-hidden bg-paper">
                            <div class="indeterminate-bar h-full w-1/3 bg-blue" />
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>
</template>

<style scoped>
.indeterminate-bar {
    animation: indeterminate 1.2s ease-in-out infinite;
}

@keyframes indeterminate {
    0% {
        transform: translateX(-100%);
    }

    100% {
        transform: translateX(400%);
    }
}
</style>