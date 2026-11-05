<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
    QrCodeIcon,
    TicketIcon,
    ArrowLeftIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    SparklesIcon,
    CreditCardIcon,
} from '@heroicons/vue/24/outline'
import Button from '@/components/UI/Button.vue'
import QrisPanel from '@/components/Payment/QrisPanel.vue'
import VoucherPanel from '@/components/Payment/VoucherPanel.vue'
import { usePayment, usePaymentCountdown } from '@/composables/usePayment'
import { useActiveEvent } from '@/composables/useEvents'

const router = useRouter()

/* =========================================================
   Active event
   ========================================================= */
const { data: event, isLoading: eventLoading } = useActiveEvent()

/* =========================================================
   Payment composable
   ========================================================= */
const {
    draftId,
    qrisCreation,
    qrisData,
    paymentStatus,
    confirmQris,
    redeemVoucher,
    cancelPayment,
    isConfirmingQris,
    isRedeemingVoucher,
    isCancelling,
    goToStart,
    goToCapture,
} = usePayment()

/* =========================================================
   Method selection
   null  = nothing chosen yet -> show the selection screen
   'qris' / 'voucher' -> that method is locked in
   ========================================================= */
type PaymentMethod = 'qris' | 'voucher'
const METHOD_KEY = 'payment:method'

const activeMethod = ref<PaymentMethod | null>(null)
const isCreatingQris = ref(false)
const qrisError = ref<string | null>(null)

/* Guard: no draft -> back to start */
onMounted(async () => {
    if (!draftId.value) {
        goToStart()
        return
    }

    // Restore selected payment method after refresh
    const stored = localStorage.getItem(METHOD_KEY) as PaymentMethod | null

    if (stored === 'qris' || stored === 'voucher') {
        activeMethod.value = stored
    }

    // Restore QRIS data if QRIS was previously selected.
    // Do NOT start the timer here.
    if (activeMethod.value === 'qris') {
        await initQris()
    }
})

/* =========================================================
   Timer
   ========================================================= */
const timePayment = computed(() => event.value?.time_payment ?? 60)

const showCancelDialog = ref(false)

const {
    remaining,
    mmss,
    isExpired,
    isLowTime,
    start: startTimer,
    stop: stopTimer,
} = usePaymentCountdown(timePayment.value, () => {
    handleCancel()
})

/* Timer only runs while a method is locked in */
// watch(
//     [timePayment, activeMethod],
//     ([val, method]) => {
//         if (val > 0 && method) startTimer()
//         else stopTimer()
//     },
//     { immediate: true }
// )

/* =========================================================
   Method selection handlers
   ========================================================= */
const selectMethod = async (method: PaymentMethod) => {
    if (activeMethod.value) return
    if (isExpired.value) return

    activeMethod.value = method

    // Start countdown only after selecting a method
    startTimer()

    localStorage.setItem(METHOD_KEY, method)

    if (method === 'qris') {
        await initQris()
    }
}

/* The only place qrisCreation() is triggered */
const initQris = async () => {
    isCreatingQris.value = true
    qrisError.value = null
    try {
        // If a QR already exists for this draft, don't recreate it.
        if (!qrisData.value) {
            await qrisCreation()
        }
    } catch (e: any) {
        qrisError.value = e?.message ?? 'Gagal membuat QRIS.'
    } finally {
        isCreatingQris.value = false
    }
}

/* =========================================================
   Cancel flow
   ========================================================= */
const handleCancel = async () => {
    stopTimer()

    try {
        if (!qrisData.value && activeMethod.value === 'qris') return

        await cancelPayment(qrisData.value?.payment.id || null)
    } catch {
        // Error handled in composable
    } finally {
        localStorage.removeItem(METHOD_KEY)
    }
}

/* =========================================================
   Keyboard
   ========================================================= */
const onKeydown = (e: KeyboardEvent) => {
    // Esc only makes sense once a method is chosen
    if (e.key === 'Escape' && activeMethod.value) {
        showCancelDialog.value = true
    }
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
    stopTimer()
    window.removeEventListener('keydown', onKeydown)
})

/* =========================================================
   Props pass ke panel
   ========================================================= */
const qrisPayload = computed(() => qrisData.value?.payment?.payment_number ?? '')
const qrisMerchant = computed(() => qrisData.value?.payment?.merchant_name ?? '')
const qrisOrderId = computed(() => qrisData.value?.payment?.order_id ?? '')
const chargedAmount = computed(() => qrisData.value?.payment?.charged_amount ?? 0)
const amount = computed(() => qrisData.value?.payment?.amount ?? 0)
const paymentStatusData = computed(() => paymentStatus.value)

watch(paymentStatusData, (value) => {
    if (!value) return
    if (!value.paid) return
    const sessionId = value.session_id

    localStorage.removeItem(METHOD_KEY)

    if (event.value?.is_simple) {
        router.push({
            name: 'select-frame',
            params: { sessionId: String(sessionId) },
        })
    } else {
        goToCapture(value?.session_id)
    }
})

const redeemVoucherAction = (code: string) => {
    redeemVoucher({
        code: code,
        is_simple: event.value?.is_simple ?? false,
    });
}
</script>

<template>
    <div class="relative flex min-h-screen flex-col overflow-hidden bg-paper text-ink">
        <!-- Decorative backdrop -->
        <div class="pointer-events-none absolute inset-0 select-none" aria-hidden="true">
            <!-- dotted grid -->
            <div class="absolute inset-0 opacity-[0.35]"
                style="background-image: radial-gradient(currentColor 1px, transparent 1px); background-size: 22px 22px; color: #0a0a0a;" />
            <!-- soft color fields -->
            <div class="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lime/50 blur-3xl" />
            <div class="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-amber/40 blur-3xl" />
            <div class="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-rose/30 blur-3xl" />
        </div>

        <!-- Loading event -->
        <div v-if="eventLoading || !event" class="grid h-screen w-full place-items-center">
            <div class="flex flex-col items-center gap-4">
                <div class="h-12 w-12 animate-spin border-4 border-ink/20 border-t-ink" />
                <p class="display text-lg font-bold text-ink/70">Memuat...</p>
            </div>
        </div>

        <template v-else>
            <!-- ============================================================
                 CLOSE (X) — locked screen only: back to Start, cancel session
                 ============================================================ -->
            <button v-if="!activeMethod" type="button" aria-label="Kembali ke halaman awal"
                class="group fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center border-2 border-ink bg-paper shadow-brutal-sm transition-colors hover:bg-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:left-6 sm:top-6"
                @click="goToStart">
                <XMarkIcon class="h-5 w-5 text-ink transition-transform group-hover:-translate-x-0.5" />
            </button>

            <!-- ============================================================
                 TIMER PILL — only once a method is locked in
                 ============================================================ -->
            <div v-if="activeMethod" class="pointer-events-none fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
                <div class="pointer-events-auto flex items-center gap-2.5 border-2 px-4 py-2.5 shadow-brutal-sm transition-colors"
                    :class="isExpired
                        ? 'border-[#b3261e] bg-rose'
                        : isLowTime
                            ? 'border-ink bg-amber'
                            : 'border-ink bg-paper-soft'
                        ">
                    <ClockIcon class="h-4 w-4 shrink-0" :class="isLowTime && !isExpired
                        ? 'animate-pulse text-ink'
                        : 'text-ink/60'
                        " />
                    <span class="display text-xl font-bold leading-none tracking-tight tabular-nums text-ink">
                        {{ mmss }}
                    </span>
                </div>
            </div>

            <!-- ============================================================
                 MAIN
                 ============================================================ -->
            <main
                class="relative flex flex-1 flex-col items-center justify-center px-4 py-8 pt-20 sm:px-6 sm:py-10 sm:pt-24">
                <div class="w-full max-w-5xl">

                    <!-- ====================================================
                         SELECTION SCREEN — nothing chosen yet
                         ==================================================== -->
                    <div v-if="!activeMethod" class="mx-auto w-full max-w-3xl">
                        <!-- Header -->
                        <div class="mb-8 text-center">

                            <h1
                                class="display mt-5 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
                                Pilih Metode<br class="sm:hidden" />
                                <span class="relative inline-block">
                                    Pembayaran
                                    <span class="absolute inset-x-0 -bottom-1 h-3 -z-10 bg-lime" aria-hidden="true" />
                                </span>
                            </h1>

                            <p class="mx-auto mt-4 max-w-md text-[13.5px] leading-6 text-ink/60">
                                Sesi photobooth kamu sudah siap. Pilih salah satu metode
                                untuk mengunci sesi dan mulai.
                            </p>
                        </div>

                        <!-- Method cards -->
                        <div class="grid gap-5 sm:grid-cols-2">
                            <!-- QRIS -->
                            <button type="button"
                                class="card group relative flex flex-col items-start gap-5 overflow-hidden p-6 pt-7 text-left transition-all hover:-translate-y-1 hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                :disabled="isExpired" @click="selectMethod('qris')">
                                <!-- corner ticks -->
                                <span
                                    class="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-ink/25"
                                    aria-hidden="true" />
                                <span
                                    class="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-ink/25"
                                    aria-hidden="true" />

                                <span
                                    class="grid h-14 w-14 place-items-center border-2 border-ink bg-paper-soft shadow-brutal-sm transition-colors group-hover:bg-paper">
                                    <QrCodeIcon class="h-7 w-7 text-ink" />
                                </span>

                                <span class="flex flex-col gap-1.5">
                                    <span class="display text-xl font-bold text-ink">QRIS</span>
                                    <span class="text-[13px] leading-5 text-ink/60">
                                        Bayar dengan scan QR dari aplikasi e-wallet atau m-banking.
                                    </span>
                                </span>

                                <span
                                    class="display mt-1 inline-flex items-center gap-1.5 border-t-2 border-dashed border-ink/25 pt-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/70">
                                    Pilih QRIS
                                    <span class="transition-transform group-hover:translate-x-1">→</span>
                                </span>
                            </button>

                            <!-- Voucher -->
                            <button type="button"
                                class="card group relative flex flex-col items-start gap-5 overflow-hidden p-6 pt-7 text-left transition-all hover:-translate-y-1 hover:bg-lime disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                :disabled="isExpired" @click="selectMethod('voucher')">
                                <span
                                    class="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-ink/25"
                                    aria-hidden="true" />
                                <span
                                    class="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-ink/25"
                                    aria-hidden="true" />

                                <span
                                    class="grid h-14 w-14 place-items-center border-2 border-ink bg-paper-soft shadow-brutal-sm transition-colors group-hover:bg-paper">
                                    <TicketIcon class="h-7 w-7 text-ink" />
                                </span>

                                <span class="flex flex-col gap-1.5">
                                    <span class="display text-xl font-bold text-ink">Voucher</span>
                                    <span class="text-[13px] leading-5 text-ink/60">
                                        Tukarkan kode voucher yang kamu miliki.
                                    </span>
                                </span>

                                <span
                                    class="display mt-1 inline-flex items-center gap-1.5 border-t-2 border-dashed border-ink/25 pt-4 text-[11.5px] font-bold uppercase tracking-wider text-ink/70">
                                    Pilih Voucher
                                    <span class="transition-transform group-hover:translate-x-1">→</span>
                                </span>
                            </button>
                        </div>

                        <!-- Footer note -->
                        <div class="mt-8 flex items-center justify-center gap-2.5 text-center">
                            <CreditCardIcon class="h-4 w-4 shrink-0 text-ink/40" />
                            <p class="text-[12px] leading-5 text-ink/45">
                                Metode tidak bisa diubah setelah dipilih. Sesi akan
                                dikunci sampai waktu pembayaran habis.
                            </p>
                        </div>
                    </div>

                    <!-- ====================================================
                         LOCKED-IN PANEL — method already chosen
                         ==================================================== -->
                    <template v-else>
                        <!-- METHOD HEADER (informational, not a tab) -->
                        <div class="mb-6 flex border-2 border-ink bg-paper-soft shadow-brutal-sm">
                            <div
                                class="display flex flex-1 items-center justify-center gap-2.5 bg-ink px-4 py-4 text-[14px] font-bold text-white">
                                <QrCodeIcon v-if="activeMethod === 'qris'" class="h-5 w-5" />
                                <TicketIcon v-else class="h-5 w-5" />
                                <span>{{ activeMethod === 'qris' ? 'QRIS' : 'Voucher' }}</span>
                            </div>
                        </div>

                        <!-- PANEL -->
                        <div class="card p-5 lg:p-7">
                            <!-- QRIS -->
                            <template v-if="activeMethod === 'qris'">
                                <div v-if="isCreatingQris" class="grid place-items-center py-16">
                                    <div class="flex flex-col items-center gap-4">
                                        <div class="h-10 w-10 animate-spin border-4 border-ink/20 border-t-ink" />
                                        <p class="display text-base font-bold text-ink/70">
                                            Menyiapkan QRIS...
                                        </p>
                                    </div>
                                </div>

                                <div v-else-if="qrisError" class="grid place-items-center py-16 text-center">
                                    <div class="flex max-w-sm flex-col items-center gap-4">
                                        <ExclamationTriangleIcon class="h-8 w-8 text-ink" />
                                        <p class="text-[13.5px] leading-6 text-ink/75">
                                            {{ qrisError }}
                                        </p>
                                        <Button variant="paper" size="sm" @click="initQris">
                                            Coba Lagi
                                        </Button>
                                    </div>
                                </div>

                                <QrisPanel v-else :event="event" :qris-payload="qrisPayload"
                                    :qris-merchant="qrisMerchant" :order-id="qrisOrderId" :amount="amount"
                                    :charged-amount="chargedAmount" :remaining-seconds="remaining"
                                    :confirming="isConfirmingQris" :is-expired="isExpired" @confirm="confirmQris" />
                            </template>

                            <!-- VOUCHER -->
                            <VoucherPanel v-else :event="event" :is-expired="isExpired" :redeeming="isRedeemingVoucher"
                                @submit="redeemVoucherAction" />
                        </div>

                        <!-- BACK LINK — only when a method is locked in -->
                        <div class="mt-7 text-center">
                            <button type="button"
                                class="inline-flex items-center gap-2 text-[13px] font-semibold text-ink/55 transition-colors hover:text-ink"
                                @click="showCancelDialog = true">
                                <ArrowLeftIcon class="h-3.5 w-3.5" />
                                Batalkan
                            </button>
                        </div>
                    </template>
                </div>
            </main>

            <!-- ============================================================
                 CANCEL CONFIRMATION
                 ============================================================ -->
            <div v-if="showCancelDialog" class="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4"
                @click.self="showCancelDialog = false">
                <div class="palette-shell w-full max-w-md">
                    <div class="border-b-2 border-ink bg-rose px-5 py-4">
                        <div class="flex items-center gap-3">
                            <span class="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink bg-paper">
                                <ExclamationTriangleIcon class="h-5 w-5 text-ink" />
                            </span>
                            <div>
                                <h3 class="display text-base font-bold text-ink">
                                    Batalkan Sesi?
                                </h3>
                                <p class="text-[11.5px] text-ink/70">
                                    Aksi ini tidak dapat dibatalkan.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="p-5">
                        <p class="text-[13.5px] leading-6 text-ink/75">
                            Sesi photobooth akan dibatalkan. Anda harus memulai
                            dari awal lagi.
                        </p>
                    </div>

                    <div class="flex items-center justify-end gap-3 border-t-2 border-ink bg-paper px-5 py-4">
                        <Button variant="paper" size="sm" :disabled="isCancelling" @click="showCancelDialog = false">
                            Tidak
                        </Button>
                        <Button variant="danger" size="sm" :icon="XMarkIcon" :loading="isCancelling"
                            :disabled="isCancelling" @click="handleCancel">
                            Ya, Batalkan
                        </Button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
