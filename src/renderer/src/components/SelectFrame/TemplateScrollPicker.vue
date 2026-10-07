<script setup lang="ts">
import { Squares2X2Icon } from '@heroicons/vue/24/outline'

interface Dropzone {
    id: string
    top: number
    left: number
    width: number
    height: number
}

interface TemplateSize {
    width: number
    height: number
}

interface Template {
    id: string
    name: string
    type: string
    location_url: string | null
    size: TemplateSize
    dropzones: Dropzone[]
}

withDefaults(
    defineProps<{
        templates: Template[]
        selectedId?: string | null
        loading?: boolean
    }>(),
    {
        selectedId: null,
        loading: false,
    },
)

const emit = defineEmits<{
    (e: 'select', templateId: string): void
}>()

/** Target display height of the preview, in px. Card width follows from the ratio. */
const PREVIEW_HEIGHT = 260 * 2

/** Preview width in px, from the template's real size. */
function previewWidth(tpl: Template): number {
    const w = tpl.size?.width ?? 3
    const h = tpl.size?.height ?? 4
    return Math.round(PREVIEW_HEIGHT * (w / h))
}

/**
 * Palet warna soft. Dipilih berdasarkan index dropzone,
 * cycling kalau dropzone > palet.
 */
const SOFT_COLORS = [
    'rgba(41, 69, 232, 0.18)',    // blue
    'rgba(217, 237, 147, 0.55)',  // lime
    'rgba(255, 224, 138, 0.55)',  // amber
    'rgba(255, 179, 171, 0.55)',  // rose
    'rgba(32, 32, 30, 0.15)',     // ink
    'rgba(120, 200, 255, 0.35)',  // sky
    'rgba(200, 160, 255, 0.40)',  // purple
    'rgba(160, 230, 200, 0.45)',  // mint
]

function softColor(idx: number): string {
    return SOFT_COLORS[idx % SOFT_COLORS.length]
}

/** Warna border yang lebih tegas dari fill, untuk outline kotak. */
function softBorderColor(idx: number): string {
    const base = SOFT_COLORS[idx % SOFT_COLORS.length]
    return base.replace(/[\d.]+\)$/, '0.9)')
}

/**
 * Convert dropzone (koordinat di canvas asli template)
 * ke persen relatif terhadap ukuran template.
 */
function dzStyle(tpl: Template, dz: Dropzone) {
    const w = tpl.size?.width ?? 1
    const h = tpl.size?.height ?? 1
    return {
        top: `${(dz.top / h) * 100}%`,
        left: `${(dz.left / w) * 100}%`,
        width: `${(dz.width / w) * 100}%`,
        height: `${(dz.height / h) * 100}%`,
    }
}
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header class="flex shrink-0 items-center gap-2.5 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                <Squares2X2Icon class="h-4 w-4 text-ink" />
            </span>

            <div class="min-w-0 flex-1">
                <p class="eyebrow text-ink/50">Template</p>
                <p class="display text-[13.5px] font-bold text-ink" :class="{ 'text-ink/40': loading }">
                    <template v-if="loading">
                        <span class="inline-block h-3 w-16 animate-pulse bg-ink/10" />
                    </template>
                    <template v-else>
                        {{ templates.length }} tersedia
                    </template>
                </p>
            </div>
        </header>

        <!-- Content -->
        <div class="min-h-0 flex-1">
            <!-- Loading Skeleton -->
            <div v-if="loading"
                class="scrollbar-hide flex h-full items-start gap-4 overflow-x-auto overflow-y-hidden p-4">
                <div v-for="i in 3" :key="i" class="shrink-0 animate-pulse border-2 border-ink/20 bg-paper-soft"
                    :style="{ width: `${previewWidth({ size: { width: 3, height: 4 } } as Template)}px` }">
                    <div :style="{ height: `${PREVIEW_HEIGHT}px` }" class="bg-ink/10" />
                    <div class="space-y-2 border-t-2 border-ink/10 px-3 py-2.5">
                        <div class="h-3 w-3/4 bg-ink/10" />
                        <div class="h-2.5 w-12 bg-ink/10" />
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="templates.length === 0" class="grid h-full place-items-center px-4 py-10 text-center">
                <div>
                    <span class="mx-auto grid h-14 w-14 place-items-center border-2 border-ink bg-paper">
                        <Squares2X2Icon class="h-6 w-6 text-ink/30" />
                    </span>
                    <p class="display mt-3 text-[13px] font-bold text-ink/60">
                        Belum ada template
                    </p>
                    <p class="mt-1 text-[12px] text-ink/45">
                        Template untuk event ini belum tersedia
                    </p>
                </div>
            </div>

            <!-- Template List -->
            <div v-else
                class="scrollbar-hide flex h-full items-start gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory p-4">
                <button v-for="tpl in templates" :key="tpl.id" type="button"
                    class="group relative flex shrink-0 snap-start flex-col overflow-hidden border-2 bg-paper-soft text-left transition-all"
                    :style="{ width: `${previewWidth(tpl)}px` }" :class="selectedId === tpl.id
                        ? 'border-blue ring-4 ring-blue/30'
                        : 'border-ink hover:-translate-y-0.5'
                        " @click="emit('select', tpl.id)">
                    <!-- Preview -->
                    <div class="relative w-full overflow-hidden bg-paper" :style="{ height: `${PREVIEW_HEIGHT}px` }">
                        <!-- Template Image -->
                        <img v-if="tpl.location_url" :src="tpl.location_url" :alt="tpl.name"
                            class="absolute inset-0 z-0 h-full w-full object-cover" draggable="false" />

                        <!-- No Image -->
                        <div v-else class="grid-pattern absolute inset-0 z-0 h-full w-full" />

                        <!-- ===== DROPZONE PLACEHOLDER OVERLAY ===== -->
                        <div v-if="tpl.dropzones?.length" class="pointer-events-none absolute inset-0 z-10">
                            <div v-for="(dz, i) in tpl.dropzones" :key="dz.id"
                                class="absolute flex items-center justify-center border-2 transition-colors" :style="{
                                    ...dzStyle(tpl, dz),
                                    backgroundColor: softColor(i),
                                    borderColor: softBorderColor(i),
                                }">
                                <!-- Nomor -->
                                <span
                                    class="display grid h-8 w-8 place-items-center border-2 border-ink text-[12px] font-bold text-ink sm:h-9 sm:w-9 sm:text-[14px]"
                                    :style="{
                                        backgroundColor: softBorderColor(i),
                                    }">
                                    {{ i + 1 }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Information -->
                    <div class="shrink-0 border-t-2 border-ink bg-paper-soft px-3 py-2.5">
                        <p class="display line-clamp-1 text-[13px] font-bold text-ink">
                            {{ tpl.name }}
                        </p>
                        <p class="mt-0.5 flex items-center justify-between text-[10.5px] text-ink/55">
                            <span>
                                {{ tpl.dropzones?.length ?? 0 }}x foto
                            </span>
                        </p>
                    </div>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
</style>