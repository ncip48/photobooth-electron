<script setup lang="ts">
import { computed, ref } from 'vue'
import {
    MinusIcon,
    PlusIcon,
    PrinterIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import { formatRupiah } from '@/lib/format'

const props = withDefaults(
    defineProps<{
        unitPrice?: number
        freePrint?: number
        printing?: boolean
        printed?: boolean
        printMessage?: string
        printError?: string
        loading?: boolean
    }>(),
    {
        unitPrice: 0,
        freePrint: 1,
        printing: false,
        printed: false,
        printMessage: '',
        printError: '',
        loading: false,
    }
)

const emit = defineEmits<{
    (e: 'print', qty: number): void
}>()

const qty = ref(1)

const MIN_QTY = 1
const MAX_QTY = 10

const billableQty = computed(() => Math.max(qty.value - props.freePrint, 0))

const total = computed(() => billableQty.value * props.unitPrice)

function inc() {
    if (qty.value < MAX_QTY) qty.value++
}

function dec() {
    if (qty.value > MIN_QTY) qty.value--
}

function submit() {
    if (props.printing) return
    emit('print', qty.value)
}
</script>

<template>
    <div class="space-y-4">
        <!-- Skeleton -->
        <template v-if="loading">
            <div class="h-20 w-full animate-pulse bg-ink/10" />
            <div class="h-12 w-full animate-pulse bg-ink/10" />
        </template>

        <template v-else>
            <!-- ============= Qty stepper + price ============= -->
            <div class="border-2 border-ink bg-white">
                <!-- Stepper row -->
                <div class="flex items-stretch border-b-2 border-ink">
                    <!-- Minus -->
                    <button type="button"
                        class="display grid w-16 shrink-0 place-items-center border-r-2 border-ink bg-paper-soft text-2xl font-bold text-ink transition-colors hover:bg-lime active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-paper-soft sm:w-20"
                        :disabled="qty <= MIN_QTY || printing" aria-label="Kurangi" @click="dec">
                        <MinusIcon class="h-6 w-6" />
                    </button>

                    <!-- Qty -->
                    <div class="flex flex-1 items-center justify-center gap-2 py-4">
                        <span class="display text-4xl font-bold tabular-nums leading-none text-ink sm:text-5xl">
                            {{ qty }}
                        </span>
                        <span class="display mt-2 text-[12px] font-bold uppercase tracking-wider text-ink/50">
                            lembar
                        </span>
                    </div>

                    <!-- Plus -->
                    <button type="button"
                        class="display grid w-16 shrink-0 place-items-center border-l-2 border-ink bg-paper-soft text-2xl font-bold text-ink transition-colors hover:bg-lime active:translate-y-px disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-paper-soft sm:w-20"
                        :disabled="qty >= MAX_QTY || printing" aria-label="Tambah" @click="inc">
                        <PlusIcon class="h-6 w-6" />
                    </button>
                </div>

                <!-- Price row -->
                <div class="flex items-center justify-between gap-3 px-4 py-3">
                    <div class="min-w-0">
                        <p class="eyebrow text-ink/50">Total</p>

                        <p class="display text-[11px] text-ink/55">
                            <template v-if="props.freePrint > 0">
                                {{ qty }} lembar
                                <span class="text-lime-700">
                                    ({{ Math.min(qty, props.freePrint) }} gratis)
                                </span>
                                <template v-if="billableQty > 0">
                                    · {{ billableQty }} × {{ formatRupiah(unitPrice) }}
                                </template>
                            </template>

                            <template v-else>
                                {{ qty }} × {{ formatRupiah(unitPrice) }}
                            </template>
                        </p>
                    </div>

                    <p class="display text-2xl font-bold tabular-nums leading-none text-ink sm:text-3xl">
                        {{ formatRupiah(total) }}
                    </p>
                </div>
            </div>

            <!-- ============= Status messages ============= -->
            <div v-if="printed" class="flex items-start gap-2.5 border-2 border-ink bg-lime p-3.5">
                <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <p class="text-[12.5px] leading-5 text-ink">
                    {{ printMessage || 'Sedang dikirim ke printer.' }}
                </p>
            </div>

            <div v-if="printError" class="flex items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <p class="text-[12.5px] leading-5 text-ink">
                    {{ printError }}
                </p>
            </div>

            <!-- ============= Hint ============= -->
            <p class="text-[11.5px] leading-5 text-ink/55">
                Photostrip akan dicetak sebanyak qty yang dipilih.
                Pastikan printer sudah terhubung dan kertas tersedia.
            </p>

            <!-- ============= Cetak button ============= -->
            <button type="button"
                class="display inline-flex w-full items-center justify-center gap-3 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all active:translate-y-1 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="printing || qty < MIN_QTY" @click="submit">
                <PrinterIcon class="h-5 w-5" :class="printing && 'animate-pulse'" />
                {{ printing ? 'Mencetak...' : 'Cetak' }}
            </button>

            <!-- ============= Printing progress (full-width bar) ============= -->
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
                    <!-- Indeterminate bar -->
                    <div class="h-1.5 w-full overflow-hidden bg-paper">
                        <div class="indeterminate-bar h-full w-1/3 bg-blue" />
                    </div>
                </div>
            </Transition>
        </template>
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