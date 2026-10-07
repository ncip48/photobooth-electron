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
                router.push({ name: 'payment' })
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
                params: { sessionId: String(sessionId) },
            })
        } else {
            const sessionId = '01a0179e-a690-7141-8c3b-4aecc12936cb'
            router.push({
                name: 'capture',
                params: { sessionId: String(sessionId) },
            })
        }
    }
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

        <!-- Footer -->
        <footer class="fade-in delay-900 relative z-20 flex items-center justify-center px-6 py-4 lg:px-10" />

        <!-- Settings Modal -->
        <SettingsModal :show="showSettings" :active-event="activeEvent ?? null" @close="showSettings = false"
            @go-to-dashboard="goToDashboard" @go-to-event-picker="goToEventPicker" />
    </div>
</template>