<script setup lang="ts">
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue'

import {
    PhotoIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
} from '@heroicons/vue/24/outline'

interface Dropzone {
    id: string
    top: number
    left: number
    width: number
    height: number
}

interface Template {
    id: string
    name: string
    type: string
    location_url: string | null
    size: { width: number; height: number }
    dropzones: Dropzone[]
}

interface Photo {
    id: string
    filename: string
    url: string
}

interface Placement {
    photoId: string
    transform: { scale: number; rotate: number; x: number; y: number }
}

const props = withDefaults(
    defineProps<{
        template?: Template | null
        photos?: Photo[]
        placements?: Record<string, Placement>
        photoInHand?: Photo | null
        selectedDropzoneId?: string | null
        loading?: boolean
    }>(),
    {
        template: null,
        photos: () => [],
        placements: () => ({}),
        photoInHand: null,
        selectedDropzoneId: null,
        loading: false,
    }
)

const emit = defineEmits<{
    (e: 'dropzone-click', dropzone: Dropzone): void
    (e: 'dropzone-deselect'): void
    (e: 'clear-dropzone', dropzoneId: string): void
}>()

/* Canvas scaling */
const containerRef = ref<HTMLElement | null>(null)
const containerSize = ref({ width: 0, height: 0 })

const templateW = computed(() => props.template?.size?.width ?? 1200)
const templateH = computed(() => props.template?.size?.height ?? 1800)

const scale = computed(() => {
    if (!containerSize.value.width || !containerSize.value.height) return 1
    const sW = containerSize.value.width / templateW.value
    const sH = containerSize.value.height / templateH.value
    return Math.min(sW, sH)
})

const displayW = computed(() => templateW.value * scale.value)
const displayH = computed(() => templateH.value * scale.value)

const updateContainerSize = () => {
    if (!containerRef.value) return
    containerSize.value = {
        width: containerRef.value.clientWidth,
        height: containerRef.value.clientHeight,
    }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
    updateContainerSize()
    if (window.ResizeObserver && containerRef.value) {
        resizeObserver = new ResizeObserver(updateContainerSize)
        resizeObserver.observe(containerRef.value)
    }
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
})

const toDisplay = (value: number) => value * scale.value

const getPlacedPhoto = (dropzoneId: string | number) => {
    const placement = props.placements[dropzoneId]
    if (!placement) return null
    return props.photos.find((p) => p.id === placement.photoId) ?? null
}

const getTransform = (dropzoneId: string) => {
    const placement = props.placements[dropzoneId]
    return placement?.transform ?? { scale: 1, rotate: 0, x: 0, y: 0 }
}

const handleDropzoneClick = (dropzone: Dropzone, event: MouseEvent) => {
    event.stopPropagation()
    emit('dropzone-click', dropzone)
}

const handleClear = (dropzoneId: string, event: MouseEvent) => {
    event.stopPropagation()
    emit('clear-dropzone', dropzoneId)
}

/* Photo dimensions cache */
const photoDimensions = ref<Record<string, { w: number; h: number }>>({})

const loadPhotoDimension = (photo: Photo) => {
    if (!photo?.url || photoDimensions.value[photo.id]) return
    const img = new Image()
    img.onload = () => {
        photoDimensions.value = {
            ...photoDimensions.value,
            [photo.id]: { w: img.naturalWidth, h: img.naturalHeight },
        }
    }
    img.src = photo.url
}

const ensurePhotoDimensions = () => {
    Object.values(props.placements).forEach((placement) => {
        const photo = props.photos.find((p) => p.id === placement.photoId)
        if (photo) loadPhotoDimension(photo)
    })
}

watch(
    () => props.placements,
    () => ensurePhotoDimensions(),
    { immediate: true, deep: true }
)

const coverWidth = (dz: Dropzone) => {
    const photo = getPlacedPhoto(dz.id)
    if (!photo) return toDisplay(dz.width)
    const dim = photoDimensions.value[photo.id]
    if (!dim) return toDisplay(dz.width)

    const boxW = toDisplay(dz.width)
    const boxH = toDisplay(dz.height)
    const photoRatio = dim.w / dim.h
    const boxRatio = boxW / boxH
    return photoRatio > boxRatio ? boxH * photoRatio : boxW
}

const coverHeight = (dz: Dropzone) => {
    const photo = getPlacedPhoto(dz.id)
    if (!photo) return toDisplay(dz.height)
    const dim = photoDimensions.value[photo.id]
    if (!dim) return toDisplay(dz.height)

    const boxW = toDisplay(dz.width)
    const boxH = toDisplay(dz.height)
    const photoRatio = dim.w / dim.h
    const boxRatio = boxW / boxH
    return photoRatio > boxRatio ? boxH : boxW / photoRatio
}

const handleBackdropClick = () => emit('dropzone-deselect')
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Header -->
        <header
            class="flex shrink-0 items-center justify-between gap-2.5 border-b-2 border-ink bg-paper-soft px-4 py-3">
            <div class="flex items-center gap-2.5">
                <span class="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink bg-lime">
                    <ArrowsPointingOutIcon class="h-4 w-4 text-ink" />
                </span>
                <div class="min-w-0">
                    <p class="eyebrow text-ink/50">Kanvas Editor</p>
                    <p class="display truncate text-[13.5px] font-bold text-ink" :class="loading && 'text-ink/40'">
                        <template v-if="loading">
                            <span class="inline-block h-3.5 w-32 animate-pulse bg-ink/10" />
                        </template>
                        <template v-else>
                            {{ template?.name ?? 'Belum ada template' }}
                        </template>
                    </p>
                </div>
            </div>

            <span v-if="!loading && template"
                class="display shrink-0 border-2 border-ink bg-paper px-2.5 py-1 text-[10.5px] font-bold tabular-nums text-ink/70">
                {{ templateW }} × {{ templateH }}
            </span>
            <span v-else-if="loading" class="h-6 w-20 shrink-0 animate-pulse bg-ink/10" />
        </header>

        <!-- Canvas -->
        <div ref="containerRef" class="relative min-h-0 flex-1 overflow-hidden bg-ink/5 p-4"
            @click="handleBackdropClick">
            <!-- ============================================================
                 SKELETON LOADING
                 ============================================================ -->
            <div v-if="loading" class="absolute inset-0 grid place-items-center p-4">
                <div class="relative aspect-[2/3] w-full max-w-[320px] animate-pulse border-4 border-ink/20 bg-paper-soft"
                    style="max-height: 100%">
                    <!-- Dropzone skeleton placeholders -->
                    <div
                        class="absolute left-[8%] top-[4%] h-[28%] w-[40%] border-2 border-dashed border-ink/20 bg-ink/5" />
                    <div
                        class="absolute right-[8%] top-[4%] h-[28%] w-[40%] border-2 border-dashed border-ink/20 bg-ink/5" />
                    <div
                        class="absolute bottom-[8%] left-[8%] h-[28%] w-[40%] border-2 border-dashed border-ink/20 bg-ink/5" />
                    <div
                        class="absolute bottom-[8%] right-[8%] h-[28%] w-[40%] border-2 border-dashed border-ink/20 bg-ink/5" />
                </div>
            </div>

            <!-- ============================================================
                 EMPTY TEMPLATE
                 ============================================================ -->
            <div v-else-if="!template" class="grid h-full place-items-center text-center">
                <div>
                    <span class="mx-auto grid h-16 w-16 place-items-center border-2 border-ink bg-paper">
                        <ArrowsPointingOutIcon class="h-7 w-7 text-ink/30" />
                    </span>
                    <p class="display mt-3 text-[13px] font-bold text-ink/60">
                        Pilih template dulu
                    </p>
                    <p class="mt-1 text-[12px] text-ink/45">
                        Pilih dari panel kanan
                    </p>
                </div>
            </div>

            <!-- ============================================================
                 TEMPLATE CANVAS
                 ============================================================ -->
            <div v-else class="absolute inset-0 grid place-items-center" @click.self="handleBackdropClick">
                <div class="relative border-4 border-ink bg-white shadow-brutal-xl" :style="{
                    width: displayW + 'px',
                    height: displayH + 'px',
                }" @click.stop>
                    <!-- Background -->
                    <img v-if="template.location_url" :src="template.location_url" :alt="template.name"
                        class="pointer-events-none absolute inset-0 h-full w-full object-cover" />
                    <div v-else class="grid-pattern absolute inset-0" />

                    <!-- Dropzones -->
                    <div v-for="(dz, idx) in template.dropzones" :key="dz.id"
                        class="group absolute cursor-pointer border-2 transition-colors" :class="[
                            selectedDropzoneId === dz.id
                                ? 'z-20 overflow-visible border-blue ring-4 ring-blue/40'
                                : photoInHand
                                    ? 'overflow-hidden border-lime border-dashed bg-lime/20 hover:bg-lime/40'
                                    : placements[dz.id]
                                        ? 'overflow-hidden border-blue/60 hover:border-blue'
                                        : 'overflow-hidden border-ink/40 border-dashed bg-ink/5 hover:bg-lime/20',
                        ]" :style="{
                            top: toDisplay(dz.top) + 'px',
                            left: toDisplay(dz.left) + 'px',
                            width: toDisplay(dz.width) + 'px',
                            height: toDisplay(dz.height) + 'px',
                        }" @click="handleDropzoneClick(dz, $event)">
                        <!-- Placed photo -->
                        <template v-if="placements[dz.id] && getPlacedPhoto(dz.id)">
                            <img :src="getPlacedPhoto(dz.id)!.url" :alt="getPlacedPhoto(dz.id)!.filename"
                                draggable="false"
                                class="pointer-events-none absolute top-1/2 left-1/2 max-w-none select-none" :class="selectedDropzoneId === dz.id
                                        ? 'opacity-75'
                                        : ''
                                    " :style="{
                                    width: coverWidth(dz) + 'px',
                                    height: coverHeight(dz) + 'px',
                                    transform: `
                                        translate(-50%, -50%)
                                        translate(${getTransform(dz.id).x}px, ${getTransform(dz.id).y}px)
                                        scale(${getTransform(dz.id).scale})
                                        rotate(${getTransform(dz.id).rotate}deg)
                                    `,
                                    transformOrigin: 'center center',
                                }" />

                            <div v-if="selectedDropzoneId === dz.id"
                                class="pointer-events-none absolute inset-0 z-10 ring-4 ring-inset ring-blue"
                                aria-hidden="true" />
                            <div v-else
                                class="pointer-events-none absolute inset-0 border-2 border-blue/40 group-hover:border-blue"
                                aria-hidden="true" />

                            <span
                                class="display pointer-events-none absolute left-1 top-1 z-30 border border-ink px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-opacity"
                                :class="selectedDropzoneId === dz.id
                                        ? 'bg-blue text-white'
                                        : 'bg-lime text-ink opacity-0 group-hover:opacity-100'
                                    ">
                                Z{{ idx + 1 }}
                                <template v-if="selectedDropzoneId === dz.id">
                                    — EDIT
                                </template>
                                <template v-else> — KLIK UNTUK EDIT</template>
                            </span>

                            <button type="button"
                                class="absolute right-1 top-1 z-40 grid h-6 w-6 place-items-center border-2 border-ink bg-rose text-ink transition-opacity hover:bg-[#b3261e] hover:text-white"
                                :class="selectedDropzoneId === dz.id
                                        ? 'opacity-100'
                                        : 'opacity-0 group-hover:opacity-100'
                                    " :aria-label="`Hapus foto dari Z${idx + 1}`" @click="handleClear(dz.id, $event)">
                                <XMarkIcon class="h-3 w-3" />
                            </button>
                        </template>

                        <!-- Empty -->
                        <template v-else>
                            <div class="pointer-events-none grid h-full w-full place-items-center text-center">
                                <div class="px-2">
                                    <span
                                        class="mx-auto grid h-10 w-10 place-items-center border-2 border-ink/40 bg-paper-soft">
                                        <PhotoIcon class="h-5 w-5 text-ink/40" />
                                    </span>
                                    <p
                                        class="display mt-1.5 text-[10.5px] font-bold uppercase tracking-wider text-ink/55">
                                        Z{{ idx + 1 }}
                                    </p>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>