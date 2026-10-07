import axios from 'axios'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
    timeout: 30000,
    headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    },
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('photobooth.token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('photobooth.token')
        }
        return Promise.reject(err)
    }
)

/* =========================================================
   Photobooth endpoints
   ========================================================= */
export const photoboothApi = {
    /* ============ Events ============ */
    async getEvents() {
        const { data } = await api.get('/photobooth/events')
        return data
    },

    async getEvent(id: string) {
        const { data } = await api.get(`/photobooth/events/${id}`)
        return data
    },

    async selectEvent(id: string) {
        const { data } = await api.post(`/photobooth/events/${id}/select`)
        return data
    },

    /* ============ Settings ============ */
    async getCameraSettings() {
        const { data } = await api.get('/photobooth/settings/camera')
        return data
    },

    async saveCameraSettings(payload: Record<string, any>) {
        const { data } = await api.put('/photobooth/settings/camera', payload)
        return data
    },

    async saveGeneralSettings(formData: FormData) {
        const { data } = await api.post('/photobooth/settings/general', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
    },

    /* ============ Session / Payment ============ */
    async startSession(eventId: string) {
        const { data } = await api.post('/photobooth/start/session', {
            event_id: eventId,
        })
        return data
    },

    async getSession(sessionId: string) {
        const { data } = await api.get(`/photobooth/sessions/${sessionId}`)
        return data
    },

    async confirmQris(draftId: string) {
        const { data } = await api.post('/photobooth/payment/qris/confirm', {
            draft_id: draftId,
        })
        return data
    },

    async redeemVoucher(draftId: string, code: string) {
        const { data } = await api.post('/photobooth/payment/voucher', {
            draft_id: draftId,
            code,
        })
        return data
    },

    async cancelPayment(draftId: string) {
        const { data } = await api.post('/photobooth/payment/cancel', {
            draft_id: draftId,
        })
        return data
    },

    /* ============ Capture ============ */

    async listCaptures(sessionId: string) {
        const { data } = await api.get(
            `/photobooth/capture/${sessionId}/list`
        )
        return data
    },

    async uploadCapture(sessionId: string, image: string, mimeType = 'image/jpeg') {
        const { data } = await api.post(`/photobooth/capture/${sessionId}/upload`, {
            image,
            mime_type: mimeType,
        })
        return data
    },

    async deleteCapture(sessionId: string, galleryId: string) {
        const { data } = await api.delete(
            `/photobooth/capture/${sessionId}/photo/${galleryId}`
        )
        return data
    },

    async finishCapture(sessionId: string) {
        const { data } = await api.post(`/photobooth/capture/${sessionId}/finish`)
        return data
    },

    async getTemplate(sessionId: string, templateId: string) {
        const { data } = await api.get(`/photobooth/capture/${sessionId}/template/${templateId}`)
        return data
    },

    /* ============ Result ============ */
    async getResult(sessionId: string) {
        const { data } = await api.get(`/photobooth/result/${sessionId}`)
        return data
    },

    async sendResultEmail(sessionId: string, email: string) {
        const { data } = await api.post(`/photobooth/result/${sessionId}/email`, {
            email,
        })
        return data
    },

    async finishResult(sessionId: string) {
        const { data } = await api.post(`/photobooth/result/${sessionId}/finish`)
        return data
    },

    /* ============ Editor ============ */
    async getSessionPhotos(sessionId: string) {
        const { data } = await api.get(`/photobooth/editor/${sessionId}/photos`)
        return data
    },

    async getTemplates(sessionId: string) {
        const { data } = await api.get(`/photobooth/editor/${sessionId}/templates`)
        return data
    },

    async saveDesign(sessionId: string, formData: FormData) {
        const { data } = await api.post(
            `/photobooth/editor/${sessionId}/save`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        return data
    },

    async finishEditor(sessionId: string) {
        const { data } = await api.post(`/photobooth/editor/${sessionId}/finish`)
        return data
    },
}