<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
    PlayIcon,
    ArrowsRightLeftIcon,
    Cog6ToothIcon,
    SparklesIcon,
} from '@heroicons/vue/24/outline'
import SettingsModal from '@/components/Start/SettingsModal.vue'
import {
    useActiveEvent,
    useEvents,
    useAvailableEventCount,
    useStartSession,
} from '@/composables/useEvents'

const router = useRouter()

/* =========================================================
   Data
   ========================================================= */
const { data: activeEvent, isLoading, isError } = useActiveEvent()
const availableEventCount = useAvailableEventCount()
const startMutation = useStartSession()

const starting = computed(() => startMutation.isPending.value)

const startSession = () => {
    if (!activeEvent.value?.id || starting.value) return

    if (activeEvent.value?.is_paid_event) {
        startMutation.mutate(activeEvent.value.id, {
            onSuccess: (data) => {
                router.push({
                    name: 'payment',
                })
            },
            onError: (err) => {
                console.error('Failed to start session:', err)
            },
        })
    } else {
        if (activeEvent.value?.is_simple) {
            const sessionId = '01a0179e-a690-7141-8c3b-4aecc12936cb'
            router.push({
                name: 'select-frame',
                params: { sessionId: sessionId ? String(sessionId) : undefined },
            })
        } else {
            const sessionId = '01a0179e-a690-7141-8c3b-4aecc12936cb'
            router.push({
                name: 'capture',
                params: { sessionId: sessionId ? String(sessionId) : undefined },
            })
        }
    }
}

/* =========================================================
   Live clock
   ========================================================= */
const now = ref(new Date())
let clockInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
    clockInterval = setInterval(() => {
        now.value = new Date()
    }, 1000)
})

onBeforeUnmount(() => {
    if (clockInterval) clearInterval(clockInterval)
})

const timeLabel = computed(() =>
    now.value.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    })
)

const dateLabel = computed(() =>
    now.value.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })
)

/* =========================================================
   Settings
   ========================================================= */
const showSettings = ref(false)

const goToEventPicker = () => {
    showSettings.value = false
    router.push({ name: 'event-picker' })
}

const goToDashboard = () => {
    showSettings.value = false
}

/* =========================================================
   Keyboard
   ========================================================= */
const onKeydown = (e: KeyboardEvent) => {
    if (showSettings.value) return
    if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        startSession()
    }
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('contextmenu', (e) => e.preventDefault())
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-ink text-white select-none"
        @contextmenu.prevent>
        <!-- ============================================================
             AMBIENT BACKGROUND
             Multi-layer: image + ambient blobs + gradient + grain + vignette
             ============================================================ -->
        <div class="absolute inset-0 z-0 overflow-hidden">
            <!-- Base image / pattern -->
            <img v-if="activeEvent?.background_url" :src="activeEvent.background_url" :alt="activeEvent.title"
                class="h-full w-full scale-110 object-cover" />
            <div v-else class="grid-pattern h-full w-full bg-ink" />

            <!-- Ambient color blobs (floating) -->
            <div class="ambient-float-slow pointer-events-none absolute -left-[20%] -top-[20%] h-[70vh] w-[70vh] rounded-full bg-lime/20 blur-[120px]"
                aria-hidden="true" />
            <div class="ambient-float-mid pointer-events-none absolute -right-[15%] top-[10%] h-[60vh] w-[60vh] rounded-full bg-blue/25 blur-[140px]"
                aria-hidden="true" />
            <div class="ambient-float-fast pointer-events-none absolute bottom-[-15%] left-[20%] h-[50vh] w-[50vh] rounded-full bg-lime/15 blur-[100px]"
                aria-hidden="true" />

            <!-- Cinematic vignette + darkening -->
            <div class="absolute inset-0 backdrop-blur-[3px]" style="
                    background: radial-gradient(
                        ellipse at center,
                        rgba(32, 32, 30, 0.35) 0%,
                        rgba(32, 32, 30, 0.75) 55%,
                        rgba(32, 32, 30, 0.98) 100%
                    );
                " aria-hidden="true" />

            <!-- Top gradient (readability topbar) -->
            <div class="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-ink/90 via-ink/40 to-transparent"
                aria-hidden="true" />

            <!-- Bottom gradient (readability footer) -->
            <div class="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-ink via-ink/60 to-transparent"
                aria-hidden="true" />

            <!-- Film grain texture -->
            <div class="grain-overlay pointer-events-none absolute -inset-[5%] opacity-[0.05] mix-blend-overlay" style="
                    background-image: radial-gradient(
                        rgba(255, 255, 255, 0.6) 1px,
                        transparent 1px
                    );
                    background-size: 3px 3px;
                " aria-hidden="true" />
        </div>

        <!-- ============================================================
             ORNAMENTAL CORNERS (brutalist marks)
             ============================================================ -->
        <!-- <div class="pointer-events-none absolute inset-6 z-10 hidden lg:block" aria-hidden="true">
            
            <div class="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-lime/40" />
            
            <div class="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-lime/40" />
            
            <div class="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-lime/40" />
            
            <div class="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-lime/40" />
        </div> -->

        <!-- ============================================================
             TOP BAR
             ============================================================ -->
        <header class="slide-in-down relative z-20 flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
            <!-- Clock -->
            <div class="flex items-baseline gap-4">
                <p
                    class="display text-3xl font-bold leading-none tracking-[-.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-4xl">
                    {{ timeLabel }}
                </p>
                <p class="hidden text-[12.5px] text-white/60 sm:block">
                    {{ dateLabel }}
                </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-3">
                <button type="button"
                    class="group inline-flex items-center gap-2.5 border-2 border-white/25 bg-ink/60 px-4 py-3 text-[13px] font-bold text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="availableEventCount === 0" @click="goToEventPicker">
                    <ArrowsRightLeftIcon class="h-4 w-4 transition-transform group-hover:rotate-180" />
                </button>

                <button type="button"
                    class="group grid h-12 w-12 shrink-0 place-items-center border-2 border-white/25 bg-ink/60 text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink"
                    aria-label="Pengaturan" @click="showSettings = true">
                    <Cog6ToothIcon class="h-5 w-5 transition-transform group-hover:rotate-90" />
                </button>
            </div>
        </header>

        <!-- ============================================================
             MAIN
             ============================================================ -->
        <main class="relative z-20 flex flex-1 flex-col items-center justify-center px-6 py-6 lg:px-10">
            <!-- Loading -->
            <div v-if="isLoading" class="fade-in mx-auto flex flex-col items-center gap-4 text-center">
                <div class="h-12 w-12 animate-spin border-4 border-lime/30 border-t-lime" />
                <p class="display text-lg font-bold text-white/80">
                    Memuat event...
                </p>
            </div>

            <!-- Error -->
            <div v-else-if="isError" class="fade-in mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
                <div class="grid h-20 w-20 place-items-center border-2 border-rose bg-rose/20">
                    <SparklesIcon class="h-10 w-10 text-rose" />
                </div>
                <div>
                    <p class="eyebrow text-rose">Gagal Memuat</p>
                    <h1 class="display mt-3 text-3xl font-bold text-white">
                        Tidak dapat terhubung ke server
                    </h1>
                    <p class="mt-2 text-[14px] leading-6 text-white/70">
                        Pastikan backend berjalan dan coba muat ulang.
                    </p>
                </div>
                <button type="button"
                    class="display inline-flex items-center gap-3 border-4 border-ink bg-lime px-8 py-4 text-xl font-bold text-ink shadow-brutal-xl active:translate-y-1 active:shadow-brutal-sm"
                    @click="() => router.go(0)">
                    Muat Ulang
                </button>
            </div>

            <!-- No event -->
            <div v-else-if="!activeEvent" class="fade-in mx-auto flex max-w-xl flex-col items-center gap-7 text-center">
                <div class="grid h-24 w-24 place-items-center border-2 border-lime bg-lime/15 backdrop-blur-sm">
                    <SparklesIcon class="h-12 w-12 text-lime" />
                </div>

                <div>
                    <p class="eyebrow text-lime">Kiosk Siap</p>
                    <h1 class="display mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
                        Belum ada event aktif
                    </h1>
                    <p class="mt-4 text-[15px] leading-7 text-white/70">
                        Pilih event dari daftar yang tersedia untuk memulai sesi
                        photobooth.
                    </p>
                </div>

                <button type="button"
                    class="group inline-flex items-center gap-4 border-4 border-ink bg-lime px-12 py-6 text-xl font-bold text-ink shadow-brutal-xl transition-all active:translate-y-1 active:shadow-brutal-sm sm:px-16 sm:py-7 sm:text-2xl"
                    @click="goToEventPicker">
                    <ArrowsRightLeftIcon class="h-7 w-7 sm:h-8 sm:w-8" />
                    <span class="display tracking-[-.02em]">Pilih Event</span>
                </button>
            </div>

            <!-- ==================================================
                 ACTIVE EVENT — the money shot
                 ================================================== -->
            <div v-else class="flex w-full max-w-5xl flex-col items-center text-center">
                <!-- Eyebrow / label -->
                <div
                    class="slide-in-down eyebrow mb-8 inline-flex items-center gap-3 border border-lime/40 bg-ink/50 px-4 py-2 backdrop-blur-md">
                    <span class="relative flex h-2 w-2 items-center justify-center">
                        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-75" />
                        <span class="relative inline-flex h-2 w-2 rounded-full bg-lime" />
                    </span>
                    <span class="text-lime">Sesi Photobooth Siap</span>
                </div>

                <!-- Title -->
                <h1
                    class="slide-in-up display text-5xl font-bold leading-[1] tracking-[-.045em] text-white drop-shadow-[0_8px_30px_rgba(0,0,0,0.7)] sm:text-6xl lg:text-7xl xl:text-[7.5rem]">
                    {{ activeEvent.title }}
                </h1>

                <!-- Decorative divider -->
                <div class="slide-in-up delay-200 mt-8 flex items-center gap-3" aria-hidden="true">
                    <span class="h-px w-12 bg-lime/60 sm:w-20" />
                    <span class="h-1.5 w-1.5 rotate-45 bg-lime" />
                    <span class="h-px w-12 bg-lime/60 sm:w-20" />
                </div>

                <!-- Subtitle -->
                <p v-if="activeEvent.subtitle"
                    class="slide-in-up delay-300 mt-8 max-w-3xl text-xl leading-9 text-white/80 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:text-2xl sm:leading-10">
                    {{ activeEvent.subtitle }}
                </p>

                <!-- ==================================================
                     MULAI button — hero
                     ================================================== -->
                <div class="slide-in-up delay-500 relative mt-20">
                    <!-- Glow behind button -->
                    <div class="pointer-events-none absolute -inset-8 rounded-full bg-lime/20 blur-3xl"
                        aria-hidden="true" />

                    <!-- Secondary ring (breathing) -->
                    <div class="breath pointer-events-none absolute -inset-3 border-2 border-lime/30"
                        aria-hidden="true" />

                    <!-- Button -->
                    <button type="button"
                        class="group glow-pulse relative inline-flex items-center justify-center gap-5 border-4 border-ink bg-lime px-20 py-8 text-3xl font-bold text-ink transition-all duration-200 active:translate-y-1 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-70 sm:px-28 sm:py-9 sm:text-4xl lg:px-32 lg:py-10 lg:text-5xl"
                        :disabled="starting" @click="startSession">
                        <PlayIcon
                            class="h-10 w-10 shrink-0 transition-transform duration-300 group-hover:scale-110 group-active:scale-95 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
                            :class="starting && 'animate-pulse'" />
                        <span class="display tracking-[-.03em]">
                            {{ starting ? 'Memulai...' : 'MULAI' }}
                        </span>

                        <!-- Shine sweep on hover -->
                        <span class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                            <span
                                class="marquee-accent absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                style="animation-play-state: paused" />
                        </span>
                    </button>
                </div>
            </div>
        </main>

        <!-- ============================================================
             BOTTOM — subtle brand / footer
             ============================================================ -->
        <footer class="fade-in delay-900 relative z-20 flex items-center justify-center px-6 py-4 lg:px-10">

        </footer>

        <!-- Settings Modal -->
        <SettingsModal :show="showSettings" :active-event="activeEvent ?? null" @close="showSettings = false"
            @go-to-dashboard="goToDashboard" @go-to-event-picker="goToEventPicker" />
    </div>
</template>