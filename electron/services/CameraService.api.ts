import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { spawn } from 'node:child_process'
import { app, type WebContents } from 'electron'

type CameraInfo = { model: string; port?: string }
type CaptureResult = { base64: string; buffer: Buffer }
type CaptureFileResult = { path: string; filename: string }
type SettingNode = {
  name: string
  label: string
  value: string
  choices: string[]
  readonly: boolean
  type: 'text' | 'menu'
  children: SettingNode[]
}

const DEFAULT_DCC_URL = 'http://127.0.0.1:5513'

/**
 * digiCamControl-backed CameraService.
 *
 * Run Electron on Windows, start digiCamControl, and enable:
 * Settings -> Webserver -> Use web server.
 *
 * DCC owns the physical USB connection. disconnect() clears this service's
 * selection and stops live view; it does not close DCC or release its USB handle.
 */
class CameraService {
  private readonly baseUrl: string
  private connected = false
  private connectedModel: string | null = null
  private connectedSerial: string | null = null
  private connectedIndex = -1
  private previewStarted = false
  private previewLoopActive = false
  private previewTarget: WebContents | null = null
  private previewTickInFlight = false
  private listInFlight: Promise<CameraInfo[]> | null = null
  private connectInFlight: Promise<{ model: string }> | null = null
  private disconnectInFlight: Promise<void> | null = null

  constructor() {
    this.baseUrl = (process.env.DIGICAMCONTROL_URL || DEFAULT_DCC_URL).replace(/\/+$/, '')
    console.log('[CameraService] digiCamControl URL:', this.baseUrl)
  }

  /**
   * Requests a raw response body using Windows curl.exe.
   *
   * digiCamControl's Griffin.Networking webserver sends duplicate
   * Content-Length headers. Node's fetch()/http parser rejects that response,
   * while curl.exe can read it. This method intentionally captures only the
   * response body (not headers), so it also works for JPEG live-view frames.
   */
  private requestBuffer(path: string, timeoutMs = 15_000): Promise<Buffer> {
    const url = new URL(path, `${this.baseUrl}/`).toString()

    return new Promise<Buffer>((resolve, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const finish = (error?: Error, result?: Buffer): void => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)

        if (error) reject(error)
        else resolve(result ?? Buffer.alloc(0))
      }

      const child = spawn(
        'curl.exe',
        [
          '--silent',
          '--show-error',
          '--fail',
          '--max-time',
          String(Math.max(1, Math.ceil(timeoutMs / 1000))),
          url,
        ],
        {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )

      timer = setTimeout(() => {
        child.kill()
        finish(new Error(`Timeout menghubungi digiCamControl di ${this.baseUrl}.`))
      }, timeoutMs + 1_000)

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(Buffer.from(chunk))
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(Buffer.from(chunk))
      })

      child.on('error', (error) => {
        finish(
          new Error(
            `Gagal menjalankan curl.exe. Pastikan curl tersedia di Windows PATH. Detail: ${error.message}`,
          ),
        )
      })

      child.on('close', (code) => {
        if (settled) return

        if (code !== 0) {
          const detail = Buffer.concat(stderrChunks).toString('utf8').trim()
          finish(
            new Error(
              `Request digiCamControl gagal (curl exit ${code}): ${detail || 'Tidak ada detail error.'}`,
            ),
          )
          return
        }

        finish(undefined, Buffer.concat(stdoutChunks))
      })
    })
  }

  private async requestText(path: string, timeoutMs = 15_000): Promise<string> {
    const body = (await this.requestBuffer(path, timeoutMs)).toString('utf8').trim()

    if (/^\s*(error|exception)\s*[:\-]/i.test(body)) {
      throw new Error(`digiCamControl: ${body}`)
    }

    return body
  }

  private command(command: string, param1 = '', param2 = '', timeoutMs = 15_000): Promise<string> {
    const query = new URLSearchParams({ slc: command, param1, param2 })
    return this.requestText(`/?${query.toString()}`, timeoutMs)
  }

  private windowCommand(command: string): Promise<string> {
    return this.requestText(`/?${new URLSearchParams({ CMD: command })}`)
  }

  private parseList(raw: string): string[] {
    return raw.split(/\r?\n/)
      .map((line) => line.trim().replace(/^[-*]\s*/, ''))
      .filter(Boolean)
      .filter((line) => !/^(ok|success|cameras?|serials?)\s*:?\s*$/i.test(line))
      .filter((line) => !/^(error|exception)\b/i.test(line))
  }

  private assertConnected(): void {
    if (!this.connected || !this.connectedSerial) throw new Error('Camera not connected.')
  }

  private mapProperty(key: string): string {
    const last = key.split('/').filter(Boolean).pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? ''
    const aliases: Record<string, string> = {
      iso: 'iso',
      isonumber: 'iso',
      aperture: 'aperture',
      fnumber: 'aperture',
      shutterspeed: 'shutterspeed',
      shutter: 'shutterspeed',
      exposurecompensation: 'exposurecompensation',
      exposurecomp: 'exposurecompensation',
      focusmode: 'focusmode',
      whitebalance: 'whitebalance',
      mode: 'mode',
      cameramode: 'mode',
      compressionsetting: 'compressionsetting',
      imagequality: 'compressionsetting',
    }
    const property = aliases[last]
    if (!property) throw new Error(`Pengaturan "${key}" belum dipetakan ke properti digiCamControl.`)
    return property
  }

  private async getProperty(property: string): Promise<string> {
    return this.command('get', property, '')
  }

  private async getChoices(property: string): Promise<string[]> {
    try {
      // DCC expects list&param1=iso, not list&param1=camera.iso.
      return this.parseList(await this.command('list', property, ''))
    } catch (error) {
      console.warn(`[CameraService] Pilihan ${property} tidak tersedia:`, error)
      return []
    }
  }

  private async getCameraModel(serial: string): Promise<string> {
    // DCC's list cameras command returns serial numbers. Select that camera,
    // then query its device name for a human-readable model.
    await this.command('set', 'camera', serial)
    try {
      const name = await this.command('get', 'property.devicename', '')
      const cleaned = name.trim()
      if (cleaned) {
        // DCC may return e.g. "Canon EOS 550D (1132568580)".
        return cleaned
  .replace(`(${serial})`, '')
  .trim() || cleaned
      }
    } catch (error) {
      console.warn(`[CameraService] Nama kamera untuk ${serial} tidak tersedia:`, error)
    }
    return serial
  }

  private async captureToPath(targetPath: string): Promise<void> {
    await fs.mkdir(join(targetPath, '..'), { recursive: true })
    await this.command('capture', targetPath, '', 120_000)

    // Allow a short delay for the camera/driver to flush the file to disk.
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const stat = await fs.stat(targetPath)
        if (stat.isFile() && stat.size > 0) return
      } catch {
        // File may not have appeared yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(
      `File hasil capture tidak ditemukan: ${targetPath}. Periksa mode transfer dan session digiCamControl.`,
    )
  }

  /** Returns camera identifiers exposed by DCC's "list cameras" command. */
  async list(): Promise<CameraInfo[]> {
    if (this.connected && this.connectedSerial) {
      return [{ model: this.connectedModel ?? this.connectedSerial, port: this.connectedSerial }]
    }
    if (this.listInFlight) return this.listInFlight

    const operation = (async () => {
      const serials = this.parseList(await this.command('list', 'cameras', ''))
      const cameras: CameraInfo[] = []
      for (const serial of serials) {
        const model = await this.getCameraModel(serial)
        cameras.push({ model, port: serial })
      }
      return cameras
    })()

    this.listInFlight = operation
    try {
      return await operation
    } finally {
      if (this.listInFlight === operation) this.listInFlight = null
    }
  }

  /** Selects a camera already connected to digiCamControl. */
  async connect(index = 0): Promise<{ model: string }> {
    if (this.connected && this.connectedIndex === index && this.connectedModel) {
      return { model: this.connectedModel }
    }
    if (this.connected) {
      throw new Error(`Camera index ${index} requested but index ${this.connectedIndex} is selected. Disconnect first.`)
    }
    if (this.disconnectInFlight) await this.disconnectInFlight
    if (this.connectInFlight) return this.connectInFlight

    const operation = (async () => {
      const cameras = await this.list()
      const camera = cameras[index]
      if (!camera) {
        throw new Error(cameras.length
          ? `Camera at index ${index} not found.`
          : 'No camera found. Pastikan Canon terdeteksi di aplikasi digiCamControl.')
      }

      const serial = camera.port ?? camera.model
      await this.command('set', 'camera', serial)
      this.connected = true
      this.connectedSerial = serial
      this.connectedModel = camera.model
      this.connectedIndex = index
      return { model: camera.model }
    })()

    this.connectInFlight = operation
    try {
      return await operation
    } finally {
      if (this.connectInFlight === operation) this.connectInFlight = null
    }
  }

  async disconnect(): Promise<void> {
    if (this.disconnectInFlight) return this.disconnectInFlight
    const operation = (async () => {
      this.previewLoopActive = false
      this.previewTarget = null
      if (this.previewStarted) {
        try {
          await this.windowCommand('LiveViewWnd_Hide')
        } catch (error) {
          console.warn('[CameraService] Failed to stop DCC live view:', error)
        }
      }
      this.previewStarted = false
      this.connected = false
      this.connectedModel = null
      this.connectedSerial = null
      this.connectedIndex = -1
    })()

    this.disconnectInFlight = operation
    try {
      await operation
    } finally {
      if (this.disconnectInFlight === operation) this.disconnectInFlight = null
    }
  }

  getStatus(): { connected: boolean; model: string | null } {
    return { connected: this.connected, model: this.connectedModel }
  }

  /**
   * Returns a normalized settings tree with children/value/choices fields.
   * It is not identical to libgphoto2's config tree; renderer code that depends
   * on gphoto2-specific node fields may need a small adapter.
   */
  
async getConfig(): Promise<any> {
  this.assertConnected()

  const definitions = [
    {
      name: 'aperture',
      label: 'Aperture',
      group: 'capturesettings',
      property: 'aperture',
    },
    {
      name: 'shutterspeed',
      label: 'Shutter Speed',
      group: 'capturesettings',
      property: 'shutterspeed',
    },
    {
      name: 'iso',
      label: 'ISO',
      group: 'imgsettings',
      property: 'iso',
    },
    {
      name: 'whitebalance',
      label: 'White Balance',
      group: 'imgsettings',
      property: 'whitebalance',
    },
  ] as const

  const groups: Record<string, Record<string, any>> = {
    capturesettings: {},
    imgsettings: {},
  }

  for (const definition of definitions) {
    try {
      const [value, choices] = await Promise.all([
        this.getProperty(definition.property),
        this.getChoices(definition.property),
      ])

      groups[definition.group][definition.name] = {
        name: definition.name,
        label: definition.label,
        value,
        choices,
        readonly: false,
        type: choices.length ? 'menu' : 'text',
        children: [],
      }
    } catch (error) {
      console.warn(
        `[CameraService] Gagal membaca ${definition.name}:`,
        error,
      )
    }
  }

  return {
    name: 'root',
    label: 'Camera Settings',
    main: {
      name: 'main',
      label: 'Camera',
      children: {
        capturesettings: {
          name: 'capturesettings',
          label: 'Capture Settings',
          children: groups.capturesettings,
        },
        imgsettings: {
          name: 'imgsettings',
          label: 'Image Settings',
          children: groups.imgsettings,
        },
      },
    },
  }
}


  async setConfigValue(key: string, value: string | number): Promise<void> {
    this.assertConnected()
    await this.command('set', this.mapProperty(key), String(value))
  }

  /** Captures the current live-view frame as a JPEG data URL. */
  async capturePreview(): Promise<string> {
    this.assertConnected()
    if (!this.previewStarted) {
      await this.windowCommand('LiveViewWnd_Show')
      this.previewStarted = true
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    const buffer = await this.requestBuffer('/liveview.jpg')
    if (!buffer.length) throw new Error('digiCamControl mengembalikan frame live view kosong.')
    return `data:image/jpeg;base64,${buffer.toString('base64')}`
  }

  async captureImage(): Promise<CaptureResult> {
    this.assertConnected()
    const targetPath = join(tmpdir(), `capture-${Date.now()}.jpg`)
    await this.captureToPath(targetPath)
    try {
      const buffer = await fs.readFile(targetPath)
      return { buffer, base64: `data:image/jpeg;base64,${buffer.toString('base64')}` }
    } finally {
      await fs.unlink(targetPath).catch(() => undefined)
    }
  }

  async captureToFile(sessionId: string): Promise<CaptureFileResult> {
    this.assertConnected()
    const dir = join(app.getPath('userData'), 'captures', basename(sessionId))
    await fs.mkdir(dir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `capture-${timestamp}.jpg`
    const targetPath = join(dir, filename)
    await this.captureToPath(targetPath)
    return { path: targetPath, filename }
  }

  async captureToTempFile(): Promise<{ base64: string }> {
    this.assertConnected()
    const targetPath = join(tmpdir(), `capture-${Date.now()}.jpg`)
    await this.captureToPath(targetPath)
    try {
      const buffer = await fs.readFile(targetPath)
      return { base64: `data:image/jpeg;base64,${buffer.toString('base64')}` }
    } finally {
      await fs.unlink(targetPath).catch(() => undefined)
    }
  }

  /** Sends JPEG Buffer frames on the same IPC channel as the old service. */
  startPreviewLoop(wc: WebContents, fps = 15): void {
    if (this.previewLoopActive) return
    this.previewLoopActive = true
    this.previewTarget = wc
    const interval = Math.max(1000 / fps, 100)

    const tick = async (): Promise<void> => {
      if (!this.previewLoopActive || !this.connected) return
      if (!this.previewTickInFlight) {
        this.previewTickInFlight = true
        try {
          if (!this.previewStarted) {
            await this.windowCommand('LiveViewWnd_Show')
            this.previewStarted = true
          }
          const buffer = await this.requestBuffer('/liveview.jpg')
          const target = this.previewTarget
          if (buffer.length && target && !target.isDestroyed() && this.previewLoopActive) {
            target.send('camera:preview-frame', buffer)
          }
        } catch (error) {
          console.warn('[CameraService] Preview frame failed:', error)
        } finally {
          this.previewTickInFlight = false
        }
      }
      if (this.previewLoopActive) setTimeout(() => void tick(), interval)
    }

    void tick()
  }

  stopPreviewLoop(): void {
    this.previewLoopActive = false
    this.previewTarget = null
    if (this.previewStarted) {
      void this.windowCommand('LiveViewWnd_Hide')
        .catch((error) => console.warn('[CameraService] Failed to hide live view:', error))
        .finally(() => { this.previewStarted = false })
    }
  }
}

export const cameraService = new CameraService()
