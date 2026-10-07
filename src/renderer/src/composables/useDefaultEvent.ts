import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

const STORAGE_KEY = 'photobooth.defaultEventId'

export interface PhotoboothEvent {
    id: string
    title: string
    subtitle?: string | null
    code?: string | null
    location?: string | null
    is_active?: boolean
    background_url?: string | null
    [key: string]: any
}

/* =========================================================
   Storage helpers
   ========================================================= */
function readStoredEventId(): string | null {
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

function writeStoredEventId(id: string | null): void {
    try {
        if (id) {
            localStorage.setItem(STORAGE_KEY, id)
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    } catch {
        // ignore quota errors
    }
}

/* =========================================================
   Composable
   ========================================================= */
export function useDefaultEvent(events: Ref<PhotoboothEvent[] | undefined>) {
    /* Stored id (reactive) */
    const storedId = ref<string | null>(readStoredEventId())

    /* Event yang aktif — dihitung dari list + stored id */
    const defaultEvent = computed<PhotoboothEvent | null>(() => {
        const list = events.value ?? []
        if (list.length === 0) return null

        // 1. Coba cari yang di-storage
        if (storedId.value) {
            const found = list.find((e) => e.id === storedId.value)
            if (found) return found
        }

        // 2. Fallback: event pertama
        return list[0]
    })

    /* Auto-persist kalau stored tidak ada atau tidak valid */
    watch(
        [events, storedId],
        ([list, id]) => {
            if (!list || list.length === 0) return

            // Kalau stored id kosong → simpan event pertama
            if (!id) {
                writeStoredEventId(list[0].id)
                storedId.value = list[0].id
                return
            }

            // Kalau stored id tidak valid (event sudah dihapus) → reset ke event pertama
            const stillExists = list.some((e) => e.id === id)
            if (!stillExists) {
                writeStoredEventId(list[0].id)
                storedId.value = list[0].id
            }
        },
        { immediate: true }
    )

    /* Ganti default event */
    function setDefaultEvent(id: string | null): void {
        writeStoredEventId(id)
        storedId.value = id
    }

    /* Clear default (fallback ke event pertama) */
    function clearDefaultEvent(): void {
        writeStoredEventId(null)
        storedId.value = null
    }

    return {
        defaultEvent,
        storedId,
        setDefaultEvent,
        clearDefaultEvent,
    }
}