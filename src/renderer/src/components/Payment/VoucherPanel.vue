<script setup lang="ts">
import { computed, ref } from 'vue'
import {
    TicketIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import OnScreenKeyboard from './OnScreenKeyboard.vue'

interface Props {
    event: {
        title: string
    }
    isExpired?: boolean
    redeeming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    isExpired: false,
    redeeming: false,
})

const emit = defineEmits<{
    (e: 'submit', code: string): void
}>()

const code = ref('')
const error = ref('')

const submitVoucher = () => {
    if (!code.value || code.value.length < 3) {
        error.value = 'Masukkan kode voucher (minimal 3 karakter).'
        return
    }
    if (props.isExpired || props.redeeming) return

    error.value = ''
    emit('submit', code.value)
}

/* Clear error saat user ketik */
const handleCodeUpdate = (value: string) => {
    code.value = value
    if (error.value) error.value = ''
}
</script>

<template>
    <div class="space-y-5">
        <!-- Header -->
        <div class="flex items-center gap-3">
            <span class="grid h-11 w-11 shrink-0 place-items-center border-2 border-ink bg-lime">
                <TicketIcon class="h-5 w-5 text-ink" />
            </span>
            <div>
                <p class="eyebrow text-ink/55">Masukkan Kode</p>
                <p class="display text-lg font-bold text-ink">
                    Voucher Photobooth
                </p>
            </div>
        </div>

        <!-- Input display -->
        <div class="border-4 border-ink bg-white p-5 shadow-brutal-md" :class="error && '!border-[#b3261e]'">
            <div
                class="display flex min-h-[64px] items-center justify-center text-4xl font-bold tracking-[.15em] text-ink sm:text-5xl">
                <span v-if="code" class="break-all">
                    {{ code }}
                </span>
                <span v-else class="text-ink/25">— — — — — —</span>

                <span v-if="!isExpired" class="ml-2 inline-block h-8 w-1 animate-pulse bg-blue sm:h-10"
                    aria-hidden="true" />
            </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="flex items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
            <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
            <p class="text-[13px] leading-5 text-ink">
                {{ error }}
            </p>
        </div>

        <!-- On-screen keyboard -->
        <OnScreenKeyboard :model-value="code" :disabled="isExpired || redeeming" :max-length="12"
            @update:model-value="handleCodeUpdate" @submit="submitVoucher" />
    </div>
</template>