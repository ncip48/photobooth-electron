import { computed, type Ref } from 'vue'
import {
    useQuery,
    useMutation,
    useQueryClient,
} from '@tanstack/vue-query'
import { photoboothApi } from '@/lib/api'

export interface CaptureItem {
    id: string
    filename: string
    url: string
    uploading?: boolean
    failed?: boolean
    error?: string
    created_at?: string
}

/* =========================================================
   Query keys
   ========================================================= */
const queryKey = (sessionId: Ref<string> | string) => {
    const id = typeof sessionId === 'string' ? sessionId : sessionId.value
    return ['photobooth', 'captures', id]
}

/* =========================================================
   Fetch captures
   ========================================================= */
export function useCaptures(sessionId: Ref<string> | string) {
    const queryClient = useQueryClient()
    const key = queryKey(sessionId)

    /* ---------- Query: fetch dari API ---------- */
    const query = useQuery({
        queryKey: key,
        queryFn: async () => {
            const id =
                typeof sessionId === 'string' ? sessionId : sessionId.value
            const res = await photoboothApi.listCaptures(id)
            if (!res.success) throw new Error('Gagal memuat captures.')
            return res.captures as CaptureItem[]
        },
        staleTime: 1000 * 60, // 1 menit — cache fresh
        refetchOnWindowFocus: false,
    })

    /* ---------- Helper: update cache ---------- */
    function updateCache(updater: (items: CaptureItem[]) => CaptureItem[]) {
        queryClient.setQueryData<CaptureItem[]>(key, (old = []) =>
            updater(old)
        )
    }

    /* ---------- Mutation: upload ---------- */
    async function uploadCapture(
        base64: string,
        mimeType = 'image/jpeg',
        tempId?: string
    ) {
        const id =
            typeof sessionId === 'string' ? sessionId : sessionId.value
        const actualTempId = tempId ?? `temp-${Date.now()}`

        /* 1. Optimistic: langsung tambahkan ke cache */
        const tempPhoto: CaptureItem = {
            id: actualTempId,
            filename: `capture-${Date.now()}.jpg`,
            url: base64,
            uploading: true,
            failed: false,
            created_at: new Date().toISOString(),
        }

        updateCache((items) => [...items, tempPhoto])

        /* 2. Upload ke backend di background */
        try {
            const res = await photoboothApi.uploadCapture(
                id,
                base64,
                mimeType
            )

            if (!res.success) {
                throw new Error(res.error ?? 'Upload gagal.')
            }

            /* 3. Replace temp dengan data server */
            updateCache((items) =>
                items.map((item) =>
                    item.id === actualTempId
                        ? {
                            id: res.capture.id,
                            filename: res.capture.filename,
                            url: res.capture.url,
                            uploading: false,
                            failed: false,
                            created_at:
                                res.capture.created_at ??
                                new Date().toISOString(),
                        }
                        : item
                )
            )

            return res.capture
        } catch (err: any) {
            /* 4. Mark as failed */
            updateCache((items) =>
                items.map((item) =>
                    item.id === actualTempId
                        ? {
                            ...item,
                            uploading: false,
                            failed: true,
                            error: err?.message ?? 'Upload gagal.',
                        }
                        : item
                )
            )
            throw err
        }
    }

    /* ---------- Mutation: delete ---------- */
    const deleteMutation = useMutation({
        mutationFn: async (galleryId: string) => {
            const id =
                typeof sessionId === 'string' ? sessionId : sessionId.value
            const res = await photoboothApi.deleteCapture(id, galleryId)
            if (!res.success) throw new Error('Gagal menghapus.')
            return galleryId
        },
        onSuccess: (galleryId) => {
            // Remove dari cache
            updateCache((items) =>
                items.filter((item) => item.id !== galleryId)
            )
        },
    })

    const deleteCapture = (galleryId: string) => {
        return deleteMutation.mutateAsync(galleryId)
    }

    /* ---------- Mutation: finish ---------- */
    const finishMutation = useMutation({
        mutationFn: async () => {
            const id =
                typeof sessionId === 'string' ? sessionId : sessionId.value
            const res = await photoboothApi.finishCapture(id)
            return res
        },
    })

    const finishCapture = () => finishMutation.mutateAsync()

    /* ---------- Computed ---------- */
    const captures = computed(() => query.data.value ?? [])
    const totalCaptures = computed(() => captures.value.length)
    const hasPendingUploads = computed(() =>
        captures.value.some((c) => c.uploading)
    )

    return {
        // State
        captures,
        totalCaptures,
        hasPendingUploads,
        isLoading: computed(() => query.isLoading.value),
        isError: computed(() => query.isError.value),
        error: computed(() => query.error.value),

        // Actions
        uploadCapture,
        deleteCapture,
        finishCapture,

        // Deleting state
        deletingId: computed(() => deleteMutation.variables.value ?? null),
        isDeleting: computed(() => deleteMutation.isPending.value),

        // Finish state
        isFinishing: computed(() => finishMutation.isPending.value),

        // Refetch manual
        refetch: query.refetch,
    }
}