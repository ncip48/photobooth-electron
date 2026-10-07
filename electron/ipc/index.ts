import type { IpcMain } from 'electron'
import { registerCameraHandlers } from './camera'
import { registerPrintHandlers } from './print'
import { registerStorageHandlers } from './storage'
import { app, BrowserWindow } from 'electron'

export function registerIpcHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('app:version', () => app.getVersion())

    ipcMain.handle('app:quit', () => app.quit())

    ipcMain.handle('window:toggle-fullscreen', () => {
        const win = BrowserWindow.getFocusedWindow()
        if (!win) return false
        const next = !win.isFullScreen()
        win.setFullScreen(next)
        return next
    })

    registerCameraHandlers(ipcMain)
    registerPrintHandlers(ipcMain)
    registerStorageHandlers(ipcMain)
}