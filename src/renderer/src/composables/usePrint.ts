import { ref } from 'vue'
import { getElectron } from '@/lib/electron'
import {
    loadPrintSettings,
    savePrintSettings,
    type PrintSettings,
} from '@/lib/printStorage'

export interface PrinterInfo {
    name: string
    displayName: string
    description?: string
    status: number
    isDefault: boolean
    options?: Record<string, any>
}

export function usePrint() {
    const printers = ref<PrinterInfo[]>([])
    const loading = ref(false)
    const printing = ref(false)
    const error = ref('')

    const settings = ref<PrintSettings>(loadPrintSettings())

    /* =========================================================
       Update + persist
       ========================================================= */
    function updateSettings(patch: Partial<PrintSettings>) {
        settings.value = { ...settings.value, ...patch }
        savePrintSettings(settings.value)
    }

    function replaceSettings(next: PrintSettings) {
        settings.value = next
        savePrintSettings(next)
    }

    /* =========================================================
       Load printers
       ========================================================= */
    async function loadPrinters() {
        loading.value = true
        error.value = ''

        try {
            const electron = getElectron()
            const res = await electron.print.list()

            if (res.success) {
                printers.value = res.printers ?? []

                if (!settings.value.deviceName && printers.value.length > 0) {
                    const defaultPrinter = printers.value.find(
                        (p) => p.isDefault
                    )
                    updateSettings({
                        deviceName:
                            defaultPrinter?.name ?? printers.value[0].name,
                    })
                }
            } else {
                error.value = res.error ?? 'Gagal memuat printer.'
                printers.value = []
            }
        } catch (err: any) {
            error.value = err?.message ?? 'Failed to load printers.'
        } finally {
            loading.value = false
        }
    }

    /* =========================================================
       Print (silent) — hanya pakai field yang kita butuh
       ========================================================= */
    async function print(override?: Partial<PrintSettings>) {
        if (printing.value) return

        const merged = { ...settings.value, ...override }

        printing.value = true
        error.value = ''

        try {
            const electron = getElectron()
            const res = await electron.print.send({
                deviceName: merged.deviceName,
                silent: true,
                marginTop: merged.marginTop,
                marginBottom: merged.marginBottom,
                marginLeft: merged.marginLeft,
                marginRight: merged.marginRight,
                scaleFactor: merged.scaleFactor,
                // pageSize: merged.pageSize,
            })

            if (!res.success) {
                throw new Error(res.error ?? 'Print gagal.')
            }

            return res
        } catch (err: any) {
            error.value = err?.message ?? 'Print failed.'
            throw err
        } finally {
            printing.value = false
        }
    }

    /* =========================================================
       Open native dialog
       ========================================================= */
    async function printWithDialog(override?: Partial<PrintSettings>) {
        const merged = { ...settings.value, ...override }

        try {
            const electron = getElectron()
            const res = await electron.print.openDialog({
                deviceName: merged.deviceName,
                marginTop: merged.marginTop,
                marginBottom: merged.marginBottom,
                marginLeft: merged.marginLeft,
                marginRight: merged.marginRight,
                scaleFactor: merged.scaleFactor,
                // pageSize: merged.pageSize,
            })

            if (!res.success) {
                throw new Error(res.failureReason ?? 'Print dibatalkan.')
            }

            return res
        } catch (err: any) {
            error.value = err?.message ?? 'Print failed.'
            throw err
        }
    }

    /* =========================================================
       Reset
       ========================================================= */
    function resetSettings() {
        replaceSettings({
            deviceName: settings.value.deviceName, // keep printer
            marginTop: 2,
            marginBottom: 2,
            marginLeft: 2,
            marginRight: 2,
            scaleFactor: 100,
            // pageSize: '4x6',
        })
    }

    return {
        printers,
        loading,
        printing,
        error,
        settings,
        loadPrinters,
        print,
        printWithDialog,
        updateSettings,
        replaceSettings,
        resetSettings,
    }
}