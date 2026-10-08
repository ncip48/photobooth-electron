<script setup lang="ts">
import { ref } from 'vue'
import { QrCodeIcon, EnvelopeIcon, PrinterIcon } from '@heroicons/vue/24/outline'
import ShareQrTab from './ShareQrTab.vue'
import ShareEmailTab from './ShareEmailTab.vue'
import PrintTab from './PrintTab.vue'

const props = withDefaults(
    defineProps<{
        qrUrl: string
        publicUrl: string
        emailSending?: boolean
        emailSent?: boolean
        emailMessage?: string
        emailError?: string
        loading?: boolean
        // Print
        additionalPricePerStrip?: number
        maxPrintStrip?: number
        printing?: boolean
        printed?: boolean
        printMessage?: string
        printError?: string
        alreadyPrintCount?: number
    }>(),
    {
        emailSending: false,
        emailSent: false,
        emailMessage: '',
        emailError: '',
        loading: false,
        additionalPricePerStrip: 0,
        maxPrintStrip: 1,
        printing: false,
        printed: false,
        printMessage: '',
        printError: '',
        alreadyPrintCount: 0
    }
)

const emit = defineEmits<{
    (e: 'send-email', email: string): void
    (e: 'print', qty: number): void
}>()

const activeTab = ref<'qr' | 'email' | 'print'>('qr')

function onSendEmail(email: string) {
    emit('send-email', email)
}

function onPrint(qty: number) {
    emit('print', qty)
}
</script>

<template>
    <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Tabs -->
        <div class="flex shrink-0 border-b-2 border-ink" role="tablist">
            <!-- QR -->
            <button type="button" role="tab"
                class="display flex flex-1 items-center justify-center gap-2.5 border-r-2 border-ink px-4 py-3.5 text-[13px] font-bold transition-colors"
                :class="activeTab === 'qr' ? 'bg-ink text-white' : 'bg-paper-soft text-ink hover:bg-lime'"
                :aria-selected="activeTab === 'qr'" @click="activeTab = 'qr'">
                <QrCodeIcon class="h-4 w-4" />
                QR
            </button>

            <!-- Email -->
            <button type="button" role="tab"
                class="display flex flex-1 items-center justify-center gap-2.5 border-r-2 border-ink px-4 py-3.5 text-[13px] font-bold transition-colors"
                :class="activeTab === 'email' ? 'bg-ink text-white' : 'bg-paper-soft text-ink hover:bg-lime'"
                :aria-selected="activeTab === 'email'" @click="activeTab = 'email'">
                <EnvelopeIcon class="h-4 w-4" />
                Email
            </button>

            <!-- Print -->
            <button type="button" role="tab"
                class="display flex flex-1 items-center justify-center gap-2.5 px-4 py-3.5 text-[13px] font-bold transition-colors"
                :class="activeTab === 'print' ? 'bg-ink text-white' : 'bg-paper-soft text-ink hover:bg-lime'"
                :aria-selected="activeTab === 'print'" @click="activeTab = 'print'">
                <PrinterIcon class="h-4 w-4" />
                Print
            </button>
        </div>

        <!-- Body -->
        <div class="flex min-h-0 flex-1 flex-col p-4">
            <ShareQrTab v-if="activeTab === 'qr'" :qr-url="qrUrl" :public-url="publicUrl" :loading="loading" />

            <div v-else-if="activeTab === 'email'" class="min-h-0 flex-1 overflow-y-auto">
                <ShareEmailTab :email-sending="emailSending" :email-sent="emailSent" :email-message="emailMessage"
                    :email-error="emailError" :loading="loading" @submit="onSendEmail" />
            </div>

            <div v-else class="min-h-0 flex-1 overflow-y-auto">
                <PrintTab :unit-price="additionalPricePerStrip" :free-print="maxPrintStrip" :printing="printing"
                    :printed="printed" :print-message="printMessage" :print-error="printError" :loading="loading"
                    @print="onPrint" :already-print-count="alreadyPrintCount" />
            </div>
        </div>
    </div>
</template>