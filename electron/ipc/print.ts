import type { IpcMain } from 'electron'
import { BrowserWindow } from 'electron'

interface PrintOptions {
    deviceName: string
    silent?: boolean
    marginTop?: number      // mm
    marginBottom?: number   // mm
    marginLeft?: number     // mm
    marginRight?: number    // mm
    scaleFactor?: number    // 0-100
    landscape?: boolean
    copies?: number
    pageSize?: string | { width: number; height: number }
    color?: boolean
    dpi?: number
}

/* Convert mm → inch (Electron pakai inch untuk margin) */
const mmToInch = (mm: number): number => mm / 25.4

export function registerPrintHandlers(ipcMain: IpcMain): void {
    /* =========================================================
       List printers
       ========================================================= */
    ipcMain.handle('print:list', async (event) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender)
            if (!win) return { success: false, printers: [] }

            const printers = await win.webContents.getPrintersAsync()

            return {
                success: true,
                printers: printers.map((p) => ({
                    name: p.name,
                    displayName: p.displayName,
                    description: p.description,
                    status: p.status,
                    isDefault: p.isDefault,
                    options: p.options ?? {},
                })),
            }
        } catch (err: any) {
            return {
                success: false,
                error: err?.message ?? 'Failed to list printers.',
                printers: [],
            }
        }
    })

    /* =========================================================
       Print (silent)
       ========================================================= */
    ipcMain.handle('print:send', async (event, options: PrintOptions) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender)
            if (!win) return { success: false, error: 'No window.' }

            const printOptions: any = {
                silent: options.silent ?? true,
                deviceName: options.deviceName,
                color: options.color ?? true,
                landscape: options.landscape ?? false,
                copies: Math.max(1, options.copies ?? 1),
                scaleFactor: Math.min(
                    100,
                    Math.max(1, options.scaleFactor ?? 100)
                ),
            }

            // Margins (custom kalau ada nilai)
            if (
                options.marginTop !== undefined ||
                options.marginBottom !== undefined ||
                options.marginLeft !== undefined ||
                options.marginRight !== undefined
            ) {
                printOptions.margins = {
                    marginType: 'custom',
                    top: mmToInch(options.marginTop ?? 0),
                    bottom: mmToInch(options.marginBottom ?? 0),
                    left: mmToInch(options.marginLeft ?? 0),
                    right: mmToInch(options.marginRight ?? 0),
                }
            } else {
                printOptions.margins = { marginType: 'default' }
            }

            // Page size
            if (options.pageSize) {
                printOptions.pageSize = options.pageSize
            }

            // DPI
            if (options.dpi) {
                printOptions.dpi = {
                    horizontal: options.dpi,
                    vertical: options.dpi,
                }
            }

            return await new Promise((resolve) => {
                win.webContents.print(
                    printOptions,
                    (success, failureReason) => {
                        if (success) {
                            resolve({ success: true })
                        } else {
                            resolve({
                                success: false,
                                error: failureReason || 'Print failed.',
                            })
                        }
                    }
                )
            })
        } catch (err: any) {
            return {
                success: false,
                error: err?.message ?? 'Print failed.',
            }
        }
    })

    ipcMain.handle('print:image', async (_event, options: {
        imageDataUrl: string
        printerName?: string
        copies?: number
        marginTop?: number
        marginBottom?: number
        marginLeft?: number
        marginRight?: number
        scaleFactor?: number
    }) => {
        const {
            imageDataUrl,
            printerName,
            copies = 1,
            marginTop = 0,
            marginBottom = 0,
            marginLeft = 0,
            marginRight = 0,
            scaleFactor = 100,
        } = options

        // Window tersembunyi
        const win = new BrowserWindow({
            show: false,
            width: 800,
            height: 1200,
            webPreferences: { offscreen: true },
        })

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                html, body {
                    width: 100%;
                    height: 100%;
                    background: white;
                }
                body {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                img {
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                }
                @page { margin: 0; }
            </style>
        </head>
        <body>
            <img src="${imageDataUrl}" alt="print" />
        </body>
        </html>
    `

        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

        // Tunggu gambar selesai dimuat
        await new Promise<void>((resolve) => {
            win.webContents.executeJavaScript(`
            new Promise((r) => {
                const img = document.querySelector('img')
                if (!img) return r()
                if (img.complete) return r()
                img.onload = () => r()
                img.onerror = () => r()
            })
        `).then(() => resolve())
        })

        // Sedikit delay untuk memastikan render selesai
        await new Promise((r) => setTimeout(r, 300))

        return new Promise<{ success: boolean; error?: string }>((resolve) => {
            win.webContents.print(
                {
                    silent: !!printerName,
                    deviceName: printerName,
                    copies,
                    color: true,
                    margins: {
                        marginType: 'custom',
                        top: marginTop,
                        bottom: marginBottom,
                        left: marginLeft,
                        right: marginRight,
                    },
                    scaleFactor,
                    printBackground: true,
                },
                (success, failureReason) => {
                    // Tutup window setelah print selesai
                    setTimeout(() => {
                        if (!win.isDestroyed()) win.close()
                    }, 1000)

                    if (success) {
                        resolve({ success: true })
                    } else {
                        resolve({ success: false, error: failureReason })
                    }
                }
            )
        })
    })

    /* =========================================================
       Open native print dialog (non-silent)
       ========================================================= */
    ipcMain.handle(
        'print:open-dialog',
        async (event, options?: Partial<PrintOptions>) => {
            try {
                const win = BrowserWindow.fromWebContents(event.sender)
                if (!win) return { success: false }

                const printOptions: any = {
                    silent: false,
                    deviceName: options?.deviceName,
                    color: options?.color ?? true,
                }

                if (options?.marginTop !== undefined) {
                    printOptions.margins = {
                        marginType: 'custom',
                        top: mmToInch(options.marginTop ?? 0),
                        bottom: mmToInch(options.marginBottom ?? 0),
                        left: mmToInch(options.marginLeft ?? 0),
                        right: mmToInch(options.marginRight ?? 0),
                    }
                }

                if (options?.scaleFactor) {
                    printOptions.scaleFactor = options.scaleFactor
                }

                if (options?.pageSize) {
                    printOptions.pageSize = options.pageSize
                }

                return await new Promise((resolve) => {
                    win.webContents.print(
                        printOptions,
                        (success, failureReason) => {
                            resolve({ success, failureReason })
                        }
                    )
                })
            } catch (err: any) {
                return { success: false, error: err?.message }
            }
        }
    )
}