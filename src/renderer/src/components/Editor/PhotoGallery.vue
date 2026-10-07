<script setup lang="ts">
import { PhotoIcon } from '@heroicons/vue/24/outline'

interface Photo {
    id: string
    filename: string
    url: string
}

withDefaults(
    defineProps < {
        photos: Photo[]
        photoInHand?: Photo | null
        loading?: boolean
    } > (),
    {
        photoInHand: null,
        loading: false,
    }
)

const emit = defineEmits < {
    (e: 'select', photo: Photo): void
}> ()
</script>

<template>
    <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex shrink-0 items-center gap-2.5 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                <PhotoIcon class="h-4 w-4 text-ink" />
            </span>
            <div class="min-w-0 flex-1">
                <p class="eyebrow text-ink/50">Galeri Foto</p>
                <p class="display text-[13.5px] font-bold text-ink" :class="loading && 'text-ink/40'">
                    <template v-if="loading">
                        <span class="inline-block h-3 w-16 animate-pulse bg-ink/10" />
                    </template>
                    <template v-else>
                        {{ photos.length }} tersedia
                    </template>
                </p>
            </div>
        </header>

        <!-- Body -->
        <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <!-- ============================================================
                 SKELETON LOADING
                 ============================================================ -->
            <div v-if="loading" class="space-y-3">
                <div v-for="i in 4" :key="i" class="relative overflow-hidden border-2 border-ink/20 bg-paper-soft">
                    <!-- Image skeleton -->
                    <div class="aspect-[3/4] w-full animate-pulse bg-ink/10" />

                    <!-- Number badge skeleton -->
                    <div
                        class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink/20 bg-paper-soft text-[11px] font-bold text-ink/20">
                        {{ i }}
                    </div>
                </div>
            </div>

            <!-- ============================================================
                 EMPTY STATE
                 ============================================================ -->
            <div v-else-if="photos.length === 0" class="grid h-full place-items-center px-4 py-10 text-center">
                <div>
                    <span class="mx-auto grid h-14 w-14 place-items-center border-2 border-ink bg-paper">
                        <PhotoIcon class="h-6 w-6 text-ink/30" />
                    </span>
                    <p class="display mt-3 text-[13px] font-bold text-ink/60">
                        Belum ada foto
                    </p>
                    <p class="mt-1 text-[12px] text-ink/45">
                        Ambil foto dulu di halaman capture
                    </p>
                </div>
            </div>

            <!-- ============================================================
                 PHOTO LIST
                 ============================================================ -->
            <div v-else class="space-y-3">
                <button v-for="(photo, idx) in photos" :key="photo.id" type="button"
                    class="group relative block w-full overflow-hidden border-2 bg-paper-soft text-left transition-all"
                    :class="photoInHand?.id === photo.id
                            ? 'border-blue ring-4 ring-blue/30'
                            : 'border-ink hover:-translate-y-0.5'
                        " @click="emit('select', photo)">
                    <img :src="photo.url" :alt="photo.filename" class="block w-full object-cover" />

                    <!-- Number badge -->
                    <div
                        class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink bg-paper-soft text-[11px] font-bold text-ink">
                        {{ idx + 1 }}
                    </div>

                    <!-- Selected overlay -->
                    <div v-if="photoInHand?.id === photo.id"
                        class="absolute inset-0 grid place-items-center bg-blue/20 backdrop-blur-sm">
                        <span
                            class="display border-2 border-ink bg-lime px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-ink">
                            Dipilih
                        </span>
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>