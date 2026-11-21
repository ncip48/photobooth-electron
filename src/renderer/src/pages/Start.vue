<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import StartAmbient from '@/components/Start/StartAmbient.vue'
import StartTopBar from '@/components/Start/StartTopBar.vue'
import StartLoading from '@/components/Start/StartLoading.vue'
import StartError from '@/components/Start/StartError.vue'
import StartNoEvent from '@/components/Start/StartNoEvent.vue'
import StartHero from '@/components/Start/StartHero.vue'
import SettingsModal from '@/components/Start/SettingsModal.vue'
import {
    useActiveEvent,
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

/* =========================================================
   Start
   ========================================================= */
const startSession = () => {
    if (!activeEvent.value?.id || starting.value) return

    if (activeEvent.value?.is_paid_event) {
        startMutation.mutate(activeEvent.value.id, {
            onSuccess: () => {
                // console.log("RESP PAID" + resp)
                router.push({ name: 'payment' })
            },
            onError: (err) => {
                console.error('Failed to start session:', err)
            },
        })
    } else {
        if (activeEvent.value?.is_simple) {
            const sessionId = '01a1d509-9f23-73f5-bdea-1f3b91a5b324'
            router.push({
                name: 'select-frame',
                params: { sessionId: String(sessionId) },
            })
        } else {
            const sessionId = '01a1d509-9f23-73f5-bdea-1f3b91a5b324'
            router.push({
                name: 'capture',
                params: { sessionId: String(sessionId) },
            })
        }
    }
}

/* =========================================================
   Gallery
   ========================================================= */
const goToGallery = () => {
    router.push('/session-gallery')
}

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

const reload = () => router.go(0)

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

        <!-- Ambient background -->
        <StartAmbient :background-url="activeEvent?.background_url ?? null" />

        <!-- Top bar -->
        <StartTopBar :available-event-count="availableEventCount" @open-settings="showSettings = true"
            @open-event-picker="goToEventPicker" />

        <!-- Main -->
        <main class="relative z-20 flex flex-1 flex-col items-center justify-center px-6 py-6 lg:px-10">
            <!-- Loading -->
            <StartLoading v-if="isLoading" />

            <!-- Error -->
            <StartError v-else-if="isError" @reload="reload" />

            <!-- No event -->
            <StartNoEvent v-else-if="!activeEvent" @pick-event="goToEventPicker" />

            <!-- Hero -->
            <StartHero v-else :event="activeEvent" :starting="starting" @start="startSession" />
        </main>

        <!-- Gallery button (bottom-left) -->
        <button type="button"
            class="group absolute bottom-6 left-6 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Open session gallery" @click="goToGallery">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="3" width="18" height="18" rx="2.5" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 15l-5-5L5 21" />
            </svg>
        </button>

        <!-- Footer -->
        <footer class="fade-in delay-900 relative z-20 flex items-center justify-center px-6 py-4 lg:px-10" />

        <!-- Settings Modal -->
        <SettingsModal :show="showSettings" :active-event="activeEvent ?? null" @close="showSettings = false"
            @go-to-dashboard="goToDashboard" @go-to-event-picker="goToEventPicker" />
    </div>
</template>