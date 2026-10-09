import gphoto2 from 'gphoto2'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { exec } from 'child_process'

/* =========================================================
   Types
   ========================================================= */
interface Camera {
    model: string
    port?: string
    exit?: (cb: (err: Error | null) => void) => void
    getConfig: (cb: (err: Error | null, settings: any) => void) => void
    setConfigValue: (
        key: string,
        value: any,
        cb: (err: Error | null) => void
    ) => void
    takePicture: (
        options: {
            download?: boolean
            keep?: boolean
            preview?: boolean
            targetPath?: string
        },
        cb: (err: Error | null, data?: Buffer | string) => void
    ) => void
    downloadPicture: (
        options: { cameraPath: string; targetPath: string },
        cb: (err: Error | null, tmpname?: string) => void
    ) => void
}

console.log('[CameraService] Module loaded')
console.log('[CameraService] NODE_ENV:', process.env.NODE_ENV)
console.log('[CameraService] isPackaged:', app.isPackaged)

/* =========================================================
   CameraService — singleton
   ========================================================= */
class CameraService {
    private GPhoto: any
    private camera: Camera | null = null
    private connected = false
    private connectedModel: string | null = null
    private connectedIndex = -1

    private previewInFlight: Promise<string> | null = null
    private disconnectInFlight: Promise<void> | null = null
    private connectInFlight: Promise<{ model: string }> | null = null
    private listInFlight: Promise<{ model: string; port?: string }[]> | null = null

    /** Cache objek kamera hidup (bukan cuma model+port). */
    private rawList: Camera[] | null = null
    private rawListAt = 0
    private static CACHE_TTL_MS = 5_000

    constructor() {
        const GPhoto2 = gphoto2.GPhoto2
        this.GPhoto = new GPhoto2()
        this.GPhoto.setLogLevel(process.env.NODE_ENV === 'development' ? 1 : 0)
    }

    /* ----------------------------------------------------------------
       list() — hanya enumerate. Reuse cache kalau masih fresh.
       ---------------------------------------------------------------- */
    async list(): Promise<{ model: string; port?: string }[]> {
        // kalau kamera aktif, langsung kembalikan itu
        if (this.camera && this.connected) {
            return [{ model: this.camera.model, port: this.camera.port }]
        }

        if (this.disconnectInFlight) await this.disconnectInFlight
        if (this.connectInFlight) await this.connectInFlight
        if (this.listInFlight) return this.listInFlight

        // reuse cache kalau masih fresh
        if (this.rawList && Date.now() - this.rawListAt < CameraService.CACHE_TTL_MS) {
            return this.rawList.map((c) => ({ model: c.model, port: c.port }))
        }

        const op = new Promise<{ model: string; port?: string }[]>((resolve) => {
            this.GPhoto.list((list: Camera[]) => {
                this.rawList = list ?? []
                this.rawListAt = Date.now()
                resolve(
                    (list ?? []).map((cam) => ({ model: cam.model, port: cam.port }))
                )
            })
        })

        this.listInFlight = op
        try {
            return await op
        } finally {
            if (this.listInFlight === op) this.listInFlight = null
        }
    }

    /* ----------------------------------------------------------------
       connect() — TIDAK enumerate ulang kalau cache ada.
       ---------------------------------------------------------------- */
    async connect(index = 0): Promise<{ model: string }> {
        if (this.camera && this.connected && this.connectedIndex === index) {
            return { model: this.connectedModel ?? this.camera.model }
        }
        // Kamera lain sedang aktif → harus disconnect dulu di caller.
        if (this.camera && this.connected) {
            throw new Error(
                `Camera index ${index} requested but index ${this.connectedIndex} is still connected. Disconnect first.`
            )
        }

        if (this.disconnectInFlight) await this.disconnectInFlight
        if (this.connectInFlight) return this.connectInFlight

        const op = (async () => {
            // Ambil dari cache kalau ada, baru enumerate
            let list = this.rawList
            if (!list || Date.now() - this.rawListAt >= CameraService.CACHE_TTL_MS) {
                list = await new Promise<Camera[]>((resolve) => {
                    this.GPhoto.list((l: Camera[]) => resolve(l ?? []))
                })
                this.rawList = list
                this.rawListAt = Date.now()
            }

            if (!list || list.length === 0) {
                throw new Error(
                    'No camera found. Pastikan DSLR terhubung via USB dan dalam mode PTP/MTP.'
                )
            }
            const cam = list[index]
            if (!cam) throw new Error(`Camera at index ${index} not found.`)

            this.camera = cam
            this.connected = true
            this.connectedModel = cam.model
            this.connectedIndex = index

            // Beri waktu gphoto2 klaim USB sebelum operasi berikutnya.
            await new Promise((r) => setTimeout(r, 150))

            return { model: cam.model }
        })()

        this.connectInFlight = op
        try {
            return await op
        } finally {
            if (this.connectInFlight === op) this.connectInFlight = null
        }
    }

    /* =========================================================
       Disconnect
       ========================================================= */
    async disconnect(): Promise<void> {
        if (this.disconnectInFlight) return this.disconnectInFlight

        const op = (async () => {
            const camera = this.camera
            if (!camera) {
                this.connected = false
                this.connectedModel = null
                this.connectedIndex = -1
                return
            }

            if (this.previewInFlight) {
                try { await this.previewInFlight } catch { /* ignore */ }
            }

            if (typeof camera.exit === 'function') {
                await new Promise<void>((resolve) => {
                    camera.exit!((err) => {
                        if (err) console.warn('[CameraService] exit warn:', err.message)
                        resolve()
                    })
                })
            }

            if (process.platform === 'darwin') {
                // Lepas juga ke PTPCamera. Snapshot cukup sekali; jangan spam.
                exec('killall PTPCamera', () => { /* ignore */ })
            }

            if (this.camera === camera) {
                this.camera = null
                this.connected = false
                this.connectedModel = null
                this.connectedIndex = -1
                this.rawList = null      // buang cache — device state berubah
                this.rawListAt = 0
            }

            await new Promise((r) => setTimeout(r, 400))
        })()

        this.disconnectInFlight = op
        try {
            await op
        } finally {
            if (this.disconnectInFlight === op) this.disconnectInFlight = null
        }
    }


    /* =========================================================
       Get connection status
       ========================================================= */
    getStatus() {
        return {
            connected: this.connected,
            model: this.connectedModel,
        }
    }

    /* =========================================================
       Get config tree
       ========================================================= */
    // async getConfig(): Promise<any> {
    //     if (!this.camera) throw new Error('Camera not connected.')

    //     return new Promise((resolve, reject) => {
    //         this.camera!.getConfig((err, settings) => {

    //             if (err) reject(err)
    //             else resolve(settings)
    //         })
    //     })
    // }

    async getConfig(): Promise<any> {
        const camera = this.camera

        if (!camera || !this.connected) {
            throw new Error('Camera not connected.')
        }

        return new Promise((resolve, reject) => {
            camera.getConfig((err, settings) => {
                if (err) {
                    console.error('[CameraService] getConfig error:', err)

                    const message =
                        err instanceof Error
                            ? err.message
                            : typeof err === 'string'
                                ? err
                                : JSON.stringify(err) || 'Unknown gphoto2 error'

                    reject(new Error(message))
                    return
                }

                if (settings == null) {
                    reject(
                        new Error(
                            'Camera returned empty configuration.',
                        ),
                    )
                    return
                }

                resolve(settings)
            })
        })
    }

    /* =========================================================
       Set config value (iso, aperture, shutterspeed, dll)
       ========================================================= */
    async setConfigValue(key: string, value: string | number): Promise<void> {
        if (!this.camera) throw new Error('Camera not connected.')

        return new Promise((resolve, reject) => {
            this.camera!.setConfigValue(key, value, (err) => {
                if (err) reject(err)
                else resolve()
            })
        })
    }

    /* =========================================================
       Capture preview (untuk live view) — return base64
       ========================================================= */

    async capturePreview(): Promise<string> {
        if (this.disconnectInFlight) throw new Error('Camera is disconnecting.')
        if (!this.camera || !this.connected) throw new Error('Camera not connected.')

        // Hindari dua operasi preview sekaligus.
        if (this.previewInFlight) {
            return this.previewInFlight
        }

        const camera = this.camera

        const operation = new Promise<string>((resolve, reject) => {
            const targetPath = join(
                app.getPath('temp'),
                `preview-${Date.now()}.XXXXXX`
            )

            camera.takePicture(
                { preview: true, targetPath },
                (err, tmpname) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    if (!tmpname) {
                        reject(new Error('Preview capture returned no path.'))
                        return
                    }

                    fs.readFile(tmpname)
                        .then((buffer) => {
                            const base64 =
                                `data:image/jpeg;base64,${buffer.toString('base64')}`

                            return fs.unlink(tmpname)
                                .catch(() => undefined)
                                .then(() => base64)
                        })
                        .then(resolve)
                        .catch(reject)
                }
            )
        })

        this.previewInFlight = operation

        try {
            return await operation
        } finally {
            if (this.previewInFlight === operation) {
                this.previewInFlight = null
            }
        }
    }

    /* =========================================================
       Capture full image — return { data, buffer }
       ========================================================= */
    async captureImage(): Promise<{ base64: string; buffer: Buffer }> {
        if (!this.camera) throw new Error('Camera not connected.')

        const dir = app.getPath('temp')
        const targetPath = join(dir, `capture-${Date.now()}.XXXXXX`)

        const tmpname = await new Promise<string>((resolve, reject) => {
            this.camera!.takePicture({ targetPath }, (err, name) => {
                if (err) return reject(err)
                if (!name) return reject(new Error('Capture returned no path.'))
                resolve(name)
            })
        })

        const buffer = await fs.readFile(tmpname)
        await fs.unlink(tmpname).catch(() => undefined)

        return {
            buffer,
            base64: `data:image/jpeg;base64,${buffer.toString('base64')}`,
        }
    }


    /* =========================================================
       Capture + save ke disk langsung
       ========================================================= */
    async captureToFile(sessionId: string): Promise<{
        path: string
        filename: string
    }> {
        if (!this.camera) throw new Error('Camera not connected.')

        const dir = join(app.getPath('userData'), 'captures', sessionId)
        await fs.mkdir(dir, { recursive: true })

        const timestamp = new Date()
            .toISOString()
            .replace(/[:.]/g, '-')
        const targetPath = join(dir, `capture-${timestamp}.XXXXXX`)

        return new Promise((resolve, reject) => {
            this.camera!.takePicture(
                { targetPath },
                async (err, tmpname) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    if (!tmpname) {
                        reject(new Error('Capture returned no path.'))
                        return
                    }

                    // tmpname punya suffix random dari gphoto2
                    // rename ke nama final
                    const filename = `capture-${timestamp}.jpg`
                    const finalPath = join(dir, filename)

                    try {
                        await fs.rename(tmpname, finalPath)
                        resolve({ path: finalPath, filename })
                    } catch (renameErr) {
                        reject(renameErr)
                    }
                }
            )
        })
    }

    async captureToTempFile(): Promise<{ base64: string }> {
        if (!this.camera || !this.connected) throw new Error('Camera not connected.')

        const dir = app.getPath('temp')
        const targetPath = join(dir, `capture-${Date.now()}.XXXXXX`)

        const tmpname = await new Promise<string>((resolve, reject) => {
            this.camera!.takePicture({ targetPath }, (err, name) => {
                if (err) return reject(err)
                if (!name) return reject(new Error('Capture returned no path.'))
                resolve(name)
            })
        })

        // Baca di JS layer — Buffer yang dibuat oleh `fs` aman (di sandbox).
        const buffer = await fs.readFile(tmpname)
        await fs.unlink(tmpname).catch(() => undefined)

        return { base64: `data:image/jpeg;base64,${buffer.toString('base64')}` }
    }
}

/* Export singleton */
export const cameraService = new CameraService()