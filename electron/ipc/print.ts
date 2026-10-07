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