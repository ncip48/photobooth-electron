﻿
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Globalization;
using System.Reflection;
using System.Text;
using CameraControl.Core;
using CameraControl.Core.Classes;
using CameraControl.Devices;
using CameraControl.Devices.Classes;
using Canon.Eos.Framework;

namespace CameraControlCmd;

internal static class Program
{
    private static string? _outputFile;
    private static bool _verbose;
    private static bool _json;

    private static readonly TaskCompletionSource<string> CaptureCompletion =
        new(TaskCreationOptions.RunContinuationsAsynchronously);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            var options = ParseArguments(args);

            _verbose = options.ContainsKey("verbose");
            _json = options.ContainsKey("json");

            ServiceProvider.ConfigureLog();
            Log("WindowsCamera CLI starting...");

            // Initialize the SQLite provider before digiCamControl database.
            SQLitePCL.Batteries_V2.Init();

            InitApplication();

            var device = WaitForCamera(
                TimeSpan.FromSeconds(15));

            if (device == null)
            {
                WriteError("No connected camera found.");
                return 1;
            }

            Log($"Connected: {device.DisplayName}");

            // ---------------------------------------------------------
            // LIST
            // ---------------------------------------------------------

            if (options.ContainsKey("list"))
            {
                var cameras = ServiceProvider.DeviceManager
                    .ConnectedDevices
                    .Select((camera, index) => new
                    {
                        index,
                        model = camera.DeviceName,
                        name = camera.DisplayName,
                        port = camera.PortName,
                        connected = camera.IsConnected
                    });

                WriteResult(cameras);
                return 0;
            }

            // ---------------------------------------------------------
            // STATUS
            // ---------------------------------------------------------

            if (options.ContainsKey("status"))
            {
                WriteResult(new
                {
                    connected = device.IsConnected,
                    model = device.DeviceName,
                    name = device.DisplayName,
                    port = device.PortName,
                    busy = device.IsBusy
                });

                return 0;
            }

            // ---------------------------------------------------------
            // GET CONFIG
            // ---------------------------------------------------------

            if (options.ContainsKey("get-config"))
            {
                WriteResult(GetConfig(device));
                return 0;
            }

            // ---------------------------------------------------------
            // GET SINGLE PROPERTY
            // ---------------------------------------------------------

            if (options.TryGetValue("get", out var getKey))
            {
                var property = GetProperty(device, getKey);

                WriteResult(new
                {
                    name = getKey,
                    value = GetPropertyValue(property),
                    choices = GetPropertyChoices(property)
                });

                return 0;
            }

            // ---------------------------------------------------------
            // SET PROPERTY
            // ---------------------------------------------------------

            if (options.TryGetValue("set", out var setValue))
            {
                var parts = setValue.Split(
                    ' ',
                    2,
                    StringSplitOptions.RemoveEmptyEntries);

                if (parts.Length != 2)
                {
                    WriteError(
                        "Usage: --set <property> <value>");

                    return 1;
                }

                SetConfigValue(device, parts[0], parts[1]);

                // Give EDSDK time to apply the setting.
                Thread.Sleep(300);

                WriteResult(new
                {
                    success = true,
                    property = parts[0],
                    value = GetPropertyValue(
                        GetProperty(device, parts[0]))
                });

                return 0;
            }

            // ---------------------------------------------------------
            // CAPTURE
            // ---------------------------------------------------------

            if (options.ContainsKey("capture"))
            {
                _outputFile = options.TryGetValue(
                    "out",
                    out var output)
                    ? Path.GetFullPath(output)
                    : Path.GetFullPath("capture.jpg");

                var timeoutSeconds = 60;

                if (options.TryGetValue("timeout", out var timeout))
                {
                    if (!int.TryParse(timeout, out timeoutSeconds)
                        || timeoutSeconds <= 0)
                    {
                        WriteError("Invalid --timeout value.");
                        return 1;
                    }
                }

                Log("Starting capture...");
                Log($"Output: {_outputFile}");

                Capture(device);

                var savedFile = WaitForCapture(
                    TimeSpan.FromSeconds(timeoutSeconds));

                WriteResult(new
                {
                    success = true,
                    file = savedFile,
                    size = new System.IO.FileInfo(savedFile).Length
                });

                return 0;
            }

            ShowHelp();
            return 0;
        }
        catch (Exception ex)
        {
            WriteError(ex.ToString());
            return 1;
        }
    }

    // ================================================================
    // ARGUMENT PARSER
    // ================================================================

    private static Dictionary<string, string> ParseArguments(
        string[] args)
    {
        var result = new Dictionary<string, string>(
            StringComparer.OrdinalIgnoreCase);

        var flags = new HashSet<string>(
            StringComparer.OrdinalIgnoreCase)
        {
            "help",
            "verbose",
            "json",
            "list",
            "status",
            "get-config",
            "capture"
        };

        for (var i = 0; i < args.Length; i++)
        {
            var argument = args[i];

            if (!argument.StartsWith("--"))
            {
                throw new ArgumentException(
                    $"Invalid argument: {argument}. Use -- prefix.");
            }

            var key = argument[2..];

            if (string.IsNullOrWhiteSpace(key))
                throw new ArgumentException("Empty argument.");

            if (flags.Contains(key))
            {
                result[key] = "true";
                continue;
            }

            if (i + 1 >= args.Length ||
                args[i + 1].StartsWith("--"))
            {
                throw new ArgumentException(
                    $"Missing value for --{key}");
            }

            // --set takes two values:
            // --set iso 400
            if (key.Equals("set", StringComparison.OrdinalIgnoreCase))
            {
                if (i + 2 >= args.Length ||
                    args[i + 2].StartsWith("--"))
                {
                    throw new ArgumentException(
                        "Usage: --set <property> <value>");
                }

                result[key] = $"{args[++i]} {args[++i]}";
                continue;
            }

            result[key] = args[++i];
        }

        return result;
    }

    // ================================================================
    // APPLICATION INITIALIZATION
    // ================================================================

    private static void InitApplication()
    {
        ServiceProvider.Branding = Branding.LoadBranding();

        ServiceProvider.ConfigureDatabase();

        ServiceProvider.Settings = new Settings();
        ServiceProvider.Settings =
            ServiceProvider.Settings.Load();

        ServiceProvider.Settings.LoadSessionData();

        ServiceProvider.WindowsManager = new WindowsManager();

        ServiceProvider.DeviceManager.DetectWebcams = false;

        ServiceProvider.DeviceManager.CameraConnected +=
            DeviceManagerCameraConnected;

        ServiceProvider.DeviceManager.PhotoCaptured +=
            DeviceManagerPhotoCaptured;

        ServiceProvider.DeviceManager.ConnectToCamera();

        foreach (ICameraDevice camera in
                 ServiceProvider.DeviceManager.ConnectedDevices)
        {
            DeviceManagerCameraConnected(camera);
        }
    }

    private static void DeviceManagerCameraConnected(
        ICameraDevice camera)
    {
        try
        {
            var property =
                ServiceProvider.Settings.CameraProperties.Get(camera);

            camera.DisplayName = property.DeviceName;

            camera.AttachedPhotoSession =
                ServiceProvider.Settings.GetSession(
                    property.PhotoSessionName);

            Log($"Camera initialized: {camera.DisplayName}");
        }
        catch (Exception ex)
        {
            Log($"Camera initialization warning: {ex.Message}");

            if (string.IsNullOrWhiteSpace(camera.DisplayName))
                camera.DisplayName = camera.DeviceName;
        }
    }

    private static ICameraDevice? WaitForCamera(
        TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;

        while (DateTime.UtcNow < deadline)
        {
            var cameras =
                ServiceProvider.DeviceManager.ConnectedDevices;

            if (cameras.Count > 0)
            {
                var selected =
                    ServiceProvider.DeviceManager.SelectedCameraDevice;

                return selected?.IsConnected == true
                    ? selected
                    : cameras[0];
            }

            Thread.Sleep(200);
        }

        return null;
    }

    // ================================================================
    // CAMERA SETTINGS - BASED ON CameraService.cs
    // ================================================================

    private static object GetConfig(ICameraDevice device)
    {
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

                        children = new Dictionary<string, object>
                        {
                            ["aperture"] = Node(
                                "aperture",
                                "Aperture",
                                device.FNumber),

                            ["shutterspeed"] = Node(
                                "shutterspeed",
                                "Shutter Speed",
                                device.ShutterSpeed)
                        }
                    },

                    ["imgsettings"] = new
                    {
                        name = "imgsettings",
                        label = "Image Settings",

                        children = new Dictionary<string, object>
                        {
                            ["iso"] = Node(
                                "iso",
                                "ISO",
                                device.IsoNumber),

                            ["whitebalance"] = Node(
                                "whitebalance",
                                "White Balance",
                                device.WhiteBalance),

                            ["focusmode"] = Node(
                                "focusmode",
                                "Focus Mode",
                                device.FocusMode),

                            ["imagequality"] = Node(
                                "imagequality",
                                "Image Quality",
                                device.CompressionSetting)
                        }
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
        return new
        {
            name,
            label,
            value = GetPropertyValue(property),
            choices = GetPropertyChoices(property),
            @readonly = false,
            type = GetPropertyChoices(property).Length > 0
                ? "menu"
                : "text",
            children = Array.Empty<object>()
        };
    }

    private static object GetProperty(
        ICameraDevice device,
        string key)
    {
        var normalized = NormalizeKey(key);

        return normalized switch
        {
            "iso" or "isonumber" =>
                device.IsoNumber,

            "aperture" or "fnumber" =>
                device.FNumber,

            "shutter" or "shutterspeed" =>
                device.ShutterSpeed,

            "whitebalance" =>
                device.WhiteBalance,

            "focusmode" =>
                device.FocusMode,

            "exposurecompensation" or "ec" =>
                device.ExposureCompensation,

            "mode" or "cameramode" =>
                device.Mode,

            "compression" or "imagequality" =>
                device.CompressionSetting,

            _ => throw new ArgumentException(
                $"Unknown camera property: {key}")
        };
    }

    private static void SetConfigValue(
        ICameraDevice device,
        string key,
        string value)
    {
        var normalized = NormalizeKey(key);

        switch (normalized)
        {
            case "iso":
            case "isonumber":
                device.IsoNumber.SetValue(value);
                break;

            case "aperture":
            case "fnumber":
                device.FNumber.SetValue(value);
                break;

            case "shutter":
            case "shutterspeed":
                device.ShutterSpeed.SetValue(value);
                break;

            case "whitebalance":
                device.WhiteBalance.SetValue(value);
                break;

            case "focusmode":
                device.FocusMode.SetValue(value);
                break;

            case "exposurecompensation":
            case "ec":
                device.ExposureCompensation.SetValue(value);
                break;

            case "mode":
            case "cameramode":
                device.Mode.SetValue(value);
                break;

            case "compression":
            case "imagequality":
                device.CompressionSetting.SetValue(
                    value.Replace('_', ' '));
                break;

            default:
                throw new ArgumentException(
                    $"Unsupported camera property: {key}");
        }
    }

    private static string NormalizeKey(string key)
    {
        return key.Split('/').Last()
            .Replace("-", "")
            .Replace("_", "")
            .Replace(" ", "")
            .ToLowerInvariant();
    }

    private static string GetPropertyValue(object property)
    {
        return property.GetType()
            .GetProperty("Value")
            ?.GetValue(property)
            ?.ToString() ?? "";
    }

    private static string[] GetPropertyChoices(object property)
    {
        var values = property.GetType()
            .GetProperty("Values")
            ?.GetValue(property);

        if (values is not IEnumerable enumerable)
            return Array.Empty<string>();

        return enumerable.Cast<object>()
            .Select(x => x?.ToString() ?? "")
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();
    }

    // ================================================================
    // CAPTURE - OFFICIAL DIGICAMCONTROL PROGRAM.CS LIFECYCLE
    // ================================================================

    private static string WaitForCapture(TimeSpan timeout)
    {
        var dispatcher = System.Windows.Threading.Dispatcher.CurrentDispatcher;
        var frame = new System.Windows.Threading.DispatcherFrame();

        var deadline = DateTime.UtcNow + timeout;

        var timer = new System.Windows.Threading.DispatcherTimer(
            System.Windows.Threading.DispatcherPriority.Background,
            dispatcher)
        {
            Interval = TimeSpan.FromMilliseconds(50)
        };

        timer.Tick += (_, _) =>
        {
            if (CaptureCompletion.Task.IsCompleted ||
                DateTime.UtcNow >= deadline)
            {
                timer.Stop();
                frame.Continue = false;
            }
        };

        timer.Start();

        // Keep processing WPF and camera events while waiting.
        System.Windows.Threading.Dispatcher.PushFrame(frame);

        if (!CaptureCompletion.Task.IsCompleted)
            throw new TimeoutException(
                $"Capture timed out after {timeout.TotalSeconds} seconds.");

        return CaptureCompletion.Task.GetAwaiter().GetResult();
    }

    private static void Capture(ICameraDevice device)
    {
        try
        {
            // Preserve the original digiCamControl sequence.
            device.IsBusy = true;

            device.CaptureInSdRam = true;

            if (!device.GetCapability(CapabilityEnum.CaptureInRam))
                device.CaptureInSdRam = false;

            Log($"CaptureInSdRam: {device.CaptureInSdRam}");

            // Normal capture with autofocus.
            device.CapturePhoto();
        }
        catch (EosException ex)
        {
            device.IsBusy = false;

            throw new InvalidOperationException(
                $"Capture failed: {ex.EosErrorCodeMessage}",
                ex);
        }
        catch
        {
            device.IsBusy = false;
            throw;
        }
    }

    // ================================================================
    // PHOTO TRANSFER - OFFICIAL PHOTO CAPTURED PATTERN
    // ================================================================

    private static void DeviceManagerPhotoCaptured(
        object sender,
        PhotoCapturedEventArgs eventArgs)
    {
        var thread = new Thread(() =>
            PhotoCaptured(eventArgs))
        {
            IsBackground = true,
            Name = "HeloraBooth-PhotoTransfer"
        };

        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }

    private static void PhotoCaptured(
        PhotoCapturedEventArgs eventArgs)
    {
        string? tempFile = null;

        try
        {
            Log("Photo transfer begin.");

            tempFile = Path.GetTempFileName();

            File.Delete(tempFile);

            eventArgs.CameraDevice.TransferFile(
                eventArgs.Handle,
                tempFile);

            if (!File.Exists(tempFile))
                throw new IOException("Transferred file not found.");

            var output = _outputFile ??
                         Path.GetFullPath("capture.jpg");

            var directory = Path.GetDirectoryName(output);

            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            if (File.Exists(output))
                File.Delete(output);

            File.Copy(tempFile, output);

            Log($"Transfer done: {output}");

            CaptureCompletion.TrySetResult(output);
        }
        catch (Exception ex)
        {
            Log($"Photo transfer error: {ex}");

            CaptureCompletion.TrySetException(ex);
        }
        finally
        {
            try
            {
                eventArgs.CameraDevice.IsBusy = false;
            }
            catch (Exception ex)
            {
                Log($"Busy reset error: {ex.Message}");
            }

            if (tempFile != null && File.Exists(tempFile))
            {
                try
                {
                    File.Delete(tempFile);
                }
                catch
                {
                    // Best-effort cleanup.
                }
            }
        }
    }

    // ================================================================
    // OUTPUT
    // ================================================================

    private static void WriteResult(object result)
    {
        var json = JsonSerializer.Serialize(
            result,
            JsonOptions);

        Console.WriteLine(json);
    }

    private static void WriteError(string message)
    {
        if (_json)
        {
            WriteResult(new
            {
                success = false,
                error = message
            });
        }
        else
        {
            Console.Error.WriteLine(message);
        }
    }

    private static void Log(string message)
    {
        if (_verbose)
            Console.Error.WriteLine($"[camera] {message}");
    }

    private static void ShowHelp()
    {
        Console.WriteLine("""
        WindowsCamera CLI

        Camera:
          --list
          --status
          --get-config
          --get <property>
          --set <property> <value>

        Capture:
          --capture
          --out <filename>
          --timeout <seconds>

        Options:
          --json
          --verbose
          --help

        Examples:
          WindowsCamera.exe --list --json
          WindowsCamera.exe --get-config --json
          WindowsCamera.exe --get iso
          WindowsCamera.exe --set iso 400
          WindowsCamera.exe --set aperture 8
          WindowsCamera.exe --set shutter 1/125
          WindowsCamera.exe --capture --out .\test.jpg --timeout 60 --json --verbose
        """);
    }
}
