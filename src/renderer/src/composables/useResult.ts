import { computed, ref, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { photoboothApi } from '@/lib/api'
import { PhotoboothEvent } from './useDefaultEvent'

/* =========================================================
   Types
   ========================================================= */
export interface Photostrip {
    id: string
    url: string
    filename: string
}

export interface ResultData {
    session: {
        id: string
        session_number: string | null
    }
    event: PhotoboothEvent
    photostrip: Photostrip | null
    public_url: string
    qr_url: string
}

/* =========================================================
   Fetch result
   ========================================================= */
export function useResultData(sessionId: Ref<string>) {
    return useQuery({
        queryKey: ['photobooth', 'result', sessionId],
        queryFn: async () => {
            const res = await photoboothApi.getResult(sessionId.value)
            return res as ResultData
        },
        staleTime: 1000 * 30, // 30 detik
    })
}

/* =========================================================
   Actions
   ========================================================= */
export function useResultActions(sessionId: Ref<string>) {
    const qc = useQueryClient()

    const emailSending = ref(false)
    const emailSent = ref(false)
    const emailMessage = ref('')
    const emailError = ref('')

    const finishing = ref(false)
    const finishError = ref('')

    /* ---------- Send email ---------- */
    async function sendEmail(email: string) {
        if (emailSending.value) return

        emailSending.value = true
        emailError.value = ''
        emailSent.value = false
        emailMessage.value = ''

        try {
            const res = await photoboothApi.sendResultEmail(
                sessionId.value,
                email
            )
            if (!res.success) {
                throw new Error(res.message ?? 'Gagal mengirim email.')
            }
            emailSent.value = true
            emailMessage.value = res.message ?? 'Email terkirim.'
            return res
        } catch (err: any) {
            emailError.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal mengirim email.'
            throw err
        } finally {
            emailSending.value = false
        }
    }

    /* ---------- Finish ---------- */
    async function finishResult() {
        if (finishing.value) return

        finishing.value = true
        finishError.value = ''

        try {
            const res = await photoboothApi.finishResult(sessionId.value)
            qc.invalidateQueries({ queryKey: ['photobooth', 'session'] })
            return res
        } catch (err: any) {
            finishError.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal menyelesaikan sesi.'
            throw err
        } finally {
            finishing.value = false
        }
    }

    return {
        emailSending: computed(() => emailSending.value),
        emailSent: computed(() => emailSent.value),
        emailMessage: computed(() => emailMessage.value),
        emailError: computed(() => emailError.value),
        finishing: computed(() => finishing.value),
        finishError: computed(() => finishError.value),
        sendEmail,
        finishResult,
    }
}

/* =========================================================
   Countdown
   ========================================================= */
export function useResultCountdown(
    totalSeconds: Ref<number>,
    onExpired: () => void
) {
    const remaining = ref(totalSeconds.value)
    let timer: ReturnType<typeof setInterval> | null = null
    let started = false

    const mmss = computed(() => {
        const m = Math.floor(remaining.value / 60)
        const s = remaining.value % 60
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    })

    const isExpired = computed(() => remaining.value <= 0)
    const isLowTime = computed(
        () => remaining.value <= 30 && remaining.value > 0
    )

    function start(seconds?: number) {
        if (started) return
        if (seconds) remaining.value = seconds
        started = true

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

    return { remaining, mmss, isExpired, isLowTime, start, stop }
}