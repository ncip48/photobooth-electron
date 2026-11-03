using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CameraControl.Devices;
using CameraControl.Devices.Classes;

namespace WindowsCamera.Cli;

/// <summary>
/// Standalone camera service backed by CameraControl.Devices.
/// </summary>
public sealed class CameraService : IDisposable
{
    private readonly CameraDeviceManager _manager;
    private readonly bool _verbose;

    private bool _disposed;
    private ICameraDevice? _liveViewDevice;
    private bool _liveViewStarted;

    // Capture handshake state -------------------------------------------------
    // The camera raises PhotoCaptured asynchronously after CapturePhoto()
    // returns (see the official CameraControlCmd.Program.Capture()). These
    // fields bridge that callback back to the synchronously-waiting caller.
    private TaskCompletionSource<byte[]>? _captureCompletion;

    // Diagnostic hooks --------------------------------------------------------
    // These let us tell apart "shot was taken" (CaptureCompleted) from
    // "image was delivered" (PhotoCaptured). If only the first fires, the
    // problem is the transfer event, not the capture itself.
    private readonly HashSet<ICameraDevice> _captureCompletedHooked = new();

    public CameraService(bool verbose)
    {
        _verbose = verbose;

        _manager = new CameraDeviceManager();

        // _manager.DetectWebcams = false; // Avoid AddWebcameras / Accord dependency.
        // _manager.UseExperimentalDrivers = false;
        // _manager.DisableNativeDrivers = false;

        _manager.CameraConnected += OnCameraConnected;
        _manager.CameraDisconnected += OnCameraDisconnected;

        // IMPORTANT: the transfer handler must be the instance method that
        // resolves _captureCompletion. The official CLI uses its own static
        // handler because it has no TCS to feed.
        _manager.PhotoCaptured += OnPhotoCaptured;

        _manager.ConnectToCamera();

        // Devices may already be connected by the time we get here.
        foreach (var cam in _manager.ConnectedDevices)
            HookDevice(cam);
    }

    private void OnCameraConnected(ICameraDevice cameraDevice)
    {
        // FIX #3: the reference program's DeviceManagerCameraConnected does real
        // work here. Some bodies (including the 550D) won't raise capture
        // events until the device object is fully initialized with a name and,
        // when sessions are in play, an attached photo session.
        try
        {
            if (string.IsNullOrWhiteSpace(cameraDevice.DisplayName))
                cameraDevice.DisplayName = cameraDevice.DeviceName;
        }
        catch (Exception ex)
        {
            Log($"Failed to initialize device display name: {ex.Message}");
        }

        HookDevice(cameraDevice);

        Log($"Connected: {cameraDevice.DisplayName}");
    }

    private void OnCameraDisconnected(ICameraDevice cameraDevice)
    {
        _captureCompletedHooked.Remove(cameraDevice);
        Log($"Disconnected: {cameraDevice.DisplayName}");
    }

    /// <summary>
    /// FIX #2 (diagnostic): subscribe CaptureCompleted per device so we can see
    /// in the log whether the shutter actually fired independently of whether
    /// the image was ever transferred.
    /// </summary>
    private void HookDevice(ICameraDevice cameraDevice)
    {
        if (!_captureCompletedHooked.Add(cameraDevice))
            return;

        cameraDevice.CaptureCompleted += (_, _) =>
            Log($"CaptureCompleted fired on {cameraDevice.DisplayName}.");
    }

    // ------------------------------------------------------------
    // Photo transfer
    // ------------------------------------------------------------

    /// <summary>
    /// Raised by the device manager once the camera has a picture ready.
    /// Mirrors CameraControlCmd.Program.DeviceManager_PhotoCaptured: the
    /// transfer runs on its own STA thread because EDSDK does not want
    /// transfers executed on the event-callback thread.
    /// </summary>
    private void OnPhotoCaptured(object? sender, PhotoCapturedEventArgs eventArgs)
    {
        Log("PhotoCaptured event received.");

        var completion = Volatile.Read(ref _captureCompletion);

        if (completion == null)
        {
            // No pending capture (spontaneous shutter press, etc.).
            eventArgs.CameraDevice.IsBusy = false;
            return;
        }

        var thread = new Thread(() => TransferPhoto(eventArgs, completion))
        {
            IsBackground = true,
            Name = "HeloraBooth-PhotoTransfer"
        };

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }

    /// <summary>
    /// The body of the official CLI's PhotoCaptured(object) method, but the
    /// resulting bytes are handed to the pending TaskCompletionSource instead
    /// of being written to a hard-coded file.
    /// </summary>
    private void TransferPhoto(
        PhotoCapturedEventArgs eventArgs,
        TaskCompletionSource<byte[]> completion)
    {
        string? tempFile = null;

        try
        {
            Log("Photo transfer begin.");

            var extension = Path.GetExtension(eventArgs.FileName);

            if (string.IsNullOrWhiteSpace(extension))
                extension = ".jpg";

            tempFile = Path.Combine(
                Path.GetTempPath(),
                $"helorabooth-{Guid.NewGuid():N}{extension}");

            eventArgs.CameraDevice.TransferFile(eventArgs.Handle, tempFile);

            if (!File.Exists(tempFile))
            {
                throw new IOException(
                    $"Camera transfer completed, but the file was not created: {tempFile}");
            }

            var imageBytes = File.ReadAllBytes(tempFile);

            if (imageBytes.Length == 0)
                throw new IOException("The transferred image file is empty.");

            Log($"Photo transfer done: {imageBytes.Length} bytes.");

            completion.TrySetResult(imageBytes);
        }
        catch (Exception ex)
        {
            Log($"Photo transfer failed: {ex}");
            completion.TrySetException(ex);
        }
        finally
        {
            try
            {
                eventArgs.CameraDevice.IsBusy = false;
            }
            catch (Exception ex)
            {
                Log($"Failed to reset camera busy state: {ex.Message}");
            }

            if (tempFile != null && File.Exists(tempFile))
            {
                try
                {
                    File.Delete(tempFile);
                }
                catch (IOException ex)
                {
                    Log($"Temporary-file cleanup failed: {ex.Message}");
                }
                catch (UnauthorizedAccessException ex)
                {
                    Log($"Temporary-file cleanup denied: {ex.Message}");
                }
            }
        }
    }

    private void Log(string message)
    {
        if (_verbose)
            Console.Error.WriteLine($"[camera] {message}");
    }

    // ------------------------------------------------------------
    // Camera listing and selection
    // ------------------------------------------------------------

    public IReadOnlyList<object> List() =>
        _manager.ConnectedDevices
            .Select((camera, index) => (object)new
            {
                index,
                model = camera.DeviceName,
                port = camera.PortName,
                connected = camera.IsConnected
            })
            .ToList();

    public bool Select(int index)
    {
        var devices = _manager.ConnectedDevices;

        if (index < 0 || index >= devices.Count)
            return false;

        var device = devices[index];

        if (ReferenceEquals(_manager.SelectedCameraDevice, device))
            return device.IsConnected;

        _manager.SelectedCameraDevice = device;
        return device.IsConnected;
    }

    public bool TrySelect(int index, out string error)
    {
        if (_disposed)
        {
            error = "Camera service has already been disposed.";
            return false;
        }

        var devices = _manager.ConnectedDevices;

        if (devices.Count == 0)
        {
            error = "No camera found. Pastikan kamera terdeteksi.";
            return false;
        }

        if (index < 0 || index >= devices.Count)
        {
            error = $"Camera at index {index} not found.";
            return false;
        }

        if (!Select(index))
        {
            error = $"Camera at index {index} is not connected.";
            return false;
        }

        error = "";
        return true;
    }

    public ICameraDevice Device =>
        _manager.SelectedCameraDevice is { IsConnected: true } device
            ? device
            : throw new InvalidOperationException("Camera not connected.");

    public object GetStatus() => new
    {
        connected = _manager.SelectedCameraDevice?.IsConnected ?? false,
        model = _manager.SelectedCameraDevice?.DisplayName ?? "",
        port = _manager.SelectedCameraDevice?.PortName ?? ""
    };

    // ------------------------------------------------------------
    // Camera configuration
    // ------------------------------------------------------------

    public object GetConfig()
    {
        var device = Device;

        var capture = new Dictionary<string, object>
        {
            ["aperture"] =
                Node("aperture", "Aperture", device.FNumber),

            ["shutterspeed"] =
                Node("shutterspeed", "Shutter Speed", device.ShutterSpeed)
        };

        var image = new Dictionary<string, object>
        {
            ["iso"] = Node("iso", "ISO", device.IsoNumber),

            ["whitebalance"] =
                Node("whitebalance", "White Balance", device.WhiteBalance)
        };

        return new
        {
            name = "root",
            label = "Camera Settings",
            main = new
            {
                name = "main",
                label = "Camera",
                children = new Dictionary<string, object>
                {
                    ["capturesettings"] = new
                    {
                        name = "capturesettings",
                        label = "Capture Settings",
                        children = capture
                    },
                    ["imgsettings"] = new
                    {
                        name = "imgsettings",
                        label = "Image Settings",
                        children = image
                    }
                }
            }
        };
    }

    private static object Node(
        string name,
        string label,
        object property)
    {
        var type = property.GetType();
        var choices = Array.Empty<string>();

        var valuesProperty = type.GetProperty("Values");

        if (valuesProperty?.GetValue(property) is IEnumerable values)
        {
            choices = values
                .Cast<object>()
                .Select(value => value?.ToString() ?? "")
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .ToArray();
        }

        var value = type.GetProperty("Value")
            ?.GetValue(property)
            ?.ToString() ?? "";

        return new
        {
            name,
            label,
            value,
            choices,
            @readonly = false,
            type = choices.Length > 0 ? "menu" : "text",
            children = Array.Empty<object>()
        };
    }

    public void SetConfigValue(string key, string value)
    {
        var device = Device;

        var normalizedKey = key.Split('/').Last()
            .Replace("-", "")
            .Replace("_", "")
            .Replace(" ", "")
            .ToLowerInvariant();

        switch (normalizedKey)
        {
            case "iso":
            case "isonumber":
                device.IsoNumber.Value = value;
                break;

            case "aperture":
            case "fnumber":
                device.FNumber.Value =
                    Math.Round(
                        float.Parse(value, CultureInfo.InvariantCulture))
                    .ToString(CultureInfo.InvariantCulture);
                break;

            case "shutterspeed":
            case "shutter":
                device.ShutterSpeed.Value = value;
                break;

            case "exposurecompensation":
            case "exposurecomp":
                device.ExposureCompensation.Value = value;
                break;

            case "focusmode":
                device.FocusMode.Value = value;
                break;

            case "whitebalance":
                device.WhiteBalance.Value = value;
                break;

            case "mode":
            case "cameramode":
                device.Mode.Value = value;
                break;

            case "compressionsetting":
            case "imagequality":
                device.CompressionSetting.Value = value;
                break;

            default:
                throw new ArgumentException(
                    $"Pengaturan \"{key}\" belum dipetakan ke properti EDSDK.");
        }
    }

    // ------------------------------------------------------------
    // Live View
    // ------------------------------------------------------------

    public void StartLiveView()
    {
        var device = Device;

        if (_liveViewStarted &&
            ReferenceEquals(_liveViewDevice, device))
        {
            return;
        }

        StopLiveView();

        device.StartLiveView();

        _liveViewDevice = device;
        _liveViewStarted = true;

        Log("Live View started.");
    }

    public byte[] GetLiveViewFrame(TimeSpan timeout)
    {
        StartLiveView();

        var device = Device;
        var deadline = DateTime.UtcNow + timeout;

        while (DateTime.UtcNow < deadline)
        {
            var jpeg = ExtractJpeg(device.GetLiveViewImage());

            if (jpeg.Length > 0)
                return jpeg;

            Thread.Sleep(50);
        }

        throw new TimeoutException(
            "Tidak ada frame live view yang diterima.");
    }

    public void StopLiveView()
    {
        var device = _liveViewDevice;

        _liveViewDevice = null;
        _liveViewStarted = false;

        if (device is null)
            return;

        try
        {
            device.StopLiveView();
            Log("Live View stopped.");
        }
        catch (Exception ex)
        {
            Log($"Stopping Live View failed: {ex.Message}");
        }
    }

    private static byte[] ExtractJpeg(LiveViewData? data)
    {
        if (data?.ImageData is not { Length: > 0 } raw)
            return Array.Empty<byte>();

        var offset = Math.Clamp(data.ImageDataPosition, 0, raw.Length);

        return offset == 0 ? raw : raw[offset..];
    }

    // ------------------------------------------------------------
    // Capture and transfer
    // ------------------------------------------------------------

    public byte[] CaptureOnce(TimeSpan timeout)
    {
        return CaptureOnce(Device, timeout);
    }

    public byte[] CaptureOnce(
        ICameraDevice device,
        TimeSpan timeout)
    {
        return CaptureOnceAsync(device, timeout)
            .GetAwaiter()
            .GetResult();
    }

    /// <summary>
    /// Mirrors CameraControlCmd.Program.Capture(): flag the device busy, set
    /// CaptureInSdRam but only when the body actually reports CaptureInRam,
    /// then call CapturePhoto() once. PhotoCaptured arrives later and completes
    /// <see cref="_captureCompletion"/>.
    /// </summary>
    private async Task<byte[]> CaptureOnceAsync(
        ICameraDevice device,
        TimeSpan timeout)
    {
        if (device.IsBusy)
            throw new InvalidOperationException("Camera is busy before capture.");

        var completion = new TaskCompletionSource<byte[]>(
            TaskCreationOptions.RunContinuationsAsynchronously);

        if (Interlocked.CompareExchange(
                ref _captureCompletion, completion, null) != null)
        {
            throw new InvalidOperationException(
                "Another capture is already in progress.");
        }

        try
        {
            // FIX #1: order and capability guard, matching the reference's
            // Program.Capture(). IsBusy first, then CaptureInSdRam, and only
            // force SD-RAM when the camera reports CaptureInRam. On a 550D,
            // forcing it unconditionally can take the shot to card but never
            // raise the object-ready event that drives PhotoCaptured, leaving
            // the body busy forever with no image.
            device.IsBusy = true;

            device.CaptureInSdRam = false;

            if (!device.GetCapability(CapabilityEnum.CaptureInRam))
                device.CaptureInSdRam = false;

            Log($"CaptureInSdRam baru: {device.CaptureInSdRam}");
            Log("Calling CapturePhoto() exactly once.");

            device.CapturePhotoNoAf();

            Log($"CapturePhoto() returned; IsBusy={device.IsBusy}");
        }
        catch
        {
            device.IsBusy = false;
            Interlocked.CompareExchange(ref _captureCompletion, null, completion);
            throw;
        }

        try
        {
            var finished = await Task.WhenAny(
                completion.Task,
                Task.Delay(timeout));

            if (finished != completion.Task)
            {
                // Recovery: an un-transferred image wedges the body in PC mode.
                device.IsBusy = false;
                throw new TimeoutException(
                    $"Capture timed out after {timeout}. " +
                    "No transferred image was received. " +
                    "Check the [camera] log: if 'CaptureCompleted fired' " +
                    "appears but 'PhotoCaptured event received' does not, " +
                    "the transfer event never arrived.");
            }

            return await completion.Task;
        }
        finally
        {
            Interlocked.CompareExchange(ref _captureCompletion, null, completion);
        }
    }

    // ------------------------------------------------------------
    // Disposal
    // ------------------------------------------------------------

    public void Dispose()
    {
        if (_disposed)
            return;

        _disposed = true;

        StopLiveView();

        _manager.PhotoCaptured -= OnPhotoCaptured;

        try
        {
            _manager.CloseAll();
        }
        catch
        {
            // Best-effort cleanup.
        }
    }
}
