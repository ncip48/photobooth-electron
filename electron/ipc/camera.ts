import type { IpcMain } from 'electron'
import { cameraService } from '../services/CameraService'

export function registerCameraHandlers(ipcMain: IpcMain): void {
    /* =========================================================
       Detect / list cameras
       ========================================================= */
    ipcMain.handle('camera:list', async () => {
        try {
            const cameras = await cameraService.list()
            return {
                success: true,
                cameras: cameras.map((c: any) => ({
                    model: c.model,
                    port: c.port,
                    id: c.port ?? c.model, // unique identifier
                })),
            }
        } catch (err: any) {
            return { success: false, error: err?.message, cameras: [] }
        }
    })

    /* =========================================================
       Connect
       ========================================================= */
    ipcMain.handle('camera:connect', async (_e, payload?: { index?: number }) => {
        try {
            const result = await cameraService.connect(payload?.index ?? 0)
            return { success: true, model: result.model }
        } catch (err: any) {
            return {
                success: false,
                error: err?.message ?? 'Failed to connect camera.',
            }
        }
    })

    /* =========================================================
       Disconnect
       ========================================================= */
    ipcMain.handle('camera:disconnect', async () => {
        try {
            await cameraService.disconnect()
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err?.message }
        }
    })

    /* =========================================================
       Status
       ========================================================= */
    ipcMain.handle('camera:status', () => {
        return { success: true, ...cameraService.getStatus() }
    })

    /* =========================================================
       Config
       ========================================================= */
    ipcMain.handle('camera:get-config', async () => {
        try {
            const config = await cameraService.getConfig()

            return {
                success: true,
                config,
            }
        } catch (err: unknown) {
            console.error('[IPC camera:get-config] Failed:', err)

            const error =
                err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                        ? err
                        : JSON.stringify(err) || 'Unknown camera error'

            return {
                success: false,
                error,
            }
        }
    })

    ipcMain.handle(
        'camera:set-config',
        async (_e, payload: { name: string; value: string | number }) => {
            try {
                await cameraService.setConfigValue(payload.name, payload.value)
                return { success: true }
            } catch (err: any) {
                return { success: false, error: err?.message }
            }
        }
    )

    /* =========================================================
       Preview (live view)
       ========================================================= */
    ipcMain.handle('camera:preview', async () => {
        try {
            const base64 = await cameraService.capturePreview()
            return { success: true, data: base64 }
        } catch (err: any) {
            return { success: false, error: err?.message }
        }
    })

    /* =========================================================
       Capture full image
       ========================================================= */
    // ipcMain.handle('camera:capture', async () => {
    //     try {
    //         const { base64, buffer } = await cameraService.captureImage()
    //         return {
    //             success: true,
    //             data: base64,
    //             size: buffer.length,
    //         }
    //     } catch (err: any) {
    //         return { success: false, error: err?.message }
    //     }
    // })

    ipcMain.handle('camera:capture', async () => {
        try {
            const { base64 } = await cameraService.captureToTempFile()
            return { success: true, data: base64 }
        } catch (err: any) {
            return { success: false, error: err?.message }
        }
    })

    /* =========================================================
       Capture + save to disk (untuk session)
       ========================================================= */
    ipcMain.handle(
        'camera:capture-to-file',
        async (_e, payload: { sessionId: string }) => {
            try {
                const result = await cameraService.captureToFile(
                    payload?.sessionId ?? 'default'
                )
                return { success: true, ...result }
            } catch (err: any) {
                return { success: false, error: err?.message }
            }
        }
    )

    ipcMain.handle('camera:preview-start', (e, payload?: { fps?: number }) => {
        cameraService.startPreviewLoop(e.sender, payload?.fps ?? 15)
        return { success: true }
    })

    ipcMain.handle('camera:preview-stop', () => {
        cameraService.stopPreviewLoop()
        return { success: true }
    })
}