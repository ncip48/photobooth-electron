import type { IpcMain } from 'electron'
import { BrowserWindow } from 'electron'

export function registerPrintHandlers(ipcMain: IpcMain): void {
    ipcMain.handle('print:list', async (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return []
        return await win.webContents.getPrintersAsync()
    })

    ipcMain.handle('print:send', async (event, payload) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return { success: false }
        // Simple print — payload can be { silent, deviceName, ... }
        win.webContents.print(payload ?? {}, (success, errorType) => {
            console.log('[print]', success, errorType)
        })
        return { success: true }
    })
}