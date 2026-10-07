import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { photoboothApi } from '@/lib/api'

/* =========================================================
   Draft ID helper (dari sessionStorage)
   ========================================================= */
const DRAFT_KEY = 'photobooth.draft_id'

function getDraftId(): string | null {
    try {
        return sessionStorage.getItem(DRAFT_KEY)
    } catch {
        return null
    }
}

function clearDraftId() {
    try {
        sessionStorage.removeItem(DRAFT_KEY)
    } catch {
        // ignore
    }
}

/* =========================================================
   Composable
   ========================================================= */
export function usePayment() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const draftId = ref<string | null>(getDraftId())
    const error = ref('')

    /* =========================================================
       Navigate helper
       ========================================================= */
    function goToCapture(sessionId: string) {
        clearDraftId()
        queryClient.invalidateQueries({ queryKey: ['photobooth', 'session'] })

        router.push({
            name: 'capture',
            params: { sessionId: sessionId ? String(sessionId) : undefined },
        })
    }

    function goToStart() {
        clearDraftId()
        router.push({ name: 'start' })
    }

    /* =========================================================
       QRIS confirm
       ========================================================= */
    const qrisMutation = useMutation({
        mutationFn: async () => {
            if (!draftId.value) throw new Error('Draft pembayaran tidak ditemukan.')
            const res = await photoboothApi.confirmQris(draftId.value)
            if (!res.success) throw new Error(res.message ?? 'Konfirmasi QRIS gagal.')
            return res
        },
        onSuccess: (data) => {
            const sessionId = data?.session_id ?? data?.id
            if (!sessionId) {
                error.value = 'Session ID tidak diterima dari server.'
                return
            }
            goToCapture(sessionId)
        },
        onError: (err: any) => {
            error.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal konfirmasi QRIS.'
        },
    })

    /* =========================================================
       Voucher redeem
       ========================================================= */
    const voucherMutation = useMutation({
        mutationFn: async (code: string) => {
            if (!draftId.value) throw new Error('Draft pembayaran tidak ditemukan.')
            const res = await photoboothApi.redeemVoucher(draftId.value, code)
            if (!res.success) throw new Error(res.message ?? 'Voucher tidak valid.')
            return res
        },
        onSuccess: (data) => {
            const sessionId = data?.session_id ?? data?.id
            if (!sessionId) {
                error.value = 'Session ID tidak diterima dari server.'
                return
            }
            goToCapture(sessionId)
        },
        onError: (err: any) => {
            error.value =
                err?.response?.data?.message ??
                err?.message ??
                'Kode voucher tidak valid atau sudah kedaluwarsa.'
        },
    })

    /* =========================================================
       Cancel
       ========================================================= */
    const cancelMutation = useMutation({
        mutationFn: async () => {
            if (!draftId.value) return { success: true }
            const res = await photoboothApi.cancelPayment(draftId.value)
            return res
        },
        onSuccess: () => {
            goToStart()
        },
        onError: (err: any) => {
            // Tetap redirect ke start meskipun gagal cancel di backend
            console.warn('Cancel request failed, redirecting anyway:', err)
            goToStart()
        },
    })

    return {
        // State
        draftId,
        error,

        // Actions
        confirmQris: qrisMutation.mutateAsync,
        redeemVoucher: voucherMutation.mutateAsync,
        cancelPayment: cancelMutation.mutateAsync,

        // Status
        isConfirmingQris: computed(() => qrisMutation.isPending.value),
        isRedeemingVoucher: computed(() => voucherMutation.isPending.value),
        isCancelling: computed(() => cancelMutation.isPending.value),

        // Navigation
        goToStart,
        goToCapture,
    }
}

/* =========================================================
   Countdown composable (reusable)
   ========================================================= */
export function usePaymentCountdown(
    totalSeconds: number,
    onExpired: () => void
) {
    const remaining = ref(totalSeconds)
    let timer: ReturnType<typeof setInterval> | null = null

    const mmss = computed(() => {
        const m = Math.floor(remaining.value / 60)
        const s = remaining.value % 60
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    })

    const isExpired = computed(() => remaining.value <= 0)
    const isLowTime = computed(
        () => remaining.value <= 10 && remaining.value > 0
    )

    function start() {
        stop()
        timer = setInterval(() => {
            if (remaining.value > 0) {
                remaining.value--
            } else {
                stop()
                onExpired()
            }
        }, 1000)
    }

    function stop() {
        if (timer) {
            clearInterval(timer)
            timer = null
        }
    }

    onMounted(start)
    onBeforeUnmount(stop)

    return {
        remaining,
        mmss,
        isExpired,
        isLowTime,
        start,
        stop,
    }
}