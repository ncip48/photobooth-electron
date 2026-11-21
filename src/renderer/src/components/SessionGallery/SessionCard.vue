<script setup lang="ts">
import { PhotoIcon } from '@heroicons/vue/24/outline'
import type { PhotoboothSession } from '@/composables/useSessionGallery'

defineProps<{
    session: PhotoboothSession
}>()
</script>

<template>
    <div class="card group relative aspect-[3/4] overflow-hidden border-2 border-ink bg-ink">
        <img v-if="session.preview" :src="session.preview.url" :alt="session.preview.filename"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div v-else class="grid-pattern grid h-full w-full place-items-center opacity-40">
            <PhotoIcon class="h-10 w-10 text-white/40" />
        </div>
    </div>
</template>