<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import SessionGalleryHeader from '@/components/SessionGallery/SessionGalleryHeader.vue'
import SessionGallerySkeleton from '@/components/SessionGallery/SessionGallerySkeleton.vue'
import SessionGalleryEmpty from '@/components/SessionGallery/SessionGalleryEmpty.vue'
import SessionCard from '@/components/SessionGallery/SessionCard.vue'
import PrintModal from '@/components/SessionGallery/PrintModal.vue'
import { useSessionGallery, type PhotoboothSession } from '@/composables/useSessionGallery'

const router = useRouter()
const { data: sessions, isLoading, isError, refetch } = useSessionGallery()

const close = () => router.push({ name: 'start' })
const retry = () => refetch()

// Modal state
const selectedSession = ref<PhotoboothSession | null>(null)

const openPrintModal = (session: PhotoboothSession) => {
    selectedSession.value = session
}

const closePrintModal = () => {
    selectedSession.value = null
}
</script>

<template>
    <div class="min-h-screen bg-paper text-ink">
        <SessionGalleryHeader :loading="isLoading" @close="close" @refresh="retry" />

        <main class="mx-auto max-w-6xl px-6 py-8">
            <SessionGallerySkeleton v-if="isLoading" />

            <div v-else-if="isError" class="card grid place-items-center px-6 py-20 text-center">
                <p class="display text-lg font-bold text-ink">Gagal memuat sesi</p>
                <p class="mt-1 max-w-sm text-[13px] leading-6 text-ink/55">
                    Periksa koneksi internet lalu coba lagi.
                </p>
                <button type="button"
                    class="display mt-6 inline-flex items-center gap-2 border-4 border-ink bg-lime px-6 py-3 text-base font-bold text-ink shadow-brutal-lg transition-all active:translate-y-1 active:shadow-brutal-sm"
                    @click="retry">
                    Muat Ulang
                </button>
            </div>

            <SessionGalleryEmpty v-else-if="!sessions || sessions.length === 0" @retry="retry" />

            <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <SessionCard v-for="s in sessions" :key="s.id" :session="s" @select="openPrintModal" />
            </div>
        </main>

        <!-- Print Modal -->
        <PrintModal v-if="selectedSession" :session="selectedSession" @close="closePrintModal" />
    </div>
</template>