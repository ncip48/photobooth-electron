import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
    mainWindow = new BrowserWindow({
        // width: 1280,
        // height: 800,
        // minWidth: 1024,
        // minHeight: 720,
        show: false,
        kiosk: true,
        autoHideMenuBar: true,
        backgroundColor: '#20201e',
        webPreferences: {
            preload: join(__dirname, '../preload/index.mjs'),   // ← .js (setelah fix)
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false,
        },
    })

    mainWindow.on('ready-to-show', () => mainWindow?.show())

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

function registerBluetoothShutter() {
    const registered = globalShortcut.register('VolumeUp', () => {
        console.log('[Bluetooth Shutter] Volume Up detected')

        if (!mainWindow || mainWindow.isDestroyed()) return

        mainWindow.webContents.send('shutter:pressed')
    })

    console.log(
        '[Bluetooth Shutter] Registration:',
        registered ? 'SUCCESS' : 'FAILED'
    )
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('id.helorabooth.photobooth')
    app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))
    registerIpcHandlers(ipcMain)
    createWindow()
    registerBluetoothShutter()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
    globalShortcut.unregister('VolumeUp')
})