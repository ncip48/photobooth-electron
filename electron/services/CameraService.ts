import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { accessSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { app, type WebContents } from "electron";
import { createInterface } from "node:readline";

type CameraInfo = { model: string; port?: string };
type CaptureResult = { base64: string; buffer: Buffer };
type CaptureFileResult = { path: string; filename: string };

type SessionResponse<T = unknown> = {
  id: number;
  ok: boolean;
  result?: T;
  error?: string;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Resolved once, at first use. */
let exePathCache: string | null = null;

function resolveExe(): string {
  if (exePathCache) return exePathCache;

  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, "windows-camera", "WindowsCamera.exe"),
        join(process.resourcesPath, "WindowsCamera.exe"),
      ]
    : [
        join(
          app.getAppPath(),
          "electron",
          "windows-camera",
          "src",
          "WindowsCamera.Cli",
          "bin",
          "Debug",
          "net8.0-windows",
          "win-x86",
          "WindowsCamera.exe",
        ),
        join(
          app.getAppPath(),
          "electron",
          "windows-camera",
          "src",
          "WindowsCamera.Cli",
          "bin",
          "Debug",
          "net8.0-windows",
          "WindowsCamera.exe",
        ),
      ];

  if (process.env.WINDOWS_CAMERA_EXE) {
    exePathCache = process.env.WINDOWS_CAMERA_EXE;
    return exePathCache;
  }

  for (const candidate of candidates) {
    try {
      accessSync(candidate);
      exePathCache = candidate;
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(
    `WindowsCamera.exe not found. Looked in:\n${candidates.join("\n")}\n` +
      "Set WINDOWS_CAMERA_EXE to override.",
  );
}

function outputPath(result: unknown, fallback: string): string {
  if (typeof result === "string") return result;
  if (
    result !== null &&
    typeof result === "object" &&
    "path" in result &&
    typeof result.path === "string"
  ) {
    return result.path;
  }
  return fallback;
}

class CameraService {
  private connectedIndex = -1;
  private connectedModel: string | null = null;
  private previewLoopActive = false;
  private previewTarget: WebContents | null = null;
  private previewTickInFlight = false;
  private listInFlight: Promise<CameraInfo[]> | null = null;
  private connectInFlight: Promise<{ model: string }> | null = null;

  private session: ChildProcessWithoutNullStreams | null = null;
  private sessionLines: ReturnType<typeof createInterface> | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private sessionStart: Promise<void> | null = null;
  private commandQueue: Promise<unknown> = Promise.resolve();

  /**
   * Start one long-lived WindowsCamera.exe process. The C# CLI must support
   * `--session` and JSON-lines requests on stdin/stdout.
   */
  private async ensureSession(): Promise<void> {
    if (this.session && this.session.exitCode === null && !this.session.killed)
      return;
    if (this.sessionStart) return this.sessionStart;

    const operation = (async () => {
      const exe = resolveExe();
      const child = spawn(exe, ["--session"], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.session = child;
      const lines = createInterface({ input: child.stdout });
      this.sessionLines = lines;

      lines.on("line", (line) => {
        const text = line.trim();
        if (!text) return;

        let response: SessionResponse;
        try {
          response = JSON.parse(text) as SessionResponse;
        } catch {
          console.warn(
            "[CameraService] Ignoring non-JSON session output:",
            text,
          );
          return;
        }

        const pending = this.pending.get(response.id);
        if (!pending) {
          console.warn(
            "[CameraService] Received response for unknown request:",
            response.id,
          );
          return;
        }

        clearTimeout(pending.timer);
        this.pending.delete(response.id);

        if (response.ok) {
          pending.resolve(response.result);
        } else {
          pending.reject(
            new Error(
              response.error || "WindowsCamera session command failed.",
            ),
          );
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const message = chunk.toString("utf8").trim();
        if (message) console.warn("[WindowsCamera]", message);
      });

      child.on("error", (error) => {
        this.rejectAllPending(
          new Error(`Failed to launch WindowsCamera.exe: ${error.message}`),
        );
        if (this.session === child) {
          this.session = null;
          this.sessionLines = null;
        }
      });

      child.on("close", (code, signal) => {
        const error = new Error(
          `WindowsCamera session exited (code ${code ?? "null"}${signal ? `, signal ${signal}` : ""}).`,
        );
        this.rejectAllPending(error);
        lines.close();
        if (this.session === child) {
          this.session = null;
          this.sessionLines = null;
          this.connectedIndex = -1;
          this.connectedModel = null;
        }
      });

      // Give Node a turn to deliver immediate spawn errors before commands are sent.
      await new Promise<void>((resolve, reject) => {
        const onSpawn = () => {
          cleanup();
          resolve();
        };
        const onError = (error: Error) => {
          cleanup();
          reject(
            new Error(`Failed to launch WindowsCamera.exe: ${error.message}`),
          );
        };
        const cleanup = () => {
          child.off("spawn", onSpawn);
          child.off("error", onError);
        };
        child.once("spawn", onSpawn);
        child.once("error", onError);
      });
    })();

    this.sessionStart = operation;
    try {
      await operation;
    } finally {
      if (this.sessionStart === operation) this.sessionStart = null;
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [id, request] of this.pending) {
      clearTimeout(request.timer);
      request.reject(error);
      this.pending.delete(id);
    }
  }

  /**
   * Send one command to the persistent C# session. Commands are serialized so
   * capture, settings changes, and live view don't overlap on the camera.
   */
  private command<T>(
    action: string,
    fields: Record<string, unknown> = {},
    timeoutMs = 180_000,
  ): Promise<T> {
    const runCommand = async (): Promise<T> => {
      await this.ensureSession();
      const child = this.session;
      if (!child || !child.stdin.writable) {
        throw new Error("WindowsCamera session is not available.");
      }

      const id = String(++this.nextRequestId);
      const payload = JSON.stringify({
        id,
        action,
        ...fields,
        timeoutSeconds: Math.max(1, Math.ceil(timeoutMs / 1000)),
      });

      const response = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(
            new Error(
              `WindowsCamera ${action} timed out after ${timeoutMs}ms.`,
            ),
          );
        }, timeoutMs);

        this.pending.set(id, { resolve, reject, timer });
        child.stdin.write(`${payload}\n`, (error) => {
          if (!error) return;
          const pending = this.pending.get(id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(id);
          pending.reject(
            new Error(
              `Failed to write to WindowsCamera session: ${error.message}`,
            ),
          );
        });
      });

      return (await response) as T;
    };

    const operation = this.commandQueue.then(runCommand, runCommand);
    this.commandQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async list(): Promise<CameraInfo[]> {
    if (this.listInFlight) return this.listInFlight;

    const operation = this.command<
      Array<{ index: number; model: string; port?: string }>
    >("list")
      .then((rows) => rows.map((row) => ({ model: row.model, port: row.port })))
      .catch((error: Error) => {
        if (/No camera found/i.test(error.message)) return [];
        throw error;
      });

    this.listInFlight = operation;
    try {
      return await operation;
    } finally {
      if (this.listInFlight === operation) this.listInFlight = null;
    }
  }

  async connect(index = 0): Promise<{ model: string }> {
    if (this.connectedIndex === index && this.connectedModel && this.session) {
      return { model: this.connectedModel };
    }
    if (this.connectInFlight) return this.connectInFlight;

    const operation = (async () => {
      const cameras = await this.list();
      const camera = cameras[index];
      if (!camera) {
        throw new Error(
          cameras.length
            ? `Camera at index ${index} not found.`
            : "No camera found. Pastikan kamera terdeteksi.",
        );
      }

      const status = await this.command<{
        camera?: { connected?: boolean; model?: string };
        connected?: boolean;
        model?: string;
      }>("status", { index });

      const cameraStatus = status.camera ?? status;
      if (!cameraStatus.connected) {
        throw new Error("Camera selected but not connected.");
      }

      this.connectedIndex = index;
      this.connectedModel = cameraStatus.model || camera.model;
      return { model: this.connectedModel };
    })();

    this.connectInFlight = operation;
    try {
      return await operation;
    } finally {
      if (this.connectInFlight === operation) this.connectInFlight = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPreviewLoop();

    const child = this.session;
    if (child && child.exitCode === null && !child.killed) {
      try {
        await this.command<unknown>("shutdown", {}, 10_000);
      } catch (error) {
        console.warn("[CameraService] Session shutdown failed:", error);
      }

      // Give the CLI time to leave the session loop and dispose CameraService
      // (which closes the native camera manager) before forcing process exit.
      if (child.exitCode === null && !child.killed) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            child.off("close", onClose);
            resolve();
          }, 2_000);
          const onClose = () => {
            clearTimeout(timer);
            resolve();
          };
          child.once("close", onClose);
        });
      }

      // Last resort only: don't leave a stuck native camera process behind.
      if (child.exitCode === null && !child.killed) {
        child.kill();
      }
    }

    this.connectedIndex = -1;
    this.connectedModel = null;
  }

  getStatus(): { connected: boolean; model: string | null } {
    return { connected: this.connectedIndex >= 0, model: this.connectedModel };
  }

  private assertConnected(): void {
    if (this.connectedIndex < 0) throw new Error("Camera not connected.");
  }

  async getConfig(): Promise<any> {
    this.assertConnected();

    const status = await this.command<{
      camera?: {
        connected?: boolean;
        model?: string;
        port?: string;
      };
      config?: {
        name: string;
        label: string;
        main: {
          name: string;
          label: string;
          children: Record<string, unknown>;
        };
      };
    }>("status", { index: this.connectedIndex });

    if (!status.config) {
      throw new Error("Camera status did not include configuration settings.");
    }

    return status.config;
  }

  async setConfigValue(key: string, value: string | number): Promise<void> {
    this.assertConnected();
    await this.command<unknown>(
      "set",
      { index: this.connectedIndex, key, value: String(value) },
      30_000,
    );
  }

  async capturePreview(): Promise<string> {
    this.assertConnected();
    const target = join(
      tmpdir(),
      `liveview-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
    );
    try {
      const result = await this.command<unknown>(
        "liveview",
        { index: this.connectedIndex, out: target },
        20_000,
      );
      const actualPath = outputPath(result, target);
      const buffer = await fs.readFile(actualPath);
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } finally {
      await fs.unlink(target).catch(() => undefined);
    }
  }

  private async captureToTarget(
    targetPath: string,
    sets: Array<[string, string]> = [],
  ): Promise<void> {
    await this.command<unknown>(
      "capture",
      {
        index: this.connectedIndex,
        out: targetPath,
        sets: sets.map(([key, value]) => `${key}=${value}`),
      },
      180_000,
    );
  }

  async captureImage(
    sets: Array<[string, string]> = [],
  ): Promise<CaptureResult> {
    this.assertConnected();
    const targetPath = join(
      tmpdir(),
      `capture-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
    );
    await this.captureToTarget(targetPath, sets);
    try {
      const buffer = await fs.readFile(targetPath);
      return {
        buffer,
        base64: `data:image/jpeg;base64,${buffer.toString("base64")}`,
      };
    } finally {
      await fs.unlink(targetPath).catch(() => undefined);
    }
  }

  async captureToFile(
    sessionId: string,
    sets: Array<[string, string]> = [],
  ): Promise<CaptureFileResult> {
    this.assertConnected();
    const dir = join(app.getPath("userData"), "captures", basename(sessionId));
    await fs.mkdir(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `capture-${timestamp}.jpg`;
    const targetPath = join(dir, filename);
    await this.captureToTarget(targetPath, sets);
    return { path: targetPath, filename };
  }

  async captureToTempFile(
    sets: Array<[string, string]> = [],
  ): Promise<{ base64: string }> {
    this.assertConnected();
    const targetPath = join(
      tmpdir(),
      `capture-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
    );
    await this.captureToTarget(targetPath, sets);
    try {
      const buffer = await fs.readFile(targetPath);
      return { base64: `data:image/jpeg;base64,${buffer.toString("base64")}` };
    } finally {
      await fs.unlink(targetPath).catch(() => undefined);
    }
  }

  /** Send preview frames over the existing IPC channel. */
  startPreviewLoop(wc: WebContents, fps = 5): void {
    if (this.previewLoopActive) return;

    this.previewLoopActive = true;
    this.previewTarget = wc;

    const interval = Math.max(1000 / fps, 100);
    const cameraIndex = this.connectedIndex;

    const tick = async (): Promise<void> => {
      if (!this.previewLoopActive || this.connectedIndex < 0) return;

      if (!this.previewTickInFlight) {
        this.previewTickInFlight = true;

        const target = join(
          tmpdir(),
          `live-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`,
        );

        try {
          const result = await this.command<unknown>(
            "liveview",
            { index: cameraIndex, out: target },
            20_000,
          );

          const actualPath = outputPath(result, target);
          const buffer = await fs.readFile(actualPath);

          const dest = this.previewTarget;

          if (
            buffer.length &&
            dest &&
            !dest.isDestroyed() &&
            this.previewLoopActive
          ) {
            dest.send("camera:preview-frame", buffer);
          }
        } catch (error) {
          if (this.previewLoopActive) {
            console.warn("[CameraService] Preview frame failed:", error);
          }
        } finally {
          await fs.unlink(target).catch(() => undefined);
          this.previewTickInFlight = false;
        }
      }

      if (this.previewLoopActive) {
        setTimeout(() => void tick(), interval);
      }
    };

    // Start Live View once before requesting the first frame.
    void this.command<unknown>("startliveview", { index: cameraIndex }, 20_000)
      .then(() => {
        if (this.previewLoopActive) {
          void tick();
        } else {
          // The preview may have been stopped while startup was in progress.
          return this.command<unknown>(
            "stopliveview",
            { index: cameraIndex },
            20_000,
          );
        }
      })
      .catch((error) => {
        if (this.previewLoopActive) {
          console.warn("[CameraService] Failed to start Live View:", error);
          this.previewLoopActive = false;
          this.previewTarget = null;
        }
      });
  }

  stopPreviewLoop(): void {
    const wasActive = this.previewLoopActive;
    const cameraIndex = this.connectedIndex;

    this.previewLoopActive = false;
    this.previewTarget = null;

    if (wasActive && cameraIndex >= 0) {
      // Queued after any in-flight frame, so Live View stops cleanly.
      void this.command<unknown>(
        "stopliveview",
        { index: cameraIndex },
        20_000,
      ).catch((error) => {
        console.warn("[CameraService] Failed to stop Live View:", error);
      });
    }
  }
}

export const cameraService = new CameraService();
