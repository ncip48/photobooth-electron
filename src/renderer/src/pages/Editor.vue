<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
    ClockIcon,
    ArrowRightIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
} from '@heroicons/vue/24/outline'
import PhotoGallery from '@/components/Editor/PhotoGallery.vue'
import TemplateCanvas from '@/components/Editor/TemplateCanvas.vue'
import TemplatePicker from '@/components/Editor/TemplatePicker.vue'
import PhotoTransformControls from '@/components/Editor/PhotoTransformControls.vue'
import {
    useEditorPhotos,
    useEditorTemplates,
    useEditorActions,
    type Photo,
    type Template,
    type Placement,
} from '@/composables/useEditor'
import { useActiveEvent } from '@/composables/useEvents'

/* =========================================================
   Route + Event
   ========================================================= */
const route = useRoute()
const router = useRouter()
const sessionId = computed(() => route.params.sessionId as string)

const { data: event } = useActiveEvent()

/* =========================================================
   Fetch — independent loading state per query
   ========================================================= */
const { data: photosData, isLoading: photosLoading } =
    useEditorPhotos(sessionId)
const { data: templatesData, isLoading: templatesLoading } =
    useEditorTemplates(sessionId)

const photos = computed<Photo[]>(() => photosData.value ?? [])
const templates = computed<Template[]>(() => templatesData.value ?? [])

/* =========================================================
   Editor actions
   ========================================================= */
const {
    saving,
    finishing,
    error: actionError,
    saveDesign,
    finishEditor,
} = useEditorActions(sessionId)

/* =========================================================
   Timer
   ========================================================= */
const totalSeconds = ref(300)
const remaining = ref(300)
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStarted = false

watch(
    () => event.value,
    (evt) => {
        if (!evt || timerStarted) return
        totalSeconds.value = evt.time_download ?? 300
        remaining.value = totalSeconds.value
        timerStarted = true
        startTimer()
    },
    { immediate: true }
)

const mmss = computed(() => {
    const m = Math.floor(remaining.value / 60)
    const s = remaining.value % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const isExpired = computed(() => remaining.value <= 0)
const isLowTime = computed(() => remaining.value <= 10 && remaining.value > 0)

function startTimer() {
    stopTimer()
    timerInterval = setInterval(() => {
        if (remaining.value > 0) remaining.value--
        else stopTimer()
    }, 1000)
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
}

/* =========================================================
   Editor state
   ========================================================= */
const selectedTemplateId = ref<string | null>(null)
const photoInHand = ref<Photo | null>(null)
const selectedDropzoneId = ref<string | null>(null)
const placements = ref<Record<string, Placement>>({})

watch(templates, (list) => {
    if (!selectedTemplateId.value && list.length > 0) {
        selectedTemplateId.value = list[0].id
    }
})

const selectedTemplate = computed(
    () =>
        templates.value.find((t) => t.id === selectedTemplateId.value) ??
        null
)

const selectedPlacement = computed(() =>
    selectedDropzoneId.value
        ? placements.value[selectedDropzoneId.value] ?? null
        : null
)

/* =========================================================
   Actions
   ========================================================= */
function handlePhotoClick(photo: Photo) {
    if (photoInHand.value?.id === photo.id) {
        photoInHand.value = null
        return
    }
    photoInHand.value = photo
    selectedDropzoneId.value = null
}

function handleDropzoneClick(dropzone: any) {
    if (photoInHand.value) {
        placePhoto(dropzone.id, photoInHand.value.id)
        photoInHand.value = null
        return
    }
    selectedDropzoneId.value = dropzone.id
}

function placePhoto(dropzoneId: string, photoId: string) {
    placements.value = {
        ...placements.value,
        [dropzoneId]: {
            photoId,
            transform: { scale: 1, rotate: 0, x: 0, y: 0 },
        },
    }
}

function clearDropzone(dropzoneId: string) {
    const next = { ...placements.value }
    delete next[dropzoneId]
    placements.value = next
    selectedDropzoneId.value = null
}

function updateTransform(dropzoneId: string, transform: any) {
    if (!placements.value[dropzoneId]) return
    placements.value = {
        ...placements.value,
        [dropzoneId]: {
            ...placements.value[dropzoneId],
            transform: { ...transform },
        },
    }
}

function handleTemplateChange(templateId: string) {
    selectedTemplateId.value = templateId
    placements.value = {}
    selectedDropzoneId.value = null
}

/* =========================================================
   Composite
   ========================================================= */
async function compositePhotostrip(): Promise<Blob> {
    if (!selectedTemplate.value) throw new Error('Belum ada template dipilih.')

    const tpl = selectedTemplate.value
    const canvasW = tpl.size?.width ?? 1200
    const canvasH = tpl.size?.height ?? 1800

    const canvas = document.createElement('canvas')
    canvas.width = canvasW
    canvas.height = canvasH
    const ctx = canvas.getContext('2d')!

    if (tpl.location_url) {
        await drawImageCover(ctx, tpl.location_url, 0, 0, canvasW, canvasH)
    } else {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasW, canvasH)
    }

    for (const dz of tpl.dropzones ?? []) {
        const placement = placements.value[dz.id]
        if (!placement) continue

        const photo = photos.value.find((p) => p.id === placement.photoId)
        if (!photo?.url) continue

        const t = placement.transform ?? { scale: 1, rotate: 0, x: 0, y: 0 }
        const { width: coverW, height: coverH } = await computeCoverSize(
            photo.url,
            dz.width,
            dz.height
        )

        ctx.save()
        ctx.beginPath()
        ctx.rect(dz.left, dz.top, dz.width, dz.height)
        ctx.clip()

        const cx = dz.left + dz.width / 2
        const cy = dz.top + dz.height / 2

        ctx.translate(cx, cy)
        ctx.translate(t.x, t.y)
        ctx.scale(t.scale, t.scale)
        ctx.rotate((t.rotate * Math.PI) / 180)

        await drawImageCentered(ctx, photo.url, coverW, coverH)
        ctx.restore()
    }

    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )
    if (!blob) throw new Error('Gagal membuat composite.')
    return blob
}

function drawImageCover(
    ctx: CanvasRenderingContext2D,
    url: string,
    dx: number,
    dy: number,
    dW: number,
    dH: number
) {
    return new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const imgRatio = img.naturalWidth / img.naturalHeight
            const boxRatio = dW / dH
            let sx = 0,
                sy = 0,
                sW = img.naturalWidth,
                sH = img.naturalHeight
            if (imgRatio > boxRatio) {
                sW = img.naturalHeight * boxRatio
                sx = (img.naturalWidth - sW) / 2
            } else {
                sH = img.naturalWidth / boxRatio
                sy = (img.naturalHeight - sH) / 2
            }
            ctx.drawImage(img, sx, sy, sW, sH, dx, dy, dW, dH)
            resolve()
        }
        img.onerror = reject
        img.src = url
    })
}

function drawImageCentered(
    ctx: CanvasRenderingContext2D,
    url: string,
    w: number,
    h: number
) {
    return new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            ctx.drawImage(img, -w / 2, -h / 2, w, h)
            resolve()
        }
        img.onerror = reject
        img.src = url
    })
}

function computeCoverSize(url: string, boxW: number, boxH: number) {
    return new Promise<{ width: number; height: number }>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            const photoRatio = img.naturalWidth / img.naturalHeight
            const boxRatio = boxW / boxH
            if (photoRatio > boxRatio) {
                resolve({ width: boxH * photoRatio, height: boxH })
            } else {
                resolve({ width: boxW, height: boxW / photoRatio })
            }
        }
        img.onerror = () => resolve({ width: boxW, height: boxH })
        img.src = url
    })
}

/* =========================================================
   Can proceed
   ========================================================= */
const canProceed = computed(() => {
    if (!selectedTemplate.value) return false
    if (Object.keys(placements.value).length === 0) return false
    return true
})

/* =========================================================
   Go Next
   ========================================================= */
async function goNext() {
    if (!canProceed.value || finishing.value || saving.value) return

    try {
        const photostripBlob = await compositePhotostrip()

        await saveDesign(
            String(selectedTemplateId.value),
            placements.value,
            photostripBlob
        )

        await finishEditor()

        // =========================================================
        // AUTO SILENT PRINT (uncomment kalau butuh)
        // =========================================================
        //
        // try {
        //     await silentPrint({ copies: 1 })
        //     console.log('[Editor] Auto-print triggered')
        // } catch (printErr) {
        //     console.error('[Editor] Auto-print failed:', printErr)
        // }
        //
        // =========================================================

        router.push({
            name: 'result',
            params: { sessionId: sessionId.value },
        })
    } catch (err: any) {
        console.error('Go next failed:', err)
    }
}

onBeforeUnmount(() => {
    stopTimer()
})
</script>

<template>
    <div class="relative flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink">
        <main
            class="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)_280px] lg:gap-5">
            <!-- KIRI: Photo Gallery -->
            <aside class="order-2 flex min-h-0 flex-col lg:order-1">
                <PhotoGallery :photos="photos" :photo-in-hand="photoInHand" :loading="photosLoading"
                    @select="handlePhotoClick" />
            </aside>

            <!-- TENGAH: Canvas -->
            <section class="order-1 flex min-h-0 flex-col gap-4 lg:order-2">
                <div class="flex shrink-0 items-center justify-between gap-3">
                    <div class="flex items-center gap-2 border-2 px-3 py-1.5 transition-colors" :class="isExpired
                            ? 'border-[#b3261e] bg-rose'
                            : isLowTime
                                ? 'border-ink bg-amber'
                                : 'border-ink bg-paper-soft'
                        ">
                        <ClockIcon class="h-3.5 w-3.5 shrink-0" :class="isLowTime && !isExpired
                                ? 'animate-pulse text-ink'
                                : 'text-ink/60'
                            " />
                        <span class="display text-base font-bold leading-none tracking-tight tabular-nums text-ink">
                            {{ mmss }}
                        </span>
                    </div>

                    <div class="flex items-center gap-2 px-3 py-1.5 text-[12.5px]" :class="photoInHand
                            ? 'border-2 border-blue bg-blue/10 text-ink'
                            : 'text-ink/55'
                        ">
                        <template v-if="photoInHand">
                            <span class="display font-bold text-blue">
                                Foto terpilih
                            </span>
                            <span class="text-ink/70">— klik frame untuk menempatkan</span>
                        </template>
                        <template v-else-if="selectedPlacement">
                            <span class="display font-bold text-ink">Edit foto</span>
                            <span class="text-ink/70">— atur zoom, rotasi, posisi di panel
                                kanan</span>
                        </template>
                        <template v-else>
                            <span>Klik foto di kiri, lalu klik frame di
                                kanvas</span>
                        </template>
                    </div>
                </div>

                <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
                    <TemplateCanvas :template="selectedTemplate" :photos="photos" :placements="placements"
                        :photo-in-hand="photoInHand" :selected-dropzone-id="selectedDropzoneId"
                        :loading="templatesLoading" @dropzone-click="handleDropzoneClick"
                        @dropzone-deselect="selectedDropzoneId = null" @clear-dropzone="clearDropzone" />
                </div>

                <div v-if="actionError" class="flex shrink-0 items-start gap-2.5 border-2 border-ink bg-rose p-3.5">
                    <ExclamationTriangleIcon class="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    <p class="text-[12.5px] leading-5 text-ink">
                        {{ actionError }}
                    </p>
                </div>

                <button type="button"
                    class="display inline-flex w-full shrink-0 items-center justify-center gap-4 border-4 border-ink bg-lime px-8 py-4 text-2xl font-bold text-ink shadow-brutal-xl transition-all duration-150 active:translate-y-2 active:shadow-brutal-sm disabled:cursor-not-allowed disabled:opacity-40 sm:text-3xl"
                    :disabled="!canProceed || finishing || saving" @click="goNext">
                    <CheckCircleIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                        :class="(finishing || saving) && 'animate-pulse'" />
                    <span class="tracking-[-.02em]">
                        {{ finishing || saving ? 'Menyimpan...' : 'Lanjut' }}
                    </span>
                    <ArrowRightIcon class="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
                </button>
            </section>

            <!-- KANAN: Template + Transform -->
            <aside class="order-3 flex min-h-0 flex-col gap-4 lg:order-3">
                <div class="card flex min-h-0 flex-1 flex-col overflow-hidden">
                    <TemplatePicker :templates="templates" :selected-id="selectedTemplateId" :loading="templatesLoading"
                        @select="handleTemplateChange" />
                </div>

                <Transition enter-active-class="transition duration-200 ease-out"
                    enter-from-class="translate-y-2 opacity-0" enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in" leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="translate-y-2 opacity-0">
                    <div v-if="selectedDropzoneId && selectedPlacement" class="card shrink-0 overflow-hidden">
                        <PhotoTransformControls :placement="selectedPlacement" :photo="photos.find(
                            (p) =>
                                p.id === selectedPlacement.photoId
                        )
                            " @update="
                                (t) =>
                                    updateTransform(selectedDropzoneId!, t)
                            " @remove="clearDropzone(selectedDropzoneId!)" />
                    </div>
                </Transition>
            </aside>
        </main>
    </div>
</template>