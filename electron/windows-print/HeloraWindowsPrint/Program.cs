using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Printing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using SP = System.Printing;
using SPI = System.Printing.Interop;

namespace HeloraWindowsPrint;

// ---------------------------------------------------------------------------
// Request / response contracts (match the JSON written by the Electron app)
// ---------------------------------------------------------------------------

internal sealed class PageSizeRequest
{
    public double WidthMicrons { get; set; }
    public double HeightMicrons { get; set; }
}

internal sealed class PrintRequest
{
    public string? PrinterName { get; set; }
    public string? ImagePath { get; set; }
    public int Copies { get; set; } = 1;
    public Dictionary<string, string>? DriverOptions { get; set; }
    public PageSizeRequest? PageSize { get; set; }
}

internal sealed class HelperResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

internal static class Program
{
    private static readonly JsonSerializerOptions ReadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    // DEVMODE constants (only used by the fallback path)
    private const int DM_PRINTQUALITY = 0x00000400;
    private const int DM_MEDIATYPE = 0x00800000;
    private const uint GMEM_MOVEABLE = 0x0002;

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length < 1 || string.IsNullOrWhiteSpace(args[0]))
            {
                throw new ArgumentException("Path request.json belum diberikan.");
            }

            if (!File.Exists(args[0]))
            {
                throw new FileNotFoundException("File request tidak ditemukan: " + args[0]);
            }

            string json = File.ReadAllText(args[0], Encoding.UTF8);
            PrintRequest request = JsonSerializer.Deserialize<PrintRequest>(json, ReadOptions)
                ?? throw new InvalidOperationException("Isi request.json tidak valid.");

            string message = PrintImage(request);

            WriteResponse(new HelperResponse { Success = true, Message = message });
        }
        catch (Exception ex)
        {
            WriteResponse(new HelperResponse { Success = false, Error = ex.Message });
        }

        // Always exit 0: Node's execFile rejects on a non-zero exit code and the
        // JSON error on stdout would be lost. Success/failure is in the JSON.
        return 0;
    }

    private static void WriteResponse(HelperResponse response)
    {
        string json = JsonSerializer.Serialize(response, WriteOptions);
        byte[] bytes = new UTF8Encoding(false).GetBytes(json + Environment.NewLine);

        using Stream stdout = Console.OpenStandardOutput();
        stdout.Write(bytes, 0, bytes.Length);
        stdout.Flush();
    }

    // -----------------------------------------------------------------------
    // Printing
    // -----------------------------------------------------------------------

    private static string PrintImage(PrintRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PrinterName))
        {
            throw new InvalidOperationException("Printer belum dipilih.");
        }

        if (string.IsNullOrWhiteSpace(request.ImagePath) || !File.Exists(request.ImagePath))
        {
            throw new FileNotFoundException("File gambar tidak ditemukan: " + request.ImagePath);
        }

        string printerName = request.PrinterName!;

        // Read the driver options sent by the Electron app
        string? mediaOption = GetOption(request.DriverOptions, "EPIJ_Medi");
        string? qualityOption = GetOption(request.DriverOptions, "EPIJ_Qual");
        string? borderOption = GetOption(request.DriverOptions, "EPIJ_Bdls");

        bool borderless = borderOption != null &&
            borderOption.IndexOf("Borderless", StringComparison.OrdinalIgnoreCase) >= 0;

        int copies = Math.Max(1, request.Copies);

        bool hasPageSize = request.PageSize != null &&
            request.PageSize.WidthMicrons > 0 &&
            request.PageSize.HeightMicrons > 0;

        int widthHundredths = 0;
        int heightHundredths = 0;
        if (hasPageSize)
        {
            // microns -> hundredths of an inch (1 inch = 25400 microns)
            widthHundredths = (int)Math.Round(request.PageSize!.WidthMicrons / 254.0);
            heightHundredths = (int)Math.Round(request.PageSize.HeightMicrons / 254.0);
        }

        using Bitmap bitmap = LoadBitmap(request.ImagePath!);
        using PrintDocument document = new PrintDocument();

        document.PrinterSettings.PrinterName = printerName;
        if (!document.PrinterSettings.IsValid)
        {
            throw new InvalidOperationException(
                "Printer '" + printerName + "' tidak ditemukan atau tidak valid.");
        }

        document.DocumentName = "Photobooth Print";
        document.PrintController = new StandardPrintController(); // silent, no progress dialog
        document.OriginAtMargins = false;

        PageSettings page = document.DefaultPageSettings;
        List<string> notes = new List<string>();

        // 1) Apply media type / quality / borderless / page size through the driver's PrintTicket.
        //    This is the only route that reaches the Epson driver's private settings.
        bool ticketApplied = false;
        try
        {
            ApplyPrintTicket(
                document.PrinterSettings,
                page,
                printerName,
                mediaOption,
                qualityOption,
                borderOption,
                hasPageSize ? request.PageSize : null,
                notes);
            ticketApplied = true;
        }
        catch (Exception ex)
        {
            notes.Add("PrintTicket gagal (" + ex.Message + "), memakai pengaturan dasar");
        }

        page.Margins = new Margins(0, 0, 0, 0);
        page.Color = true;

        // 2) Make sure the paper size really is the requested one.
        if (hasPageSize)
        {
            bool paperOk = ticketApplied && PaperMatches(page.PaperSize, widthHundredths, heightHundredths);
            if (!paperOk)
            {
                page.PaperSize = ResolvePaper(
                    document.PrinterSettings, widthHundredths, heightHundredths, borderless);
            }
        }

        // 3) Fallback: standard DEVMODE fields if the PrintTicket route was not available.
        if (!ticketApplied)
        {
            try
            {
                ApplyDevMode(document.PrinterSettings, page, mediaOption, qualityOption);
            }
            catch
            {
                // Never fail the print job because of optional driver tuning.
            }
        }

        // 4) Copies
        try
        {
            int max = document.PrinterSettings.MaximumCopies;
            int safeCopies = Math.Min(copies, max > 0 ? max : copies);
            document.PrinterSettings.Copies = (short)Math.Min(safeCopies, short.MaxValue);
            document.PrinterSettings.Collate = false;
        }
        catch
        {
            // Fall back to driver default (1 copy).
        }

        Exception? renderError = null;

        document.PrintPage += (sender, e) =>
        {
            try
            {
                RenderPage(e, bitmap, borderless);
            }
            catch (Exception ex)
            {
                renderError = ex;
                e.Cancel = true;
            }

            e.HasMorePages = false;
        };

        document.Print();

        if (renderError != null)
        {
            throw new InvalidOperationException(
                "Gagal merender gambar: " + renderError.Message, renderError);
        }

        string message = "Pekerjaan dikirim ke " + printerName + " (" + copies + " salinan)";
        if (notes.Count > 0)
        {
            message += " [" + string.Join("; ", notes) + "]";
        }

        return message + ".";
    }

    private static void RenderPage(PrintPageEventArgs e, Bitmap source, bool borderless)
    {
        Graphics g = e.Graphics ?? throw new InvalidOperationException("Graphics printer tidak tersedia.");

        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.SmoothingMode = SmoothingMode.HighQuality;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;

        Rectangle pageBounds = e.PageBounds; // physical page, hundredths of an inch
        bool pageLandscape = pageBounds.Width > pageBounds.Height;
        bool imageLandscape = source.Width > source.Height;

        Bitmap work = source;
        bool disposeWork = false;

        try
        {
            if (pageLandscape != imageLandscape)
            {
                work = (Bitmap)source.Clone();
                work.RotateFlip(RotateFlipType.Rotate90FlipNone);
                disposeWork = true;
            }

            float imgW = work.Width;
            float imgH = work.Height;

            if (borderless)
            {
                // Fill the whole sheet with a small bleed so no white edge remains.
                const int bleed = 3; // 0.03 inch
                RectangleF area = new RectangleF(
                    pageBounds.X - bleed,
                    pageBounds.Y - bleed,
                    pageBounds.Width + bleed * 2,
                    pageBounds.Height + bleed * 2);

                float scale = Math.Max(area.Width / imgW, area.Height / imgH);
                float srcW = area.Width / scale;
                float srcH = area.Height / scale;
                RectangleF srcRect = new RectangleF((imgW - srcW) / 2f, (imgH - srcH) / 2f, srcW, srcH);

                g.DrawImage(work, area, srcRect, GraphicsUnit.Pixel);
            }
            else
            {
                // Fit the whole image inside the printable area, centered.
                RectangleF area = e.PageSettings.PrintableArea;
                if (area.Width <= 0 || area.Height <= 0)
                {
                    area = new RectangleF(pageBounds.X, pageBounds.Y, pageBounds.Width, pageBounds.Height);
                }

                float scale = Math.Min(area.Width / imgW, area.Height / imgH);
                float drawW = imgW * scale;
                float drawH = imgH * scale;
                RectangleF dest = new RectangleF(
                    area.X + (area.Width - drawW) / 2f,
                    area.Y + (area.Height - drawH) / 2f,
                    drawW,
                    drawH);

                g.DrawImage(work, dest, new RectangleF(0, 0, imgW, imgH), GraphicsUnit.Pixel);
            }
        }
        finally
        {
            if (disposeWork)
            {
                work.Dispose();
            }
        }
    }

    // -----------------------------------------------------------------------
    // PrintTicket route (full driver fidelity)
    // -----------------------------------------------------------------------

    private static void ApplyPrintTicket(
        PrinterSettings settings,
        PageSettings page,
        string printerName,
        string? media,
        string? quality,
        string? border,
        PageSizeRequest? size,
        List<string> notes)
    {
        using SP.LocalPrintServer server = new SP.LocalPrintServer();
        using SP.PrintQueue queue = new SP.PrintQueue(server, printerName, SP.PrintSystemDesiredAccess.UsePrinter);

        SP.PrintTicket baseTicket = queue.UserPrintTicket ?? queue.DefaultPrintTicket;
        SP.PrintCapabilities caps = queue.GetPrintCapabilities();
        SP.PrintTicket delta = new SP.PrintTicket();

        // --- Media type (EPIJ_Medi) ---
        if (!string.IsNullOrWhiteSpace(media))
        {
            List<SP.PageMediaType> candidates = MapMedia(media!);
            SP.PageMediaType? chosen = null;

            foreach (SP.PageMediaType candidate in candidates)
            {
                if (caps.PageMediaTypeCapability == null ||
                    caps.PageMediaTypeCapability.Count == 0 ||
                    caps.PageMediaTypeCapability.Contains(candidate))
                {
                    chosen = candidate;
                    break;
                }
            }

            if (chosen.HasValue)
            {
                delta.PageMediaType = chosen.Value;
            }
            else
            {
                notes.Add("media '" + media + "' tidak dikenali/didukung driver");
            }
        }

        // --- Quality (EPIJ_Qual) ---
        if (!string.IsNullOrWhiteSpace(quality))
        {
            List<SP.OutputQuality> candidates = MapQuality(quality!);
            SP.OutputQuality? chosen = null;

            foreach (SP.OutputQuality candidate in candidates)
            {
                if (caps.OutputQualityCapability == null ||
                    caps.OutputQualityCapability.Count == 0 ||
                    caps.OutputQualityCapability.Contains(candidate))
                {
                    chosen = candidate;
                    break;
                }
            }

            if (chosen.HasValue)
            {
                delta.OutputQuality = chosen.Value;
            }
            else
            {
                notes.Add("kualitas '" + quality + "' tidak dikenali/didukung driver");
            }
        }

        // --- Borderless (EPIJ_Bdls) ---
        if (!string.IsNullOrWhiteSpace(border))
        {
            bool wantBorderless = border!.IndexOf("Borderless", StringComparison.OrdinalIgnoreCase) >= 0;
            SP.PageBorderless wanted = wantBorderless ? SP.PageBorderless.Borderless : SP.PageBorderless.None;

            if (caps.PageBorderlessCapability == null ||
                caps.PageBorderlessCapability.Count == 0 ||
                caps.PageBorderlessCapability.Contains(wanted))
            {
                delta.PageBorderless = wanted;
            }
            else
            {
                notes.Add("borderless tidak didukung driver");
            }
        }

        // --- Page size (PageSize in microns -> 1/96 inch units) ---
        if (size != null)
        {
            double w96 = size.WidthMicrons / 25400.0 * 96.0;
            double h96 = size.HeightMicrons / 25400.0 * 96.0;

            SP.PageMediaSize? bestSize = null;
            double bestDistance = double.MaxValue;

            if (caps.PageMediaSizeCapability != null)
            {
                foreach (SP.PageMediaSize candidate in caps.PageMediaSizeCapability)
                {
                    if (!candidate.Width.HasValue || !candidate.Height.HasValue)
                    {
                        continue;
                    }

                    double dw = Math.Abs(candidate.Width.Value - w96);
                    double dh = Math.Abs(candidate.Height.Value - h96);
                    if (dw <= 6 && dh <= 6 && dw + dh < bestDistance)
                    {
                        bestDistance = dw + dh;
                        bestSize = candidate;
                    }
                }
            }

            delta.PageMediaSize = bestSize ?? new SP.PageMediaSize(w96, h96);
        }

        // Merge our changes onto the user's defaults and let the driver validate them.
        SP.PrintTicket validated = queue.MergeAndValidatePrintTicket(baseTicket, delta).ValidatedPrintTicket;

        notes.Add("media=" + validated.PageMediaType +
                  ", kualitas=" + validated.OutputQuality +
                  ", border=" + validated.PageBorderless);

        // PrintTicket -> DEVMODE (includes the Epson private driver data)
        using SPI.PrintTicketConverter converter =
            new SPI.PrintTicketConverter(printerName, SPI.PrintTicketConverter.MaxPrintSchemaVersion);
        byte[] devMode = converter.ConvertPrintTicketToDevMode(validated, SPI.BaseDevModeType.UserDefault);

        LoadDevMode(settings, page, devMode);
    }

    private static void LoadDevMode(PrinterSettings settings, PageSettings page, byte[] devMode)
    {
        if (devMode == null || devMode.Length == 0)
        {
            throw new InvalidOperationException("DEVMODE kosong.");
        }

        IntPtr handle = GlobalAlloc(GMEM_MOVEABLE, new UIntPtr((uint)devMode.Length));
        if (handle == IntPtr.Zero)
        {
            throw new OutOfMemoryException("Gagal mengalokasikan memori DEVMODE.");
        }

        try
        {
            IntPtr ptr = GlobalLock(handle);
            if (ptr == IntPtr.Zero)
            {
                throw new InvalidOperationException("Gagal mengunci memori DEVMODE.");
            }

            try
            {
                Marshal.Copy(devMode, 0, ptr, devMode.Length);
            }
            finally
            {
                GlobalUnlock(handle);
            }

            settings.SetHdevmode(handle);
            page.SetHdevmode(handle);
        }
        finally
        {
            GlobalFree(handle);
        }
    }

    private static List<SP.PageMediaType> MapMedia(string value)
    {
        string v = value.ToLowerInvariant();
        List<SP.PageMediaType> list = new List<SP.PageMediaType>();

        if (v.Contains("plain"))
        {
            list.Add(SP.PageMediaType.Plain);
        }
        else if (v.Contains("ultra"))
        {
            list.Add(SP.PageMediaType.PhotographicHighGloss);
            list.Add(SP.PageMediaType.PhotographicGlossy);
            list.Add(SP.PageMediaType.Photographic);
        }
        else if (v.Contains("semi") || v.Contains("luster") || v.Contains("lustre"))
        {
            list.Add(SP.PageMediaType.PhotographicSemiGloss);
            list.Add(SP.PageMediaType.PhotographicSatin);
            list.Add(SP.PageMediaType.Photographic);
        }
        else if (v.Contains("satin"))
        {
            list.Add(SP.PageMediaType.PhotographicSatin);
            list.Add(SP.PageMediaType.Photographic);
        }
        else if (v.Contains("matte"))
        {
            list.Add(SP.PageMediaType.PhotographicMatte);
            list.Add(SP.PageMediaType.Photographic);
        }
        else if (v.Contains("gloss"))
        {
            list.Add(SP.PageMediaType.PhotographicGlossy);
            list.Add(SP.PageMediaType.PhotographicHighGloss);
            list.Add(SP.PageMediaType.Photographic);
        }
        else if (v.Contains("photo"))
        {
            list.Add(SP.PageMediaType.Photographic);
            list.Add(SP.PageMediaType.PhotographicGlossy);
        }

        return list;
    }

    private static List<SP.OutputQuality> MapQuality(string value)
    {
        string v = value.ToLowerInvariant();
        List<SP.OutputQuality> list = new List<SP.OutputQuality>();

        if (v.Contains("draft"))
        {
            list.Add(SP.OutputQuality.Draft);
            list.Add(SP.OutputQuality.Normal);
        }
        else if (v.Contains("standard") || v.Contains("normal"))
        {
            list.Add(SP.OutputQuality.Normal);
            list.Add(SP.OutputQuality.Automatic);
        }
        else if (v.Contains("high") || v.Contains("best"))
        {
            list.Add(SP.OutputQuality.High);
            list.Add(SP.OutputQuality.Photographic);
        }
        else if (v.Contains("photo"))
        {
            list.Add(SP.OutputQuality.Photographic);
            list.Add(SP.OutputQuality.High);
        }

        return list;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static Bitmap LoadBitmap(string path)
    {
        // Load through a stream and copy so the temp file is never locked
        // (Electron deletes the directory right after we exit).
        using FileStream stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using Image image = Image.FromStream(stream, false, true);
        return new Bitmap(image);
    }

    private static string? GetOption(Dictionary<string, string>? options, string key)
    {
        if (options == null)
        {
            return null;
        }

        foreach (KeyValuePair<string, string> pair in options)
        {
            if (string.Equals(pair.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                return pair.Value;
            }
        }

        return null;
    }

    private static bool PaperMatches(PaperSize paper, int width, int height)
    {
        const int tolerance = 6; // ~0.06 inch
        bool direct = Math.Abs(paper.Width - width) <= tolerance &&
                      Math.Abs(paper.Height - height) <= tolerance;
        bool rotated = Math.Abs(paper.Width - height) <= tolerance &&
                       Math.Abs(paper.Height - width) <= tolerance;
        return direct || rotated;
    }

    /// <summary>
    /// Picks a driver paper size matching the requested dimensions (hundredths of an inch).
    /// Prefers a "borderless" variant when borderless is requested, otherwise a regular one.
    /// Falls back to a custom size.
    /// </summary>
    private static PaperSize ResolvePaper(PrinterSettings settings, int width, int height, bool borderless)
    {
        PaperSize? best = null;
        int bestScore = int.MaxValue;

        foreach (PaperSize paper in settings.PaperSizes)
        {
            if (!PaperMatches(paper, width, height))
            {
                continue;
            }

            bool direct = Math.Abs(paper.Width - width) <= 6 && Math.Abs(paper.Height - height) <= 6;

            bool nameBorderless =
                paper.PaperName.IndexOf("borderless", StringComparison.OrdinalIgnoreCase) >= 0 ||
                paper.PaperName.IndexOf("tanpa batas", StringComparison.OrdinalIgnoreCase) >= 0;

            int score = 0;
            if (borderless != nameBorderless)
            {
                score += 1;
            }

            if (!direct)
            {
                score += 2;
            }

            if (score < bestScore)
            {
                best = paper;
                bestScore = score;
            }
        }

        return best ?? new PaperSize("Custom", width, height);
    }

    /// <summary>
    /// Fallback: writes media type / print quality into the standard DEVMODE fields.
    /// </summary>
    private static void ApplyDevMode(PrinterSettings settings, PageSettings page, string? media, string? quality)
    {
        int? mediaValue = null;
        short? qualityValue = null;

        if (!string.IsNullOrWhiteSpace(media))
        {
            string m = media!.ToLowerInvariant();
            if (m.Contains("plain"))
            {
                mediaValue = 1; // DMMEDIA_STANDARD
            }
            else if (m.Contains("gloss"))
            {
                mediaValue = 3; // DMMEDIA_GLOSSY
            }
        }

        if (!string.IsNullOrWhiteSpace(quality))
        {
            string q = quality!.ToLowerInvariant();
            if (q.Contains("draft"))
            {
                qualityValue = -1; // DMRES_DRAFT
            }
            else if (q.Contains("standard") || q.Contains("normal"))
            {
                qualityValue = -3; // DMRES_MEDIUM
            }
            else if (q.Contains("high") || q.Contains("best") || q.Contains("photo"))
            {
                qualityValue = -4; // DMRES_HIGH
            }
        }

        if (mediaValue == null && qualityValue == null)
        {
            return;
        }

        IntPtr hDevMode = settings.GetHdevmode(page);
        if (hDevMode == IntPtr.Zero)
        {
            return;
        }

        try
        {
            IntPtr ptr = GlobalLock(hDevMode);
            if (ptr == IntPtr.Zero)
            {
                return;
            }

            try
            {
                const int offsetSize = 68;         // dmSize
                const int offsetFields = 72;       // dmFields
                const int offsetPrintQuality = 90; // dmPrintQuality
                const int offsetMediaType = 196;   // dmMediaType

                int size = (ushort)Marshal.ReadInt16(ptr, offsetSize);
                int fields = Marshal.ReadInt32(ptr, offsetFields);

                if (qualityValue.HasValue && size >= offsetPrintQuality + 2)
                {
                    Marshal.WriteInt16(ptr, offsetPrintQuality, qualityValue.Value);
                    fields |= DM_PRINTQUALITY;
                }

                if (mediaValue.HasValue && size >= offsetMediaType + 4)
                {
                    Marshal.WriteInt32(ptr, offsetMediaType, mediaValue.Value);
                    fields |= DM_MEDIATYPE;
                }

                Marshal.WriteInt32(ptr, offsetFields, fields);
            }
            finally
            {
                GlobalUnlock(hDevMode);
            }

            settings.SetHdevmode(hDevMode);
            page.SetHdevmode(hDevMode);
        }
        finally
        {
            GlobalFree(hDevMode);
        }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalUnlock(IntPtr hMem);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GlobalFree(IntPtr hMem);
}