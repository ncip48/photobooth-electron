import { ref, computed, watch } from 'vue'
import { getElectron } from '@/lib/electron'

export interface CameraInfo {
    model: string
    port?: string
    /** Device ID / unique identifier */
    id?: string
}

export function useCamera() {
    const connected = ref(false)
    const connecting = ref(false)
    const detecting = ref(false)
    const connectedModel = ref<string | null>(null)
    const cameras = ref<CameraInfo[]>([])
    const livePreviewUrl = ref<string | null>(null)
    const error = ref('')

    let previewInterval: ReturnType<typeof setInterval> | null = null

    /* =========================================================
       Persistence — selected camera
       ========================================================= */
    const STORAGE_KEY = 'photobooth.selectedCamera'

    function loadSelectedCameraId(): string | null {
        try {
            return localStorage.getItem(STORAGE_KEY)
        } catch {
            return null
        }
    }

    function saveSelectedCameraId(id: string | null) {
        try {
            if (id) localStorage.setItem(STORAGE_KEY, id)
            else localStorage.removeItem(STORAGE_KEY)
        } catch {
            // ignore
        }
    }

    const selectedCameraId = ref<string | null>(loadSelectedCameraId())

    /* =========================================================
       Detect cameras
       ========================================================= */
    async function detect() {
        detecting.value = true
        error.value = ''

        try {
            const electron = getElectron()
            const res = await electron.camera.list()

            console.log(res, "cam")

            if (res.success) {
                cameras.value = (res.cameras ?? []).map((c: any) => ({
                    model: c.model,
                    port: c.port,
                    id: c.id ?? c.port ?? c.model, // fallback ID
                }))
            } else {
                error.value = res.error ?? 'Gagal mendeteksi kamera.'
                cameras.value = []
            }

            return cameras.value
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to detect cameras.'
            cameras.value = []
            return []
        } finally {
            detecting.value = false
        }
    }

    /* =========================================================
       Connect to a specific camera
       ========================================================= */
    async function connect(index = 0) {
        connecting.value = true
        error.value = ''

        try {
            const electron = getElectron()
            const res = await electron.camera.connect(index)

            if (res?.success) {
                connected.value = true
                connectedModel.value = res.model ?? null

                const cam = cameras.value[index]
                if (cam?.id) {
                    selectedCameraId.value = cam.id
                    saveSelectedCameraId(cam.id)
                } else if (res.model) {
                    // fallback: simpan by model kalau index belum ada di cameras
                    selectedCameraId.value = res.model
                    saveSelectedCameraId(res.model)
                }

                return res
            }

            error.value = res?.error ?? 'Gagal terhubung ke kamera.'
            connected.value = false
            connectedModel.value = null
            return null
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to connect camera.'
            connected.value = false
            connectedModel.value = null
            return null
        } finally {
            connecting.value = false
        }
    }


    /* =========================================================
       Connect by camera ID (untuk auto-connect)
       ========================================================= */
    async function connectById(cameraId: string) {
        const idx = cameras.value.findIndex((c) => c.id === cameraId)
        if (idx < 0) {
            error.value = `Camera ${cameraId} tidak ditemukan.`
            return null
        }
        return connect(idx)
    }

    /* =========================================================
       Auto-connect on mount (jika ada camera di localStorage)
       ========================================================= */
    async function autoConnect() {
        const savedId = loadSelectedCameraId()
        if (!savedId) return null

        const list = await detect()
        if (list.length === 0) return null

        return connectById(savedId)
    }

    /* =========================================================
       Disconnect
       ========================================================= */
    async function disconnect() {
        await stopPreview()          // <-- WAJIB await sekarang (sudah async)

        if (refreshPromise) {
            try { await refreshPromise } catch { /* ignore */ }
        }

        try {
            const electron = getElectron()
            const res = await electron.camera.disconnect()
            if (!res.success) {
                throw new Error(res.error ?? 'Gagal memutus koneksi kamera.')
            }
        } finally {
            connected.value = false
            connectedModel.value = null
            livePreviewUrl.value = null
        }
    }

    /* =========================================================
       Preview loop
       ========================================================= */
    function startPreview() {
        if (previewInterval) return
        previewInterval = setInterval(refreshPreview, 500)
    }

    async function stopPreview() {
        if (previewInterval) { clearInterval(previewInterval); previewInterval = null }
        if (refreshPromise) { try { await refreshPromise } catch { } }
        if (livePreviewUrl.value) {
            URL.revokeObjectURL(livePreviewUrl.value)
            livePreviewUrl.value = null
        }
    }

    let refreshing = false
    let refreshPromise: Promise<void> | null = null
    async function refreshPreview() {
        if (refreshing || !connected.value) return

        refreshing = true

        const operation = (async () => {
            const electron = getElectron()
            const res = await electron.camera.preview()

            if (res.success && res.data && connected.value) {
                livePreviewUrl.value = res.data
            }
        })()

        refreshPromise = operation

        try {
            await operation
        } catch {
            // Preview dapat gagal saat kamera sedang berhenti.
        } finally {
            refreshing = false

            if (refreshPromise === operation) {
                refreshPromise = null
            }
        }
    }

    /* =========================================================
       Capture
       ========================================================= */
    async function capture() {
        const electron = getElectron()
        const res = await electron.camera.capture()
        if (!res.success) throw new Error(res.error ?? 'Capture failed.')
        return res
    }

    async function captureToFile(sessionId: string) {
        const electron = getElectron()
        const res = await electron.camera.captureToFile(sessionId)
        if (!res.success) throw new Error(res.error ?? 'Capture failed.')
        return res
    }

    /* =========================================================
       Config
       ========================================================= */
    async function getConfig() {
        const electron = getElectron()
        const res = await electron.camera.getConfig()
        console.log(res, "res config")
        if (!res.success) throw new Error(res.error ?? 'Failed to get config.')
        return res.config
    }

    async function setConfigValue(name: string, value: string | number) {
        const electron = getElectron()
        const res = await electron.camera.setConfig(name, value)
        if (!res.success) throw new Error(res.error ?? 'Failed to set config.')
        return true
    }

    /* =========================================================
       Reset selected camera (forget)
       ========================================================= */
    function forgetSelectedCamera() {
        saveSelectedCameraId(null)
        selectedCameraId.value = null
    }

    return {
        // State
        connected,
        connecting,
        detecting,
        connectedModel,
        cameras,
        livePreviewUrl,
        error,
        selectedCameraId,

        // Actions
        detect,
        connect,
        connectById,
        autoConnect,
        disconnect,
        capture,
        captureToFile,
        getConfig,
        setConfigValue,
        startPreview,
        stopPreview,
        forgetSelectedCamera,
    }
}