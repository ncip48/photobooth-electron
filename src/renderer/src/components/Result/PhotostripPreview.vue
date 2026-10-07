<script setup lang="ts">
import { PhotoIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

interface Photostrip {
    id: string
    url: string
    filename: string
}

withDefaults(
    defineProps<{
        photostrip?: Photostrip | null
        eventTitle?: string
        loading?: boolean
    }>(),
    {
        photostrip: null,
        eventTitle: '',
        loading: false,
    }
)
</script>

<template>
    <section class="flex min-h-0 flex-col">
        <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
            <!-- Header -->
            <header
                class="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-soft px-4 py-3">
                <div class="flex items-center gap-2.5">
                    <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                        <PhotoIcon class="h-4 w-4 text-ink" />
                    </span>
                    <div class="min-w-0">
                        <p class="eyebrow text-ink/50">Hasil Photostrip</p>
                        <p class="display truncate text-[13.5px] font-bold text-ink" :class="loading && 'text-ink/40'">
                            <template v-if="loading">
                                <span class="inline-block h-3.5 w-24 animate-pulse bg-ink/10" />
                            </template>
                            <template v-else>
                                {{ eventTitle }}
                            </template>
                        </p>
                    </div>
                </div>

                <span v-if="!loading && photostrip"
                    class="display shrink-0 border-2 border-ink bg-paper px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-ink/70">
                    Selesai
                </span>
                <span v-else-if="loading" class="h-6 w-16 shrink-0 animate-pulse bg-ink/10" />
            </header>

            <!-- Preview -->
            <div class="relative min-h-0 flex-1 overflow-hidden bg-ink/5 p-4 sm:p-5">
                <!-- ============================================================
                     SKELETON LOADING
                     ============================================================ -->
                <div v-if="loading" class="grid h-full place-items-center">
                    <div class="aspect-[2/3] w-full max-w-[280px] animate-pulse border-4 border-ink/20 bg-paper-soft"
                        style="max-height: 100%">
                        <div class="grid h-full w-full place-items-center">
                            <PhotoIcon class="h-12 w-12 text-ink/10" />
                        </div>
                    </div>
                </div>

                <!-- ============================================================
                     PHOTOSTRIP
                     ============================================================ -->
                <div v-else-if="photostrip" class="grid h-full place-items-center">
                    <img :src="photostrip.url" :alt="photostrip.filename"
                        class="block max-h-full max-w-full border-4 border-ink object-contain shadow-brutal-xl" />
                </div>

                <!-- ============================================================
                     EMPTY STATE
                     ============================================================ -->
                <div v-else class="grid h-full place-items-center text-center">
                    <div>
                        <span class="mx-auto grid h-16 w-16 place-items-center border-2 border-ink bg-paper">
                            <ExclamationTriangleIcon class="h-7 w-7 text-ink/40" />
                        </span>
                        <p class="display mt-4 text-[14px] font-bold text-ink">
                            Photostrip belum tersedia
                        </p>
                        <p class="mt-1 text-[12.5px] text-ink/55">
                            Coba kembali ke editor dan simpan design.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>