// src/composables/useSessionGallery.ts
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useActiveEvent } from '@/composables/useEvents'
import { photoboothApi } from '@/lib/api'

export interface SessionPreview {
    id: string
    url: string
    filename: string
    mime_type: string
}

export interface PhotoboothSession {
    id: string
    session_number: string
    booking_id: string | null
    event_id: string
    customer_id: string | null
    session_date: string
    session_type: string
    location: string | null
    start_time: string | null
    end_time: string | null
    total_sessions: number
    total_prints: number
    revenue: string
    journal_entry_id: string | null
    link_gdrive: string | null
    gallery_source: 'local' | 'gdrive' | string
    notes: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    preview: SessionPreview | null
}

export const useSessionGallery = () => {
    const { data: activeEvent } = useActiveEvent()

    const query = useQuery({
        queryKey: computed(() => ['sessions', activeEvent.value?.id]),
        queryFn: () => photoboothApi.getEventSessions(activeEvent.value?.id || ""),
        enabled: computed(() => !!activeEvent.value?.id),
    })

    return query
}