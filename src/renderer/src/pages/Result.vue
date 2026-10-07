<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ResultHeader from '@/components/Result/ResultHeader.vue'
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

const route = useRoute()
const router = useRouter()

const sessionId = computed(() => route.params.sessionId as string)

/* =========================================================
   Fetch result data
   ========================================================= */
const { data: result, isLoading } = useResultData(sessionId)

const photostrip = computed(() => result.value?.photostrip ?? null)
const event = computed(() => result.value?.event ?? null)
const publicUrl = computed(() => result.value?.public_url ?? '')
const qrUrl = computed(() => result.value?.qr_url ?? '')

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
const totalSeconds = computed(() => event.value?.time_download ?? 300)

const handleExpired = async () => {
    // Auto-finish saat timer habis
    try {
        await finishResult()
        router.push({ name: 'start' })
    } catch (err) {
        console.error('Auto-finish failed:', err)
    }
}

const {
    mmss,
    isExpired,
    isLowTime,
    start: startCountdown,
    stop: stopCountdown,
} = useResultCountdown(totalSeconds, handleExpired)

/* Mulai countdown saat data siap */
watch(
    result,
    (val) => {
        if (val && totalSeconds.value > 0) {
            startCountdown(totalSeconds.value)
        }
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
        <!-- Timer -->
        <ResultHeader :mmss="mmss" :is-expired="isExpired" :is-low-time="isLowTime" :loading="isLoading" />

        <!-- Main grid -->
        <main
            class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 pt-20 sm:gap-5 sm:p-6 sm:pt-24 lg:grid-cols-[440px_minmax(0,1fr)] lg:justify-center">
            <!-- KIRI: Photostrip -->
            <PhotostripPreview :photostrip="photostrip" :event-title="event?.title" :loading="isLoading" />

            <!-- KANAN: Ucapan + Share + Warning + Selesai -->
            <aside class="flex min-h-0 flex-col gap-4">
                <ThankYouCard />

                <SharePanel :qr-url="qrUrl" :public-url="publicUrl" :email-sending="emailSending"
                    :email-sent="emailSent" :email-message="emailMessage" :email-error="emailError" :loading="isLoading"
                    @send-email="onSendEmail" />

                <ResultWarning />

                <FinishButton :loading="finishing" :disabled="isLoading" @click="onFinish" />
            </aside>
        </main>
    </div>
</template>