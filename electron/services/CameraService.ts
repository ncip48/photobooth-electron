import gphoto2 from 'gphoto2'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/* =========================================================
   Types
   ========================================================= */
interface Camera {
    model: string
    port?: string
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

/* =========================================================
   CameraService — singleton
   ========================================================= */
class CameraService {
    private GPhoto: any
    private camera: Camera | null = null
    private connected = false
    private connectedModel: string | null = null

    /* Logging */
    private logLevel = 0 // 0-4 (higher = more verbose)

    constructor() {
        const gphoto2Module = (gphoto2 as any).default ?? gphoto2
        this.GPhoto = new gphoto2Module.GPhoto2()

        // Enable logging kalau dev
        if (process.env.NODE_ENV === 'development') {
            this.logLevel = 1
            this.GPhoto.setLogLevel(1)
            this.GPhoto.on('log', (level: number, domain: string, msg: string) => {
                console.log(`[gphoto2:${level}] ${domain}:`, msg)
            })
        } else {
            this.GPhoto.setLogLevel(0)
        }
    }

    /* =========================================================
       List cameras yang terhubung
       ========================================================= */
    async list(): Promise<{ model: string; port?: string }[]> {
        return new Promise((resolve, reject) => {
            this.GPhoto.list((list: Camera[]) => {
                if (!list || list.length === 0) {
                    resolve([])
                    return
                }

                resolve(
                    list.map((cam) => ({
                        model: cam.model,
                        port: cam.port,
                    }))
                )
            })
        })
    }

    /* =========================================================
       Connect ke camera pertama (atau by index)
       ========================================================= */
    async connect(index = 0): Promise<{ model: string }> {
        return new Promise((resolve, reject) => {
            this.GPhoto.list((list: Camera[]) => {
                if (!list || list.length === 0) {
                    reject(new Error('No camera found. Pastikan DSLR terhubung via USB dan dalam mode PTP/MTP.'))
                    return
                }

                const cam = list[index]
                if (!cam) {
                    reject(new Error(`Camera at index ${index} not found.`))
                    return
                }

                this.camera = cam
                this.connected = true
                this.connectedModel = cam.model

                resolve({ model: cam.model })
            })
        })
    }

    /* =========================================================
       Disconnect
       ========================================================= */
    async disconnect(): Promise<void> {
        this.camera = null
        this.connected = false
        this.connectedModel = null
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
    async getConfig(): Promise<any> {
        if (!this.camera) throw new Error('Camera not connected.')

        return new Promise((resolve, reject) => {
            this.camera!.getConfig((err, settings) => {
                if (err) reject(err)
                else resolve(settings)
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
        if (!this.camera) throw new Error('Camera not connected.')

        return new Promise((resolve, reject) => {
            const targetPath = join(
                app.getPath('temp'),
                `preview-${Date.now()}.XXXXXX`
            )

            this.camera!.takePicture(
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
                            const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`
                            fs.unlink(tmpname).catch(() => { })
                            resolve(base64)
                        })
                        .catch(reject)
                }
            )
        })
    }

    /* =========================================================
       Capture full image — return { data, buffer }
       ========================================================= */
    async captureImage(): Promise<{
        base64: string
        buffer: Buffer
    }> {
        if (!this.camera) throw new Error('Camera not connected.')

        return new Promise((resolve, reject) => {
            this.camera!.takePicture(
                { download: true, keep: false },
                (err, data) => {
                    if (err) {
                        reject(err)
                        return
                    }

                    const buffer = Buffer.isBuffer(data)
                        ? data
                        : Buffer.from(data as string, 'binary')

                    resolve({
                        buffer,
                        base64: `data:image/jpeg;base64,${buffer.toString('base64')}`,
                    })
                }
            )
        })
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
}

/* Export singleton */
export const cameraService = new CameraService()