<script setup lang="ts">
import {
    CameraIcon,
    ExclamationTriangleIcon,
    PhotoIcon,
    XMarkIcon,
} from '@heroicons/vue/24/outline'
import type { CaptureItem } from '@/composables/useCaptures'

withDefaults(
    defineProps<{
        gallery: CaptureItem[]
        totalCaptures: number
        galleryLoading?: boolean
        deletingId?: string | null
        deleteError?: string
    }>(),
    {
        galleryLoading: false,
        deletingId: null,
        deleteError: '',
    }
)

const emit = defineEmits<{
    (e: 'delete', item: CaptureItem): void
}>()
</script>

<template>
    <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex shrink-0 items-center justify-between gap-3 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <div class="flex items-center gap-2.5">
                <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                    <PhotoIcon class="h-4 w-4 text-ink" />
                </span>
                <div class="min-w-0 flex-1">
                    <p class="eyebrow text-ink/50">Hasil Jepretan</p>
                    <p class="display text-[13.5px] font-bold text-ink" :class="galleryLoading && 'text-ink/40'">
                        <template v-if="galleryLoading">
                            <span class="inline-block h-3 w-16 animate-pulse bg-ink/10" />
                        </template>
                        <template v-else>
                            {{ totalCaptures }} foto
                        </template>
                    </p>
                </div>
            </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <!-- Error -->
            <div v-if="deleteError" class="mb-3 flex items-start gap-2.5 border-2 border-ink bg-rose p-3">
                <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                <p class="text-[12px] leading-5 text-ink">{{ deleteError }}</p>
            </div>

            <!-- Skeleton -->
            <div v-if="galleryLoading" class="space-y-3">
                <div v-for="i in 3" :key="i" class="relative overflow-hidden border-2 border-ink/20 bg-paper-soft">
                    <div class="aspect-[3/4] w-full animate-pulse bg-ink/10" />
                    <div
                        class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink/20 bg-paper-soft text-[11px] font-bold text-ink/20">
                        {{ i }}
                    </div>
                </div>
            </div>

            <!-- Empty -->
            <div v-else-if="gallery.length === 0" class="grid h-full place-items-center px-4 py-10 text-center">
                <div>
                    <span class="mx-auto grid h-16 w-16 place-items-center border-2 border-ink bg-paper">
                        <CameraIcon class="h-7 w-7 text-ink/30" />
                    </span>
                    <p class="display mt-4 text-[13.5px] font-bold text-ink/60">
                        Belum ada foto
                    </p>
                    <p class="mt-1 text-[12px] text-ink/45">
                        Tekan "Jepret" untuk mulai
                    </p>
                </div>
            </div>

            <!-- List -->
            <div v-else class="space-y-3">
                <div v-for="(item, idx) in gallery" :key="item.id ?? idx"
                    class="group relative overflow-hidden border-2 border-ink bg-paper-soft">
                    <img :src="item.url" :alt="item.filename" class="block w-full object-cover" :class="[
                        item.uploading && 'opacity-70',
                        item.failed && 'grayscale',
                    ]" />

                    <div
                        class="display absolute left-2 top-2 grid h-7 w-7 place-items-center border-2 border-ink bg-lime text-[11px] font-bold text-ink">
                        {{ idx + 1 }}
                    </div>

                    <!-- Uploading overlay -->
                    <div v-if="item.uploading"
                        class="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-sm">
                        <div class="flex flex-col items-center gap-2">
                            <div class="h-6 w-6 animate-spin border-2 border-white/30 border-t-white" />
                            <span class="text-[10px] font-bold uppercase tracking-wider text-white">
                                Uploading
                            </span>
                        </div>
                    </div>

                    <!-- Failed -->
                    <div v-if="item.failed"
                        class="absolute inset-0 grid place-items-center bg-rose/80 backdrop-blur-sm">
                        <div class="flex flex-col items-center gap-2 px-3 text-center">
                            <ExclamationTriangleIcon class="h-6 w-6 text-ink" />
                            <span class="text-[10px] font-bold uppercase tracking-wider text-ink">
                                Gagal Upload
                            </span>
                        </div>
                    </div>

                    <!-- Delete -->
                    <button v-if="!item.uploading" type="button"
                        class="absolute right-2 top-2 grid h-8 w-8 place-items-center border-2 border-ink bg-rose text-ink shadow-brutal-sm transition-all active:translate-y-0.5 hover:bg-[#b3261e] hover:text-white disabled:cursor-wait disabled:opacity-60"
                        :disabled="deletingId === item.id" :aria-label="`Hapus foto ${idx + 1}`" title="Hapus foto"
                        @click.stop="emit('delete', item)">
                        <XMarkIcon class="h-4 w-4" :class="deletingId === item.id && 'animate-pulse'" />
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>