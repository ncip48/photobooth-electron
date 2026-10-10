import { contextBridge, ipcRenderer } from 'electron'

const api = {
    // App
    getAppVersion: () => ipcRenderer.invoke('app:version'),
    quit: () => ipcRenderer.invoke('app:quit'),

    // Window
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),

    // Camera
    camera: {
        list: () => ipcRenderer.invoke('camera:list'),
        connect: (index = 0) => ipcRenderer.invoke('camera:connect', { index }),
        disconnect: () => ipcRenderer.invoke('camera:disconnect'),
        status: () => ipcRenderer.invoke('camera:status'),
        getConfig: () => ipcRenderer.invoke('camera:get-config'),
        setConfig: (name: string, value: string | number) =>
            ipcRenderer.invoke('camera:set-config', { name, value }),
        preview: () => ipcRenderer.invoke('camera:preview'),
        capture: () => ipcRenderer.invoke('camera:capture'),
        captureToFile: (sessionId: string) =>
            ipcRenderer.invoke('camera:capture-to-file', { sessionId }),
        previewStart: (fps?: number) => ipcRenderer.invoke('camera:preview-start', { fps }),
        previewStop: () => ipcRenderer.invoke('camera:preview-stop'),
        onPreviewFrame: (cb: (buf: Uint8Array) => void) => {
            const listener = (_: unknown, buf: Uint8Array) => cb(buf)
            ipcRenderer.on('camera:preview-frame', listener)
            return () => ipcRenderer.off('camera:preview-frame', listener)
        },
    },

    // Print
    print: {
        list: () => ipcRenderer.invoke('print:list'),
        send: (options: any) => ipcRenderer.invoke('print:send', options),
        openDialog: (options?: any) =>
            ipcRenderer.invoke('print:open-dialog', options),
        image: (options?: any) => ipcRenderer.invoke('print:image', options),
        getPrinterCapabilities: (printerName: string) =>
            ipcRenderer.invoke('print:capabilities', printerName),

    },

    // Store
    store: {
        get: (key: string) => ipcRenderer.invoke('store:get', key),
        set: (key: string, value: any) =>
            ipcRenderer.invoke('store:set', key, value),
        delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    },
}

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore
    window.electron = api
}

export type ElectronApi = typeof api