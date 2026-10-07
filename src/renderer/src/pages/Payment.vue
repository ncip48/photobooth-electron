<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
    QrCodeIcon,
    TicketIcon,
    ArrowLeftIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ClockIcon,
} from '@heroicons/vue/24/outline'
import Button from '@/components/UI/Button.vue'
import QrisPanel from '@/components/Payment/QrisPanel.vue'
import VoucherPanel from '@/components/Payment/VoucherPanel.vue'
import { usePayment, usePaymentCountdown } from '@/composables/usePayment'
import { useActiveEvent } from '@/composables/useEvents'

/* =========================================================
   Active event
   ========================================================= */
const { data: event, isLoading: eventLoading } = useActiveEvent()

/* =========================================================
   Payment composable
   ========================================================= */
const {
    draftId,
    confirmQris,
    redeemVoucher,
    cancelPayment,
    isConfirmingQris,
    isRedeemingVoucher,
    isCancelling,
    goToStart,
} = usePayment()

/* Guard: kalau tidak ada draft, redirect ke start */
onMounted(() => {
    if (!draftId.value) {
        goToStart()
    }
})

/* =========================================================
   Tab state
   ========================================================= */
const activeMethod = ref<'qris' | 'voucher'>('qris')

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
    // Auto-cancel saat expired
    handleCancel()
})

/* Restart timer kalau event baru dimuat */
import { watch } from 'vue'
watch(timePayment, (val) => {
    if (val > 0) startTimer()
})

/* =========================================================
   Cancel flow
   ========================================================= */
const handleCancel = async () => {
    stopTimer()
    try {
        await cancelPayment()
    } catch {
        // Error handled in composable, tetap redirect
    }
}

/* =========================================================
   Keyboard
   ========================================================= */
const onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
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
const qrisPayload = ref('HELORABOOTH-QRIS-DEMO')
</script>

<template>
    <div class="relative flex min-h-screen flex-col bg-paper text-ink">
        <!-- Loading event -->
        <div v-if="eventLoading || !event" class="grid h-screen w-full place-items-center">
            <div class="flex flex-col items-center gap-4">
                <div class="h-12 w-12 animate-spin border-4 border-ink/20 border-t-ink" />
                <p class="display text-lg font-bold text-ink/70">
                    Memuat...
                </p>
            </div>
        </div>

        <template v-else>
            <!-- ============================================================
                 TIMER PILL
                 ============================================================ -->
            <div class="pointer-events-none fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
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
            <main class="flex flex-1 flex-col items-center justify-center px-4 py-8 pt-20 sm:px-6 sm:py-10 sm:pt-24">
                <div class="w-full max-w-5xl">
                    <!-- METHOD TABS -->
                    <div class="mb-6 flex border-2 border-ink bg-paper-soft" role="tablist">
                        <button type="button" role="tab"
                            class="display flex flex-1 items-center justify-center gap-2.5 border-r-2 border-ink px-4 py-4 text-[14px] font-bold transition-colors"
                            :class="activeMethod === 'qris'
                                    ? 'bg-ink text-white'
                                    : 'bg-transparent text-ink hover:bg-lime'
                                " :aria-selected="activeMethod === 'qris'" @click="activeMethod = 'qris'">
                            <QrCodeIcon class="h-5 w-5" />
                            <span>QRIS</span>
                        </button>

                        <button type="button" role="tab"
                            class="display flex flex-1 items-center justify-center gap-2.5 px-4 py-4 text-[14px] font-bold transition-colors"
                            :class="activeMethod === 'voucher'
                                    ? 'bg-ink text-white'
                                    : 'bg-transparent text-ink hover:bg-lime'
                                " :aria-selected="activeMethod === 'voucher'" @click="activeMethod = 'voucher'">
                            <TicketIcon class="h-5 w-5" />
                            <span>Voucher</span>
                        </button>
                    </div>

                    <!-- PANEL -->
                    <div class="card p-5 lg:p-7">
                        <QrisPanel v-if="activeMethod === 'qris'" :event="event" :qris-payload="qrisPayload"
                            :remaining-seconds="remaining" :confirming="isConfirmingQris" :is-expired="isExpired"
                            @confirm="confirmQris" />

                        <VoucherPanel v-else :event="event" :is-expired="isExpired" :redeeming="isRedeemingVoucher"
                            @submit="redeemVoucher" />
                    </div>

                    <!-- BACK LINK -->
                    <div class="mt-7 text-center">
                        <button type="button"
                            class="inline-flex items-center gap-2 text-[13px] font-semibold text-ink/55 transition-colors hover:text-ink"
                            @click="showCancelDialog = true">
                            <ArrowLeftIcon class="h-3.5 w-3.5" />
                            Kembali ke halaman awal
                        </button>
                    </div>
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