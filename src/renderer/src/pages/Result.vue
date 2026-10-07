<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PhotostripPreview from '@/components/Result/PhotostripPreview.vue'
import ThankYouCard from '@/components/Result/ThankYouCard.vue'
import SharePanel from '@/components/Result/SharePanel.vue'
import ResultWarning from '@/components/Result/ResultWarning.vue'
import FinishButton from '@/components/Result/FinishButton.vue'
import {
    useResultData,
    useResultActions,
    useResultCountdown,
} from '@/composables/useResult'
import { useActiveEvent } from '@/composables/useEvents'

const route = useRoute()
const router = useRouter()

const sessionId = computed(() => route.params.sessionId as string)

/* =========================================================
   Fetch result data
   ========================================================= */
const { data: result, isLoading } = useResultData(sessionId)

const { data: event, isLoading: eventLoading } = useActiveEvent()

const photostrip = computed(() => result.value?.photostrip ?? null)
// const event = computed(() => result.value?.event ?? null)
const publicUrl = computed(() => result.value?.public_url ?? '')
const qrUrl = computed(() => result.value?.qr_url ?? '')

/* =========================================================
   Simple mode
   ========================================================= */
const isSimpleMode = computed(() => event.value?.is_simple === true)

const totalSeconds = computed<number | null>(() => {
    if (!event.value) {
        return null
    }

    if (isSimpleMode.value) {
        return null
    }

    return event.value.time_download ?? 300
})

const countdownEnabled = computed(() => {
    return event.value !== null && !isSimpleMode.value
})

console.log(event.value)

/* =========================================================
   Actions
   ========================================================= */
const {
    emailSending,
    emailSent,
    emailMessage,
    emailError,
    finishing,
    sendEmail,
    finishResult,
} = useResultActions(sessionId)

/* =========================================================
   Countdown
   ========================================================= */

const handleExpired = async () => {
    // Simple mode tidak memiliki auto-finish dari timer
    if (isSimpleMode.value) return

    try {
        await finishResult()
        router.push({ name: 'start' })
    } catch (err) {
        console.error('Auto-finish failed:', err)
    }
}

const {
    mmss,
    isExpired: countdownExpired,
    isLowTime: countdownLowTime,
    start: startCountdown,
    stop: stopCountdown,
} = useResultCountdown(totalSeconds, handleExpired, countdownEnabled)

/*
 * Expose state yang aman untuk UI.
 * Simple mode selalu dianggap tidak expired
 * dan tidak memiliki low-time state.
 */
const isExpired = computed(() => {
    if (isSimpleMode.value) return false

    return countdownExpired.value
})

const isLowTime = computed(() => {
    if (isSimpleMode.value) return false

    return countdownLowTime.value
})

/* =========================================================
   Mulai countdown saat data siap
   ========================================================= */
watch(
    event,
    (evt) => {
        // Event belum siap
        if (!evt) {
            stopCountdown()
            return
        }

        // Simple mode → tidak ada timer
        if (evt.is_simple === true) {
            stopCountdown()
            return
        }

        // Normal mode → mulai timer
        const seconds = evt.time_download ?? 300

        startCountdown(seconds)
    },
    { immediate: true }
)

/* =========================================================
   Handlers
   ========================================================= */
async function onSendEmail(email: string) {
    try {
        await sendEmail(email)
    } catch {
        // Error sudah di-set
    }
}

async function onFinish() {
    try {
        await finishResult()
        router.push({ name: 'start' })
    } catch {
        // Error sudah di-set
    }
}

/* =========================================================
   Lifecycle
   ========================================================= */
onBeforeUnmount(() => {
    stopCountdown()
})
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink">
        <main
            class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 sm:gap-5 sm:p-6 lg:grid-cols-[560px_minmax(0,1fr)] lg:justify-center">

            <!-- KIRI: Photostrip -->
            <PhotostripPreview :photostrip="photostrip" :event-title="event?.title" :loading="isLoading" />

            <!-- KANAN: Ucapan + Share + Warning + Selesai -->
            <aside class="flex min-h-0 flex-col gap-4">

                <ThankYouCard :simpleMode="isSimpleMode" :mmss="isSimpleMode ? null : mmss"
                    :is-expired="isSimpleMode ? false : isExpired" :is-low-time="isSimpleMode ? false : isLowTime"
                    :loading="isSimpleMode ? false : eventLoading" />

                <SharePanel :qr-url="qrUrl" :public-url="publicUrl" :email-sending="emailSending"
                    :email-sent="emailSent" :email-message="emailMessage" :email-error="emailError" :loading="isLoading"
                    @send-email="onSendEmail" />

                <ResultWarning />

                <FinishButton :loading="finishing" :disabled="isLoading" @click="onFinish" />
            </aside>
        </main>
    </div>
</template>