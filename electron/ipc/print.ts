import type { IpcMain } from 'electron'
import { BrowserWindow } from 'electron'
import { getPrinterCapabilities } from './printer-capabilities'

import { execFile } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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

type ElectronPageSize = string | {
    width: number
    height: number
}

async function resolvePageSize(
    printerName: string | undefined,
    pageSize: ElectronPageSize,
): Promise<ElectronPageSize> {
    // Ukuran custom yang sudah berupa micron tidak perlu dikonversi.
    if (typeof pageSize !== 'string') {
        if (
            pageSize.width <= 0 ||
            pageSize.height <= 0
        ) {
            throw new Error('Invalid custom page size.')
        }

        return pageSize
    }

    if (!printerName) {
        throw new Error(
            `Cannot resolve pageSize "${pageSize}" without a printer name.`,
        )
    }

    const result = await getPrinterCapabilities(printerName)

    const paper = result.papers.find(
        (item) => item.id === pageSize,
    )

    if (!paper) {
        throw new Error(
            `Unsupported pageSize: ${pageSize}. ` +
            `The selected printer does not expose this media ID.`,
        )
    }

    if (
        paper.widthMicrons == null ||
        paper.heightMicrons == null ||
        paper.widthMicrons <= 0 ||
        paper.heightMicrons <= 0
    ) {
        throw new Error(
            `Media "${pageSize}" has no valid dimensions in the printer driver.`,
        )
    }

    return {
        width: paper.widthMicrons,
        height: paper.heightMicrons,
    }
}

interface CupsPrintOptions {
    imageDataUrl: string
    printerName: string
    copies?: number
    pageSize: string
    driverOptions?: Record<string, string>
    scaleFactor?: number
}

async function printImageWithCups(options: CupsPrintOptions) {
    const {
        imageDataUrl,
        printerName,
        copies = 1,
        pageSize,
        driverOptions = {},
        scaleFactor = 100
    } = options

    console.log(scaleFactor)

    if (process.platform !== 'darwin') {
        throw new Error('CUPS printing helper ini khusus macOS.')
    }

    if (!imageDataUrl.startsWith('data:image/')) {
        throw new Error('Format gambar harus berupa data URL gambar.')
    }

    const match = imageDataUrl.match(
        /^data:image\/(jpeg|jpg|png);base64,([\s\S]+)$/i,
    )

    if (!match) {
        throw new Error('Data URL harus berupa JPEG atau PNG base64.')
    }

    const extension = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
    const imageBuffer = Buffer.from(match[2], 'base64')
    const directory = await mkdtemp(join(tmpdir(), 'photobooth-'))
    const imagePath = join(directory, `print.${extension}`)

    try {
        await writeFile(imagePath, imageBuffer)

        const args = [
            '-d', printerName,
            '-n', String(Math.max(1, Math.floor(copies))),
        ]

        // Terapkan ukuran kertas menggunakan ID media CUPS.
        // pageSize harus merupakan nama media CUPS yang valid.
        if (!pageSize || !/^[a-zA-Z0-9_.-]+$/.test(pageSize)) {
            throw new Error('Ukuran kertas tidak valid.')
        }

        args.push('-o', `media=${pageSize}`)

        // Opsi driver Epson yang dipilih dari modal.
        for (const [key, value] of Object.entries(driverOptions)) {
            if (
                ['EPIJ_Medi', 'EPIJ_Qual', 'EPIJ_Bdls'].includes(key) &&
                /^[a-zA-Z0-9_.-]+$/.test(value)
            ) {
                args.push('-o', `${key}=${value}`)
            }
        }

        // args.push('-o', `scaling=${scaleFactor}`)
        // const scale = Math.min(800, Math.max(1, Number(scaleFactor) || 100))
        // args.push('-o', `natural-scaling=${scale}`)

        args.push(imagePath)

        console.log('[CUPS] Command:', 'lp', args)

        const { stdout, stderr } = await execFileAsync('lp', args)

        return {
            success: true,
            message: stdout.trim(),
            warning: stderr.trim() || undefined,
        }
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
}

export function registerPrintHandlers(ipcMain: IpcMain): void {
    /* =========================================================
       List printers
       ========================================================= */
    ipcMain.handle('print:list', async (event) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender)
            if (!win) return { success: false, printers: [] }

            const printers = await win.webContents.getPrintersAsync()

            console.log(printers, "FROM IPC")

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

    ipcMain.handle('print:image', async (_event, options) => {
        try {
            if (process.platform === 'darwin') {
                if (!options.printerName) {
                    throw new Error('Printer belum dipilih.')
                }

                return await printImageWithCups({
                    imageDataUrl: options.imageDataUrl,
                    printerName: options.printerName,
                    copies: options.copies ?? 1,
                    driverOptions: options.driverOptions ?? {},
                    pageSize: options.pageSize,
                    scaleFactor: options.scaleFactor
                })
            }

            // Jalur Windows/Linux yang sudah kamu gunakan
            // tetap dipertahankan di sini.
            return {
                success: false,
                error: 'Jalur cetak untuk platform ini belum diimplementasikan.',
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Print gagal.',
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


    ipcMain.handle(
        'print:capabilities',
        async (_event, printerName: string) => {
            try {
                const capabilities =
                    await getPrinterCapabilities(printerName)

                return {
                    success: true,
                    capabilities,
                }
            } catch (error: unknown) {
                return {
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Failed to read printer capabilities.',
                    capabilities: null,
                }
            }
        },
    )

}