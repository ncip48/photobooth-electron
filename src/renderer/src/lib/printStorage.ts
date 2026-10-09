export interface PrintSettings {
    deviceName: string
    marginTop: number      // mm
    marginBottom: number
    marginLeft: number
    marginRight: number
    scaleFactor: number    // 0-100
    pageSize: string       // '4x6' | '5x7' | 'A4' | 'Letter'
    driverOptions: Record<string, string>
}

const STORAGE_KEY = 'photobooth.printSettings'

const DEFAULT_SETTINGS: PrintSettings = {
    deviceName: '',
    marginTop: 2,
    marginBottom: 2,
    marginLeft: 2,
    marginRight: 2,
    scaleFactor: 100,
    pageSize: '4x6',
    driverOptions: {}
}

export function loadPrintSettings(): PrintSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { ...DEFAULT_SETTINGS }

        const parsed = JSON.parse(raw)

        // Migrasi: buang field lama (color, copies, landscape) kalau ada
        return {
            deviceName: parsed.deviceName ?? DEFAULT_SETTINGS.deviceName,
            marginTop: parsed.marginTop ?? DEFAULT_SETTINGS.marginTop,
            marginBottom: parsed.marginBottom ?? DEFAULT_SETTINGS.marginBottom,
            marginLeft: parsed.marginLeft ?? DEFAULT_SETTINGS.marginLeft,
            marginRight: parsed.marginRight ?? DEFAULT_SETTINGS.marginRight,
            scaleFactor: parsed.scaleFactor ?? DEFAULT_SETTINGS.scaleFactor,
            pageSize: parsed.pageSize ?? DEFAULT_SETTINGS.pageSize,
            driverOptions: parsed.driverOptions ?? DEFAULT_SETTINGS.driverOptions,
        }
    } catch {
        return { ...DEFAULT_SETTINGS }
    }
}

export function savePrintSettings(settings: PrintSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
        // ignore
    }
}

export function clearPrintSettings(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch {
        // ignore
    }
}