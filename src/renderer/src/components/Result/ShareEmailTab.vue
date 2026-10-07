<script setup lang="ts">
import { ref } from 'vue'
import {
    EnvelopeIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'

const props = withDefaults(
    defineProps<{
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
    (e: 'submit', email: string): void
}>()

const email = ref('')

function submit() {
    if (!email.value) return
    emit('submit', email.value)
}
</script>

<template>
    <div class="space-y-4">
        <!-- Skeleton -->
        <template v-if="loading">
            <div class="h-10 w-full animate-pulse bg-ink/10" />
            <div class="h-3 w-3/4 animate-pulse bg-ink/10" />
            <div class="h-11 w-full animate-pulse bg-ink/10" />
        </template>

        <!-- Content -->
        <template v-else>
            <div>
                <label class="eyebrow mb-2 block text-ink/60">
                    Alamat Email
                </label>
                <input v-model="email" type="email" placeholder="nama@email.com"
                    class="w-full border-2 border-ink bg-paper-soft px-3.5 py-3 text-[13.5px] text-ink placeholder:text-ink/30 focus:border-blue focus:outline-none"
                    :disabled="emailSending" @keydown.enter="submit" />
            </div>

            <div v-if="emailSent" class="flex items-start gap-2.5 border-2 border-ink bg-lime p-3.5">
                <CheckCircleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <p class="text-[12.5px] leading-5 text-ink">
                    {{ emailMessage }}
                </p>
            </div>

            <div v-if="emailError" class="flex items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <p class="text-[12.5px] leading-5 text-ink">
                    {{ emailError }}
                </p>
            </div>

            <p class="text-[11.5px] leading-5 text-ink/55">
                Kami akan mengirim link galeri ke email ini. Pastikan alamat
                sudah benar.
            </p>

            <button type="button"
                class="display inline-flex w-full items-center justify-center gap-3 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all active:translate-y-1 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="emailSending || !email" @click="submit">
                <EnvelopeIcon class="h-5 w-5" :class="emailSending && 'animate-pulse'" />
                {{ emailSending ? 'Mengirim...' : 'Kirim Email' }}
            </button>
        </template>
    </div>
</template>