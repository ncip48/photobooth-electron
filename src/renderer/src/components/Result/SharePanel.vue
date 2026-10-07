<script setup lang="ts">
import { ref } from 'vue'
import { QrCodeIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'
import ShareQrTab from './ShareQrTab.vue'
import ShareEmailTab from './ShareEmailTab.vue'

const props = withDefaults(
    defineProps<{
        qrUrl: string
        publicUrl: string
        emailSending?: boolean
        emailSent?: boolean
        emailMessage?: string
        emailError?: string
        loading?: boolean
    }>(),
    {
        emailSending: false,
        emailSent: false,
        emailMessage: '',
        emailError: '',
        loading: false,
    }
)

const emit = defineEmits<{
    (e: 'send-email', email: string): void
}>()

const activeTab = ref<'qr' | 'email'>('qr')

function onSendEmail(email: string) {
    emit('send-email', email)
}
</script>

<template>
    <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Tabs -->
        <div class="flex shrink-0 border-b-2 border-ink" role="tablist">
            <button type="button" role="tab"
                class="display flex flex-1 items-center justify-center gap-2.5 border-r-2 border-ink px-4 py-3.5 text-[13px] font-bold transition-colors"
                :class="activeTab === 'qr'
                        ? 'bg-ink text-white'
                        : 'bg-paper-soft text-ink hover:bg-lime'
                    " :aria-selected="activeTab === 'qr'" @click="activeTab = 'qr'">
                <QrCodeIcon class="h-4 w-4" />
                QR Code
            </button>

            <button type="button" role="tab"
                class="display flex flex-1 items-center justify-center gap-2.5 px-4 py-3.5 text-[13px] font-bold transition-colors"
                :class="activeTab === 'email'
                        ? 'bg-ink text-white'
                        : 'bg-paper-soft text-ink hover:bg-lime'
                    " :aria-selected="activeTab === 'email'" @click="activeTab = 'email'">
                <EnvelopeIcon class="h-4 w-4" />
                Email
            </button>
        </div>

        <!-- Body -->
        <div class="min-h-0 flex-1 overflow-y-auto p-5">
            <ShareQrTab v-if="activeTab === 'qr'" :qr-url="qrUrl" :public-url="publicUrl" :loading="loading" />

            <ShareEmailTab v-else :email-sending="emailSending" :email-sent="emailSent" :email-message="emailMessage"
                :email-error="emailError" :loading="loading" @submit="onSendEmail" />
        </div>
    </div>
</template>