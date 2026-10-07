import { ref, onBeforeUnmount } from 'vue'
import { electron } from '@/lib/electron'

interface CameraInfo {
    model: string
    port?: string
}

export function useCamera() {
    const detecting = ref(false)
    const connecting = ref(false)
    const connected = ref(false)
    const connectedModel = ref<string | null>(null)
    const cameras = ref<CameraInfo[]>([])
    const livePreviewUrl = ref<string | null>(null)
    const error = ref('')

    let previewTimer: ReturnType<typeof setInterval> | null = null

    /* =========================================================
       Detect cameras
       ========================================================= */
    async function detect() {
        detecting.value = true
        error.value = ''

        try {
            const res = await electron.camera.list()
            if (res.success) {
                cameras.value = res.cameras ?? []
            } else {
                error.value = res.error ?? 'Gagal mendeteksi kamera.'
                cameras.value = []
            }
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to detect cameras.'
        } finally {
            detecting.value = false
        }
    }

    /* =========================================================
       Connect camera
       ========================================================= */
    async function connect(index = 0) {
        connecting.value = true
        error.value = ''

        try {
            const res = await electron.camera.connect(index)

            if (res.success) {
                connected.value = true
                connectedModel.value = res.model ?? null
                await startPreview()
            } else {
                error.value = res.error ?? 'Gagal terhubung ke kamera.'
                connected.value = false
            }
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to connect camera.'
            connected.value = false
        } finally {
            connecting.value = false
        }
    }

    /* =========================================================
       Disconnect
       ========================================================= */
    async function disconnect() {
        stopPreview()
        try {
            await electron.camera.disconnect()
        } catch {
            // ignore
        }
        connected.value = false
        connectedModel.value = null
        livePreviewUrl.value = null
    }

    /* =========================================================
       Live preview loop
       ========================================================= */
    function startPreview() {
        stopPreview()
        // Initial preview
        refreshPreview()
        // Loop tiap 500ms (~2 FPS)
        previewTimer = setInterval(refreshPreview, 500)
    }

    function stopPreview() {
        if (previewTimer) {
            clearInterval(previewTimer)
            previewTimer = null
        }
    }

    let refreshing = false
    async function refreshPreview() {
        if (refreshing) return // prevent overlap
        refreshing = true

        try {
            const res = await electron.camera.preview()
            if (res.success && res.data) {
                livePreviewUrl.value = res.data
            }
        } catch {
            // silent
        } finally {
            refreshing = false
        }
    }

    /* =========================================================
       Capture
       ========================================================= */
    async function capture() {
        const res = await electron.camera.capture()
        if (!res.success) throw new Error(res.error ?? 'Capture failed.')
        return res
    }

    async function captureToFile(sessionId: string) {
        const res = await electron.camera.captureToFile(sessionId)
        if (!res.success) throw new Error(res.error ?? 'Capture failed.')
        return res
    }

    /* =========================================================
       Config
       ========================================================= */
    async function getConfig() {
        const res = await electron.camera.getConfig()
        if (!res.success) throw new Error(res.error)
        return res.config
    }

    async function setConfigValue(name: string, value: string | number) {
        const res = await electron.camera.setConfig(name, value)
        if (!res.success) throw new Error(res.error)
        return true
    }

    /* =========================================================
       Cleanup
       ========================================================= */
    onBeforeUnmount(() => {
        stopPreview()
    })

    return {
        // State
        detecting,
        connecting,
        connected,
        connectedModel,
        cameras,
        livePreviewUrl,
        error,

        // Actions
        detect,
        connect,
        disconnect,
        capture,
        captureToFile,
        getConfig,
        setConfigValue,
        startPreview,
        stopPreview,
    }
}