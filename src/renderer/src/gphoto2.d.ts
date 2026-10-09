declare module 'gphoto2' {
    import { EventEmitter } from 'node:events'

    export class GPhoto2 extends EventEmitter {
        constructor()

        setLogLevel(level: number): void

        list(callback: (cameras: Camera[]) => void): void
    }

    export interface Camera {
        model: string
        port?: string

        getConfig(
            callback: (err: Error | null, settings: any) => void,
        ): void

        setConfigValue(
            key: string,
            value: any,
            callback: (err: Error | null) => void,
        ): void

        takePicture(
            options: {
                download?: boolean
                keep?: boolean
                preview?: boolean
                targetPath?: string
            },
            callback: (err: Error | null, data?: Buffer | string) => void,
        ): void

        downloadPicture(
            options: { cameraPath: string; targetPath: string },
            callback: (err: Error | null, tmpname?: string) => void,
        ): void
    }

    const gphoto2: {
        GPhoto2: typeof GPhoto2
    }

    export default gphoto2
}