<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import {
    PlayIcon,
    ArrowsRightLeftIcon,
    Cog6ToothIcon,
    MapPinIcon,
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
   Data — via TanStack Query
   ========================================================= */
const { data: activeEvent, isLoading, isError } = useActiveEvent()
const { data: events } = useEvents()
const availableEventCount = useAvailableEventCount()
const startMutation = useStartSession()

const starting = computed(() => startMutation.isPending.value)

const startSession = () => {
    if (!activeEvent.value?.id || starting.value) return

    startMutation.mutate(activeEvent.value.id, {
        onSuccess: (data) => {
            const sessionId = data?.session_id ?? data?.id
            router.push({
                name: 'payment',
                params: { sessionId: sessionId ? String(sessionId) : undefined },
            })
        },
        onError: (err) => {
            console.error('Failed to start session:', err)
        },
    })
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
   Settings modal
   ========================================================= */
const showSettings = ref(false)

const goToEventPicker = () => {
    showSettings.value = false
    router.push({ name: 'event-picker' })
}

const goToDashboard = () => {
    showSettings.value = false
    // Electron: bisa buka window baru ke dashboard web, atau route internal
    // router.push({ name: 'dashboard' })
    if (window.electron) {
        // optional: open dashboard URL di browser default
        // window.open('http://localhost:8000/dashboard', '_blank')
    }
}

/* =========================================================
   Keyboard — Space / Enter = start
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
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
})

/* Prevent right-click */
onMounted(() => {
    document.addEventListener('contextmenu', (e) => e.preventDefault())
})
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-ink text-white select-none"
        @contextmenu.prevent>
        <!-- ============ BACKGROUND ============ -->
        <div class="absolute inset-0 z-0">
            <img v-if="activeEvent?.background_url" :src="activeEvent.background_url" :alt="activeEvent.title"
                class="h-full w-full object-cover" />
            <div v-else class="grid-pattern h-full w-full bg-ink" />

            <div class="absolute inset-0 backdrop-blur-[2px]" style="
                    background: radial-gradient(
                        ellipse at center,
                        rgba(32, 32, 30, 0.3) 0%,
                        rgba(32, 32, 30, 0.7) 55%,
                        rgba(32, 32, 30, 0.95) 100%
                    );
                " aria-hidden="true" />

            <div class="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/85 to-transparent" aria-hidden="true" />
            <div class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/90 to-transparent"
                aria-hidden="true" />

            <div class="absolute inset-0 opacity-[0.03] mix-blend-overlay" style="
                    background-image: radial-gradient(
                        rgba(255, 255, 255, 0.5) 1px,
                        transparent 1px
                    );
                    background-size: 3px 3px;
                " aria-hidden="true" />
        </div>

        <!-- ============ TOP BAR ============ -->
        <header class="relative flex items-center justify-between gap-4 px-6 py-5 lg:px-10">
            <div class="flex items-baseline gap-4">
                <p class="display text-3xl font-bold leading-none tracking-tight text-white sm:text-4xl">
                    {{ timeLabel }}
                </p>
                <p class="hidden text-[12.5px] text-white/60 sm:block">
                    {{ dateLabel }}
                </p>
            </div>

            <div class="flex items-center gap-3">
                <button type="button"
                    class="inline-flex items-center gap-2.5 border-2 border-white/25 bg-ink/60 px-4 py-3 text-[13px] font-bold text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    :disabled="availableEventCount === 0" @click="goToEventPicker">
                    <ArrowsRightLeftIcon class="h-4 w-4" />
                </button>

                <button type="button"
                    class="grid h-12 w-12 shrink-0 place-items-center border-2 border-white/25 bg-ink/60 text-white backdrop-blur-md transition-all active:scale-95 hover:border-lime hover:bg-lime hover:text-ink"
                    aria-label="Pengaturan" @click="showSettings = true">
                    <Cog6ToothIcon class="h-5 w-5" />
                </button>
            </div>
        </header>

        <!-- ============ MAIN ============ -->
        <main class="relative flex flex-1 flex-col items-center justify-center px-6 py-6 lg:px-10">
            <!-- Loading state -->
            <div v-if="isLoading" class="mx-auto flex flex-col items-center gap-4 text-center">
                <div class="h-12 w-12 animate-spin border-4 border-lime/30 border-t-lime" />
                <p class="display text-lg font-bold text-white/80">
                    Memuat event...
                </p>
            </div>

            <!-- Error state -->
            <div v-else-if="isError" class="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
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
            <div v-else-if="!activeEvent" class="mx-auto flex max-w-xl flex-col items-center gap-7 text-center">
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

            <!-- Active event -->
            <div v-else class="flex w-full max-w-4xl flex-col items-center text-center">
                <h1
                    class="display text-5xl font-bold leading-[1.05] tracking-[-.03em] text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl xl:text-8xl">
                    {{ activeEvent.title }}
                </h1>

                <p v-if="activeEvent.subtitle"
                    class="mt-6 max-w-3xl text-lg leading-8 text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)] sm:text-xl sm:leading-9">
                    {{ activeEvent.subtitle }}
                </p>

                <!-- <div v-if="activeEvent.location"
                    class="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-white/70">
                    <span class="inline-flex items-center gap-2">
                        <MapPinIcon class="h-4 w-4 text-lime" />
                        {{ activeEvent.location }}
                    </span>
                </div> -->

                <button type="button"
                    class="group relative mt-14 inline-flex items-center justify-center gap-5 border-4 border-ink bg-lime px-16 py-7 text-3xl font-bold text-ink shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-wait disabled:opacity-70 sm:px-24 sm:py-8 sm:text-4xl lg:px-28 lg:py-9 lg:text-5xl"
                    :disabled="starting" @click="startSession">
                    <PlayIcon
                        class="h-10 w-10 shrink-0 transition-transform group-active:scale-95 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
                        :class="starting && 'animate-pulse'" />
                    <span class="display tracking-[-.02em]">
                        {{ starting ? 'Memulai...' : 'MULAI' }}
                    </span>
                </button>
            </div>
        </main>

        <!-- ============ SETTINGS MODAL ============ -->
        <SettingsModal :show="showSettings" :active-event="activeEvent ?? null" @close="showSettings = false"
            @go-to-dashboard="goToDashboard" @go-to-event-picker="goToEventPicker" />
    </div>
</template>