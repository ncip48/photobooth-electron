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
    total_prints: number
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