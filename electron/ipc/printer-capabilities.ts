import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { promisify } from 'node:util'
import process from 'node:process'

const execFileAsync = promisify(execFile)

const PPD_RESOURCE_DIR =
    '/Library/Printers/PPDs/Contents/Resources'

export interface PaperSize {
    /** Media key yang berasal dari driver printer. */
    id: string
    /** Nama media dari driver, bukan nama buatan aplikasi. */
    name: string
    /** Lebar media dalam micron (1 micron = 0.001 mm). */
    widthMicrons: number | null
    /** Tinggi media dalam micron. */
    heightMicrons: number | null
    source: 'driver'
}

interface PpdPaper {
    id: string
    name: string
    widthMicrons: number
    heightMicrons: number
}

interface PpdCandidate {
    path: string
    description: string
}

export interface DriverOptionChoice {
    value: string
    label: string
}

export interface DriverOption {
    id: string
    label: string
    choices: DriverOptionChoice[]
    defaultValue?: string
}

export interface PrinterCapabilities {
    printerName: string
    platform: NodeJS.Platform
    source: 'windows-driver' | 'cups-driver'
    papers: PaperSize[]
    options?: DriverOption[]
    warning?: string
}

/**
 * Hilangkan duplikat berdasarkan ID media dari driver.
 * Media borderless tetap berbeda karena memiliki ID tersendiri.
 */
function uniquePapers(papers: PaperSize[]): PaperSize[] {
    const seen = new Set<string>()

    return papers.filter((paper) => {
        if (seen.has(paper.id)) return false

        seen.add(paper.id)
        return true
    })
}

function normalizeName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
}

/**
 * PPD menyimpan dimensi dalam PostScript points.
 * 1 point = 1/72 inch.
 * 1 inch = 25,400 microns.
 */
function pointsToMicrons(points: number): number {
    return Math.round((points * 25400) / 72)
}

/**
 * Decode escape heksadesimal PPD, misalnya:
 *   16<3A>9 wide -> 16:9 wide
 *   3<2E>5 x 5 in -> 3.5 x 5 in
 */
function decodePpdText(value: string): string {
    return value.replace(/<([0-9a-f]{2})>/gi, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
    )
}

/**
 * Parse pasangan PageSize dan PaperDimension dari PPD.
 *
 * Ukuran hanya diambil jika kedua deklarasi tersedia.
 * Tidak ada fallback ke ukuran standar atau tebakan berdasarkan nama.
 */
function parsePpd(ppdContent: string): PpdPaper[] {
    const pageSizes = new Map<string, string>()
    const dimensions = new Map<string, { width: number; height: number }>()

    for (const line of ppdContent.split(/\r?\n/)) {
        const pageMatch = line.match(
            /^\*PageSize\s+([^/\s:]+)(?:\/([^:]+))?:/,
        )

        if (pageMatch) {
            const id = pageMatch[1]
            const label = pageMatch[2]?.trim()

            pageSizes.set(
                id,
                label ? decodePpdText(label) : id,
            )

            continue
        }

        const dimensionMatch = line.match(
            /^\*PaperDimension\s+([^/\s:]+)(?:\/([^:]+))?:\s*"([\d.]+)\s+([\d.]+)"/,
        )

        if (dimensionMatch) {
            const id = dimensionMatch[1]
            const width = Number(dimensionMatch[3])
            const height = Number(dimensionMatch[4])

            if (
                Number.isFinite(width) &&
                Number.isFinite(height) &&
                width > 0 &&
                height > 0
            ) {
                dimensions.set(id, { width, height })
            }
        }
    }

    const papers: PpdPaper[] = []

    for (const [id, label] of pageSizes) {
        const dimension = dimensions.get(id)

        // Tanpa dimensi aktual dari PPD, ukuran tidak ditebak.
        if (!dimension) continue

        papers.push({
            id,
            name: label,
            widthMicrons: pointsToMicrons(dimension.width),
            heightMicrons: pointsToMicrons(dimension.height),
        })
    }

    return papers
}

async function readPpdFile(filePath: string): Promise<string> {
    const buffer = await readFile(filePath)

    // File PPD macOS biasanya dikompresi sebagai .gz.
    if (filePath.toLowerCase().endsWith('.gz')) {
        return gunzipSync(buffer).toString('utf8')
    }

    // Sebagian file mungkin berekstensi .ppd tetapi tetap gzip.
    if (
        buffer.length >= 2 &&
        buffer[0] === 0x1f &&
        buffer[1] === 0x8b
    ) {
        return gunzipSync(buffer).toString('utf8')
    }

    return buffer.toString('utf8')
}

/**
 * Cari file PPD untuk printer yang terpasang.
 *
 * Prioritas:
 * 1. PPD yang disimpan untuk queue CUPS.
 * 2. Model driver yang ditemukan melalui lpinfo -m.
 * 3. File model dengan nama yang cocok di direktori PPD macOS.
 */
async function findPpdPath(
    printerName: string,
): Promise<string | null> {
    const queuePpdPath = `/etc/cups/ppd/${printerName}.ppd`

    if (existsSync(queuePpdPath)) {
        return queuePpdPath
    }

    let stdout: string

    try {
        const result = await execFileAsync(
            'lpinfo',
            ['-m'],
            {
                timeout: 15000,
                maxBuffer: 8 * 1024 * 1024,
            },
        )

        stdout = result.stdout
    } catch {
        // Beberapa instalasi CUPS tidak menyediakan lpinfo.
        stdout = ''
    }

    const printerKey = normalizeName(printerName)

    const candidates: PpdCandidate[] = stdout
        .split(/\r?\n/)
        .map((line): PpdCandidate | null => {
            // Tangani path yang mengandung spasi.
            const match = line.match(
                /^(.+?\.ppd(?:\.gz)?)\s+(.+)$/i,
            )

            if (!match) return null

            const rawPath = match[1].trim()
            const description = match[2].trim()

            let ppdPath: string

            if (rawPath.startsWith('/')) {
                ppdPath = rawPath
            } else if (
                rawPath.startsWith(
                    'Library/Printers/PPDs/Contents/Resources/',
                )
            ) {
                // lpinfo di macOS dapat mengeluarkan path relatif
                // terhadap root, bukan path absolut.
                ppdPath = resolve('/', rawPath)
            } else {
                ppdPath = join(PPD_RESOURCE_DIR, rawPath)
            }

            return {
                path: ppdPath,
                description,
            }
        })
        .filter(
            (candidate): candidate is PpdCandidate =>
                candidate !== null,
        )

    // Cari deskripsi driver yang paling cocok dengan nama queue.
    const exactMatch = candidates.find(
        (candidate) =>
            normalizeName(candidate.description) === printerKey &&
            existsSync(candidate.path),
    )

    if (exactMatch) return exactMatch.path

    // Fallback jika nama queue berbeda sedikit dari nama model.
    const partialMatches = candidates
        .filter((candidate) => {
            const descriptionKey = normalizeName(candidate.description)

            return (
                existsSync(candidate.path) &&
                descriptionKey.length > 0 &&
                (
                    descriptionKey.includes(printerKey) ||
                    printerKey.includes(descriptionKey)
                )
            )
        })
        .sort(
            (a, b) =>
                Math.abs(
                    normalizeName(a.description).length -
                    printerKey.length,
                ) -
                Math.abs(
                    normalizeName(b.description).length -
                    printerKey.length,
                ),
        )

    if (partialMatches.length > 0) {
        return partialMatches[0].path
    }

    // Fallback untuk instalasi macOS yang memiliki PPD model
    // langsung di direktori resource.
    try {
        const { stdout: resourceOutput } = await execFileAsync(
            'find',
            [
                PPD_RESOURCE_DIR,
                '-maxdepth',
                '1',
                '-type',
                'f',
                '-iname',
                '*l8050*.gz',
            ],
            {
                timeout: 5000,
                maxBuffer: 1024 * 1024,
            },
        )

        const resourceFiles = resourceOutput
            .split(/\r?\n/)
            .map((file) => file.trim())
            .filter(Boolean)

        const matchingFile = resourceFiles.find(
            (file) =>
                normalizeName(basename(file)).includes(printerKey) ||
                normalizeName(printerKey).includes(
                    normalizeName(basename(file).replace(/\.gz$/i, '')),
                ),
        )

        if (matchingFile && existsSync(matchingFile)) {
            return matchingFile
        }
    } catch {
        // Direktori PPD tidak tersedia atau find tidak diizinkan.
    }

    return null
}

/**
 * Ambil daftar media yang diaktifkan pada queue CUPS,
 * lalu cocokkan dengan dimensi dari PPD asli.
 */
async function cupsPapers(
    printerName: string,
): Promise<PaperSize[]> {
    const { stdout } = await execFileAsync(
        'lpoptions',
        ['-p', printerName, '-l'],
        {
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024,
        },
    )

    const mediaLine = stdout
        .split(/\r?\n/)
        .find((line) => /^\s*PageSize\/Media Size:/i.test(line))

    if (!mediaLine) {
        throw new Error(
            `Driver tidak mengekspos daftar PageSize untuk ${printerName}.`,
        )
    }

    const separator = mediaLine.indexOf(':')
    const supportedIds = new Set(
        mediaLine
            .slice(separator + 1)
            .trim()
            .split(/\s+/)
            .map((option) => option.replace(/^\*/, ''))
            .filter(Boolean),
    )

    if (supportedIds.size === 0) {
        throw new Error(
            `Driver tidak mengembalikan pilihan media untuk ${printerName}.`,
        )
    }

    const ppdPath = await findPpdPath(printerName)

    if (!ppdPath) {
        throw new Error(
            `Daftar media ditemukan, tetapi file PPD untuk ${printerName} ` +
            'tidak ditemukan. Dimensi tidak akan ditebak.',
        )
    }

    let ppdContent: string

    try {
        ppdContent = await readPpdFile(ppdPath)
    } catch (error) {
        const detail =
            error instanceof Error ? error.message : String(error)

        throw new Error(
            `Gagal membaca PPD printer ${printerName}: ${detail}`,
        )
    }

    const parsedPapers = parsePpd(ppdContent)

    // Hanya kembalikan media yang:
    // 1. Didukung oleh queue yang dipilih.
    // 2. Memiliki ukuran nyata di dalam PPD.
    const papers: PaperSize[] = parsedPapers
        .filter((paper) => supportedIds.has(paper.id))
        .map((paper) => ({
            id: paper.id,
            name: paper.name,
            widthMicrons: paper.widthMicrons,
            heightMicrons: paper.heightMicrons,
            source: 'driver' as const,
        }))

    if (papers.length === 0) {
        throw new Error(
            `PPD ditemukan (${ppdPath}), tetapi tidak ada media yang ` +
            `cocok dengan pilihan queue ${printerName}.`,
        )
    }

    return uniquePapers(papers)
}

async function windowsPapers(
    printerName: string,
): Promise<PaperSize[]> {
    const script = String.raw`
$ErrorActionPreference = 'Stop'
$printerName = $env:PHOTOBOOTH_PRINTER

Add-Type -AssemblyName System.Drawing

$settings = New-Object System.Drawing.Printing.PrinterSettings
$settings.PrinterName = $printerName

if (-not $settings.IsValid) {
  throw "Printer not found or unavailable: $printerName"
}

$result = foreach ($paper in $settings.PaperSizes) {
  [PSCustomObject]@{
    name = [string]$paper.PaperName
    width = [int]$paper.Width
    height = [int]$paper.Height
    kind = [string]$paper.Kind
  }
}

ConvertTo-Json -InputObject @($result) -Compress
`

    const { stdout } = await execFileAsync(
        'powershell.exe',
        [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            script,
        ],
        {
            windowsHide: true,
            timeout: 15000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
                ...process.env,
                PHOTOBOOTH_PRINTER: printerName,
            },
        },
    )

    const result = JSON.parse(stdout.trim() || '[]') as Array<{
        name: string
        width: number
        height: number
        kind: string
    }>

    return uniquePapers(
        result
            .filter(
                (paper) =>
                    paper.width > 0 &&
                    paper.height > 0,
            )
            .map((paper) => ({
                id: `${paper.name}:${paper.kind}`,
                name: paper.name,
                // Windows .NET menggunakan 1/100 inch.
                widthMicrons: Math.round(paper.width * 254),
                heightMicrons: Math.round(paper.height * 254),
                source: 'driver' as const,
            })),
    )
}

async function cupsDriverOptions(
    printerName: string,
    ppdPath: string,
): Promise<DriverOption[]> {
    const [{ stdout }, ppdContent] = await Promise.all([
        execFileAsync(
            'lpoptions',
            ['-p', printerName, '-l'],
            {
                timeout: 15000,
                maxBuffer: 2 * 1024 * 1024,
            },
        ),
        readPpdFile(ppdPath),
    ])

    // Opsi yang benar-benar tersedia pada queue CUPS.
    const supported = new Map<string, Set<string>>()

    for (const line of stdout.split(/\r?\n/)) {
        const match = line.match(
            /^\s*([^/:]+)(?:\/([^:]*))?:\s*(.*)$/,
        )

        if (!match) continue

        const id = match[1].trim()
        const values = match[3]
            .trim()
            .split(/\s+/)
            .filter(Boolean)

        supported.set(
            id,
            new Set(values.map((value) => value.replace(/^\*/, ''))),
        )
    }

    const labels = new Map<string, string>()
    const choices = new Map<
        string,
        Map<string, string>
    >()
    const defaults = new Map<string, string>()

    for (const line of ppdContent.split(/\r?\n/)) {
        // Contoh: *OpenUI *EPIJ_Medi/Media Type: PickOne
        const openUi = line.match(
            /^\*OpenUI\s+\*([^/\s:]+)(?:\/([^:]*))?:/,
        )

        if (openUi) {
            const id = openUi[1]
            labels.set(id, decodePpdText(openUi[2] || id))

            if (!choices.has(id)) {
                choices.set(id, new Map())
            }
        }

        // Contoh: *EPIJ_Medi 145/Photo Paper Glossy: ""
        const choice = line.match(
            /^\*([^/\s:]+)\s+(\S+?)(?:\/([^:]*))?:/,
        )

        if (choice) {
            const [, id, value, rawLabel] = choice

            if (
                labels.has(id) &&
                !id.startsWith('Default')
            ) {
                const optionChoices = choices.get(id)!

                optionChoices.set(
                    value,
                    decodePpdText(rawLabel || value),
                )
            }
        }

        // Contoh: *DefaultEPIJ_Medi: 0
        const defaultMatch = line.match(
            /^\*Default([^:]+):\s*(\S+)/,
        )

        if (defaultMatch) {
            defaults.set(defaultMatch[1], defaultMatch[2])
        }
    }

    const result: DriverOption[] = []

    for (const [id, label] of labels) {
        const allowedValues = supported.get(id)
        const ppdChoices = choices.get(id)

        if (!allowedValues || !ppdChoices) continue

        const availableChoices = [...ppdChoices.entries()]
            .filter(([value]) => allowedValues.has(value))
            .map(([value, choiceLabel]) => ({
                value,
                label: choiceLabel,
            }))

        if (availableChoices.length === 0) continue

        result.push({
            id,
            label,
            choices: availableChoices,
            defaultValue: defaults.get(id),
        })
    }

    return result
}

export async function getPrinterCapabilities(
    printerName: string,
): Promise<PrinterCapabilities> {
    if (!printerName.trim()) {
        throw new Error('Printer name is required.')
    }

    if (process.platform === 'win32') {
        return {
            printerName,
            platform: process.platform,
            source: 'windows-driver',
            papers: await windowsPapers(printerName),
        }
    }

    if (
        process.platform === 'darwin' ||
        process.platform === 'linux'
    ) {
        const ppdPath = await findPpdPath(printerName)

        if (!ppdPath) {
            throw new Error(
                `PPD tidak ditemukan untuk printer ${printerName}.`,
            )
        }

        const [papers, options] = await Promise.all([
            cupsPapers(printerName),
            cupsDriverOptions(printerName, ppdPath),
        ])

        return {
            printerName,
            platform: process.platform,
            source: 'cups-driver',
            papers,
            options,
        }
    }

    throw new Error(`Unsupported platform: ${process.platform}`)
}