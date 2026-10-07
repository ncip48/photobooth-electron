import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { photoboothApi } from '@/lib/api'
import { computed } from 'vue'
import { useDefaultEvent } from './useDefaultEvent'

/* =========================================================
   All events
   ========================================================= */
export function useEvents() {
    return useQuery({
        queryKey: ['photobooth', 'events'],
        queryFn: () => photoboothApi.getEvents(),
        staleTime: 1000 * 60, // 1 minute
    })
}

/* =========================================================
   Default event (dari list + localStorage)
   ========================================================= */
export function useActiveEvent() {
    const { data: events } = useEvents()
    const { defaultEvent, setDefaultEvent, clearDefaultEvent } =
        useDefaultEvent(events)

    return {
        // Compatible dengan API lama — `data` untuk menggantikan useActiveEvent().data
        data: defaultEvent,
        isLoading: events === undefined,
        isError: false,
        setDefaultEvent,
        clearDefaultEvent,
    }
}

/* =========================================================
   Start session mutation
   ========================================================= */
export function useStartSession() {
    const qc = useQueryClient()

    return useMutation({
        mutationFn: (eventId: string) => photoboothApi.startSession(eventId),
        onSuccess: (data) => {
            // Simpan draft_id supaya bisa dipakai di halaman payment
            if (data?.draft_id) {
                sessionStorage.setItem('photobooth.draft_id', data.draft_id)
            }
            qc.invalidateQueries({ queryKey: ['photobooth', 'session'] })
        },
    })
}

/* =========================================================
   Select event mutation
   ========================================================= */
export function useSelectEvent() {
    const qc = useQueryClient()

    return useMutation({
        mutationFn: (eventId: string) => photoboothApi.selectEvent(eventId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['photobooth', 'active-event'] })
            qc.invalidateQueries({ queryKey: ['photobooth', 'events'] })
        },
    })
}

/* =========================================================
   Computed: available event count
   ========================================================= */
export function useAvailableEventCount() {
    const { data } = useEvents()
    return computed(() => data.value?.length ?? 0)
}