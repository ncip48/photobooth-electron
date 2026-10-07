import { computed, ref, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { photoboothApi } from '@/lib/api'

export interface Photo {
    id: string
    filename: string
    url: string
}

export interface Dropzone {
    id: string
    top: number
    left: number
    width: number
    height: number
}

export interface Template {
    id: string
    name: string
    type: string
    location_url: string | null
    size: { width: number; height: number }
    dropzones: Dropzone[]
}

export interface Placement {
    photoId: string
    transform: {
        scale: number
        rotate: number
        x: number
        y: number
    }
}

/* =========================================================
   Query keys
   ========================================================= */
const photosKey = (id: Ref<string>) => ['photobooth', 'editor', id.value, 'photos']
const templatesKey = (id: Ref<string>) => ['photobooth', 'editor', id.value, 'templates']

/* =========================================================
   Fetch photos
   ========================================================= */
export function useEditorPhotos(sessionId: Ref<string>) {
    return useQuery({
        queryKey: photosKey(sessionId),
        queryFn: async () => {
            const res = await photoboothApi.getSessionPhotos(sessionId.value)
            if (!res.success) throw new Error('Gagal memuat foto.')
            return res.photos as Photo[]
        },
        staleTime: 1000 * 60,
    })
}

/* =========================================================
   Fetch templates
   ========================================================= */
export function useEditorTemplates(sessionId: Ref<string>) {
    return useQuery({
        queryKey: templatesKey(sessionId),
        queryFn: async () => {
            const res = await photoboothApi.getTemplates(sessionId.value)
            if (!res.success) throw new Error('Gagal memuat template.')
            return res.templates as Template[]
        },
        staleTime: 1000 * 60,
    })
}

/* =========================================================
   Save + finish mutations
   ========================================================= */
export function useEditorActions(sessionId: Ref<string>) {
    const qc = useQueryClient()

    const saving = ref(false)
    const finishing = ref(false)
    const error = ref('')

    /**
     * Save design — composite di-caller (browser canvas), kita cuma kirim
     */
    async function saveDesign(
        templateId: string,
        placements: Record<string, Placement>,
        photostripBlob: Blob
    ) {
        saving.value = true
        error.value = ''

        try {
            const formData = new FormData()
            formData.append('template_id', String(templateId))
            formData.append(
                'placements',
                JSON.stringify(
                    Object.entries(placements).map(([dzId, p]) => ({
                        dropzone_id: dzId,
                        photo_id: p.photoId,
                        transform: {
                            scale: Number(p.transform.scale ?? 1),
                            rotate: Number(p.transform.rotate ?? 0),
                            x: Number(p.transform.x ?? 0),
                            y: Number(p.transform.y ?? 0),
                        },
                    }))
                )
            )
            formData.append('photostrip', photostripBlob, 'photostrip.jpg')

            const res = await photoboothApi.saveDesign(sessionId.value, formData)
            if (!res.success) throw new Error(res.message ?? 'Gagal menyimpan.')

            return res
        } catch (err: any) {
            error.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal menyimpan design.'
            throw err
        } finally {
            saving.value = false
        }
    }

    /**
     * Finish editor — selesai, mau lanjut ke halaman Result
     */
    async function finishEditor() {
        finishing.value = true
        error.value = ''

        try {
            const res = await photoboothApi.finishEditor(sessionId.value)
            qc.invalidateQueries({ queryKey: ['photobooth', 'session'] })
            return res
        } catch (err: any) {
            error.value =
                err?.response?.data?.message ??
                err?.message ??
                'Gagal menyelesaikan editor.'
            throw err
        } finally {
            finishing.value = false
        }
    }

    return {
        saving: computed(() => saving.value),
        finishing: computed(() => finishing.value),
        error: computed(() => error.value),
        saveDesign,
        finishEditor,
    }
}