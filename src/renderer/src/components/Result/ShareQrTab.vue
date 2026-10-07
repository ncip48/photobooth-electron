<script setup lang="ts">
import { ref } from 'vue'
import {
    ClipboardDocumentIcon,
    CheckCircleIcon,
    ClockIcon,
    InformationCircleIcon,
    CameraIcon,
    CursorArrowRaysIcon,
} from '@heroicons/vue/24/outline'

const props = withDefaults(
    defineProps<{
        qrUrl: string
        publicUrl: string
        loading?: boolean
    }>(),
    {
        loading: false,
    }
)

const copied = ref(false)

async function copyPublicUrl() {
    try {
        await navigator.clipboard.writeText(props.publicUrl)
        copied.value = true
        setTimeout(() => (copied.value = false), 2000)
    } catch (e) {
        console.error('Copy failed:', e)
    }
}

const scanSteps = [
    { icon: CameraIcon, title: 'Buka kamera', desc: 'Aktifkan kamera HP kamu' },
    { icon: CursorArrowRaysIcon, title: 'Arahkan ke QR', desc: 'Posisikan QR di dalam frame' },
    { icon: CheckCircleIcon, title: 'Tap link', desc: 'Link akan muncul otomatis' },
]
</script>

<template>
    <!-- ============ QR TAB (no scroll, 2 kolom) ============ -->
    <div class="grid min-h-0 flex-1 grid-cols-2 gap-4">

        <!-- ===== Kolom kiri: QR ===== -->
        <div class="flex min-h-0 flex-col">
            <div class="relative flex min-h-0 flex-1 flex-col border-2 border-ink bg-white p-4">
                <!-- Corner brackets -->
                <div class="pointer-events-none absolute -top-1 -left-1 h-5 w-5 border-t-4 border-l-4 border-lime" />
                <div class="pointer-events-none absolute -top-1 -right-1 h-5 w-5 border-t-4 border-r-4 border-lime" />
                <div class="pointer-events-none absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-lime" />
                <div
                    class="pointer-events-none absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-lime" />

                <!-- Konten QR -->
                <div class="flex min-h-0 flex-1 items-center justify-center">
                    <!-- Skeleton -->
                    <template v-if="loading">
                        <div class="flex flex-col items-center">
                            <div class="h-52 w-52 animate-pulse border-4 border-ink/20 bg-paper-soft sm:h-56 sm:w-56" />
                            <div class="mt-4 h-3 w-48 animate-pulse bg-ink/10" />
                        </div>
                    </template>

                    <!-- Content -->
                    <template v-else>
                        <div class="flex flex-col items-center">
                            <div class="border-4 border-ink bg-white p-4 shadow-brutal-lg">
                                <img :src="qrUrl" alt="QR Code" class="h-52 w-52 sm:h-56 sm:w-56" />
                            </div>

                            <p class="mt-4 text-center text-[12.5px] leading-5 text-ink/70">
                                Scan QR untuk membuka galeri foto Anda.
                            </p>

                            <button type="button" @click="copyPublicUrl"
                                class="display mt-4 flex w-full items-center justify-center gap-2 border-2 border-ink bg-lime px-4 py-2.5 text-[12px] font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0">
                                <CheckCircleIcon v-if="copied" class="h-4 w-4" />
                                <ClipboardDocumentIcon v-else class="h-4 w-4" />
                                {{ copied ? 'Link tersalin!' : 'Salin link' }}
                            </button>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- ===== Kolom kanan: Cara scan + status ===== -->
        <div class="flex min-h-0 flex-col gap-3 overflow-y-auto">

            <!-- Cara scan -->
            <div>
                <div class="mb-2 flex items-center gap-2">
                    <InformationCircleIcon class="h-4 w-4 text-ink/60" />
                    <p class="display text-[11px] font-bold tracking-wider text-ink/60 uppercase">
                        Cara scan
                    </p>
                </div>

                <div class="space-y-2">
                    <div v-for="(step, i) in scanSteps" :key="i"
                        class="flex items-center gap-3 border-2 border-ink bg-paper-soft p-2.5">
                        <div
                            class="display flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink bg-lime text-[11px] font-bold">
                            {{ i + 1 }}
                        </div>
                        <component :is="step.icon" class="h-4 w-4 shrink-0 text-ink/70" />
                        <div class="min-w-0 flex-1">
                            <p class="display text-[12px] font-bold text-ink">{{ step.title }}</p>
                            <p class="text-[10px] text-ink/50">{{ step.desc }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status sesi -->
            <div class="flex items-center gap-3 border-2 border-ink border-dashed bg-paper-soft p-2.5">
                <ClockIcon class="h-4 w-4 shrink-0 text-ink/70" />
                <div class="min-w-0 flex-1">
                    <p class="display text-[10px] font-bold tracking-wider text-ink uppercase">
                        Status sesi
                    </p>
                    <p class="text-[10px] text-ink/60">
                        Aktif selama sesi berlangsung
                    </p>
                </div>
                <div class="flex shrink-0 items-center gap-1.5 border-2 border-ink bg-lime px-2 py-1">
                    <div class="h-2 w-2 rounded-full bg-ink animate-pulse" />
                    <span class="display text-[10px] font-bold uppercase text-ink">Aktif</span>
                </div>
            </div>
        </div>
    </div>
</template>