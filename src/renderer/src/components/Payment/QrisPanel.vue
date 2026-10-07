<script setup lang="ts">
import { computed } from 'vue'
import {
    CheckCircleIcon,
    QrCodeIcon,
    ShieldCheckIcon,
    SparklesIcon,
    DevicePhoneMobileIcon,
} from '@heroicons/vue/24/outline'
import Button from '@/components/UI/Button.vue'
import { formatRupiah } from '@/lib/format'

interface Props {
    event: {
        title: string
        price?: number
    }
    qrisPayload: string
    remainingSeconds?: number
    confirming?: boolean
    isExpired?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    remainingSeconds: 60,
    confirming: false,
    isExpired: false,
})

const emit = defineEmits<{
    (e: 'confirm'): void
}>()

const qrImageUrl = computed(() => {
    const data = encodeURIComponent(props.qrisPayload)
    return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${data}&margin=0`
})

/* Steps */
const steps = [
    {
        icon: DevicePhoneMobileIcon,
        label: 'Buka aplikasi e-wallet / m-banking',
    },
    { icon: QrCodeIcon, label: 'Pilih menu Scan QRIS' },
    { icon: CheckCircleIcon, label: 'Scan & konfirmasi nominal' },
]

function handleConfirm() {
    if (props.confirming || props.isExpired) return
    emit('confirm')
}
</script>

<template>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-8">
        <!-- LEFT: QR -->
        <div class="flex flex-col">
            <!-- QR card -->
            <div class="border-4 border-ink bg-white p-5 shadow-brutal-xl">
                <div class="relative">
                    <img :src="qrImageUrl" alt="QRIS" class="aspect-square w-full" />

                    <div class="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-ink bg-lime"
                        aria-hidden="true">
                        <QrCodeIcon class="h-6 w-6 text-ink" />
                    </div>
                </div>
            </div>

            <!-- Merchant label -->
            <div class="mt-4 border-2 border-ink bg-paper-soft px-4 py-3 text-center">
                <p class="eyebrow text-ink/50">Merchant</p>
                <p class="display mt-0.5 text-[15px] font-bold text-ink">
                    HeloraBooth
                </p>
                <p class="mt-0.5 text-[11.5px] text-ink/55">
                    NMID: ID2026HELORA
                </p>
            </div>
        </div>

        <!-- RIGHT: Amount + Steps + Action -->
        <div class="flex flex-col gap-5">
            <!-- Amount -->
            <div class="border-2 border-ink bg-lime p-5 lg:p-6">
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="eyebrow text-ink/60">Total Pembayaran</p>
                        <p class="display mt-2 text-4xl font-bold leading-none tracking-tight text-ink lg:text-5xl">
                            {{ formatRupiah(event.price ?? 0) }}
                        </p>
                        <p class="mt-2.5 text-[12.5px] text-ink/65">
                            {{ event.title }}
                        </p>
                    </div>
                    <span class="grid h-12 w-12 shrink-0 place-items-center border-2 border-ink bg-paper">
                        <SparklesIcon class="h-5 w-5 text-ink" />
                    </span>
                </div>
            </div>

            <!-- Steps -->
            <div class="border-2 border-ink bg-paper-soft p-5">
                <p class="eyebrow mb-4 text-ink/50">Cara Bayar</p>
                <ol class="space-y-3">
                    <li v-for="(step, idx) in steps" :key="idx" class="flex items-center gap-3">
                        <span
                            class="display grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime text-[12px] font-bold text-ink">
                            {{ idx + 1 }}
                        </span>
                        <component :is="step.icon" class="h-4 w-4 shrink-0 text-ink/60" />
                        <span class="text-[13px] leading-5 text-ink/80">
                            {{ step.label }}
                        </span>
                    </li>
                </ol>
            </div>

            <!-- Trust -->
            <div class="flex items-center gap-3 border-2 border-ink bg-paper-soft px-4 py-3">
                <ShieldCheckIcon class="h-5 w-5 shrink-0 text-blue" />
                <p class="text-[12px] leading-5 text-ink/65">
                    Pembayaran diproses secara aman melalui QRIS. Jangan
                    bagikan QR ini ke orang lain.
                </p>
            </div>

            <!-- Action -->
            <div class="mt-auto space-y-2 pt-2">
                <Button variant="lime" size="lg" :icon="CheckCircleIcon" full-width :loading="confirming"
                    :disabled="confirming || isExpired" @click="handleConfirm">
                    {{ confirming ? 'Memverifikasi...' : 'Sudah Bayar' }}
                </Button>
                <p class="text-center text-[11.5px] text-ink/50">
                    Tekan tombol ini setelah Anda menyelesaikan pembayaran
                </p>
            </div>
        </div>
    </div>
</template>