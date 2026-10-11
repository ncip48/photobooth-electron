using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Printing;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Xps;
using System.Xml;

internal sealed class PrintRequest
{
    public string PrinterName { get; set; } = "";
    public string ImagePath { get; set; } = "";
    public int Copies { get; set; } = 1;
    public PageSizeRequest? PageSize { get; set; }
    public Dictionary<string, string> DriverOptions { get; set; } = new();
}

internal sealed class PageSizeRequest
{
    public double WidthMicrons { get; set; }
    public double HeightMicrons { get; set; }
}

internal sealed class PrintResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
}

internal static class Program
{
    private const string PsfNs =
        "http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework";

    private const string PskNs =
        "http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords";

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length >= 2 && args[0] == "--capabilities")
            {
                WriteCapabilities(args[1]);
                return 0;
            }

            string json = args.Length > 0
                ? File.ReadAllText(args[0])
                : Console.In.ReadToEnd();

            var request = JsonSerializer.Deserialize<PrintRequest>(
                json,
                new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? throw new InvalidOperationException("Input JSON kosong.");

            PrintImage(request);

            WriteResponse(new PrintResponse
            {
                Success = true,
                Message = $"Pekerjaan dikirim ke printer {request.PrinterName}."
            });

            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("=== WINDOWS PRINT HELPER ERROR ===");
            Console.Error.WriteLine(ex.ToString());

            WriteResponse(new PrintResponse
            {
                Success = false,
                Error = ex.ToString()
            });

            return 1;
        }
    }

    private static void WriteCapabilities(string printerName)
    {
        using var server = new LocalPrintServer();
        var queue = server.GetPrintQueue(printerName);
        queue.Refresh();

        using var stream = queue.GetPrintCapabilitiesAsXml();
        stream.Position = 0;

        using var reader = new StreamReader(stream);
        Console.Out.WriteLine(reader.ReadToEnd());
    }

    private static XmlDocument LoadCapabilities(PrintQueue queue)
    {
        var document = new XmlDocument();
        using var stream = queue.GetPrintCapabilitiesAsXml();
        stream.Position = 0;
        document.Load(stream);
        return document;
    }

    private static XmlNamespaceManager CreateNamespaceManager(XmlDocument document)
    {
        var ns = new XmlNamespaceManager(document.NameTable);
        ns.AddNamespace("psf", PsfNs);
        ns.AddNamespace("psk", PskNs);
        return ns;
    }

    private static void CopyNamespaceDeclarations(
        XmlElement sourceRoot,
        XmlElement destinationRoot)
    {
        foreach (XmlAttribute attribute in sourceRoot.Attributes)
        {
            if (attribute.Prefix != "xmlns" && attribute.Name != "xmlns")
                continue;

            if (!destinationRoot.HasAttribute(attribute.Name))
                destinationRoot.SetAttribute(attribute.Name, attribute.Value);
        }
    }

    private static string LocalQName(string value)
    {
        int colon = value.IndexOf(':');
        return colon >= 0 ? value[(colon + 1)..] : value;
    }

    private static bool TryReadNumericScoredProperty(
        XmlElement option,
        string[] acceptedNames,
        out double value)
    {
        foreach (XmlNode node in option.SelectNodes(".//*[local-name()='ScoredProperty']")!)
        {
            if (node is not XmlElement property)
                continue;

            string name = LocalQName(property.GetAttribute("name"));
            if (!acceptedNames.Contains(name, StringComparer.OrdinalIgnoreCase))
                continue;

            var valueNode = property.SelectSingleNode(".//*[local-name()='Value']");
            if (valueNode != null &&
                double.TryParse(
                    valueNode.InnerText,
                    NumberStyles.Any,
                    CultureInfo.InvariantCulture,
                    out value))
            {
                return true;
            }
        }

        value = 0;
        return false;
    }

    private static PrintTicket ApplyPageMediaSizeOption(
        PrintQueue queue,
        PrintTicket ticket,
        double widthMicrons,
        double heightMicrons)
    {
        var capabilities = LoadCapabilities(queue);
        var capabilityRoot = capabilities.DocumentElement
            ?? throw new InvalidOperationException("XML capability printer kosong.");

        var capabilityNs = CreateNamespaceManager(capabilities);
        var mediaFeature = capabilityRoot.SelectSingleNode(
            ".//psf:Feature[@name='psk:PageMediaSize']",
            capabilityNs)
            ?? throw new InvalidOperationException(
                "Driver tidak menyediakan feature psk:PageMediaSize.");

        XmlElement? matchedOption = null;
        double bestDifference = double.MaxValue;

        foreach (XmlNode node in mediaFeature.ChildNodes)
        {
            if (node is not XmlElement option || option.LocalName != "Option")
                continue;

            bool hasWidth = TryReadNumericScoredProperty(
                option,
                new[] { "MediaSizeWidth", "ExtentWidth", "PageMediaSizeWidth" },
                out double optionWidth);

            bool hasHeight = TryReadNumericScoredProperty(
                option,
                new[] { "MediaSizeHeight", "ExtentHeight", "PageMediaSizeHeight" },
                out double optionHeight);

            if (!hasWidth || !hasHeight)
                continue;

            double direct =
                Math.Abs(optionWidth - widthMicrons) +
                Math.Abs(optionHeight - heightMicrons);

            double rotated =
                Math.Abs(optionWidth - heightMicrons) +
                Math.Abs(optionHeight - widthMicrons);

            double difference = Math.Min(direct, rotated);

            if (difference < bestDifference)
            {
                bestDifference = difference;
                matchedOption = option;
            }
        }

        // Allow up to 1 mm per dimension (2,000 microns combined).
        if (matchedOption == null || bestDifference > 2000)
        {
            throw new InvalidOperationException(
                $"Ukuran {widthMicrons} x {heightMicrons} mikron tidak ditemukan " +
                "di opsi PageMediaSize driver. Tidak mencetak untuk mencegah salah kertas.");
        }

        var ticketXml = new XmlDocument();
        using (var stream = ticket.GetXmlStream())
        {
            stream.Position = 0;
            ticketXml.Load(stream);
        }

        var ticketRoot = ticketXml.DocumentElement
            ?? throw new InvalidOperationException("XML PrintTicket kosong.");

        CopyNamespaceDeclarations(capabilityRoot, ticketRoot);

        var ticketNs = CreateNamespaceManager(ticketXml);
        var existing = ticketRoot.SelectSingleNode(
            "./psf:Feature[@name='psk:PageMediaSize']",
            ticketNs);

        if (existing != null)
            ticketRoot.RemoveChild(existing);

        var feature = ticketXml.CreateElement("psf", "Feature", PsfNs);
        feature.SetAttribute("name", "psk:PageMediaSize");

        // Salin seluruh Option beserta ScoredProperty ukuran media,
        // bukan hanya atribut name.
        var selectedOption = ticketXml.CreateElement(
    "psf",
    "Option",
    PsfNs
);

        selectedOption.SetAttribute(
            "name",
            matchedOption.GetAttribute("name")
        );

        feature.AppendChild(selectedOption);
        ticketRoot.AppendChild(feature);

        using var output = new MemoryStream();
        ticketXml.Save(output);
        output.Position = 0;

        Console.Error.WriteLine(
            $"Selected media option: {matchedOption.GetAttribute("name")}");

        // IMPORTANT: Do not set ticket.PageMediaSize after this call.
        // Doing so may replace the named driver media option with a custom size.
        return new PrintTicket(output);
    }

    private static PrintTicket ApplyDriverOptions(
        PrintQueue queue,
        PrintTicket ticket,
        Dictionary<string, string> driverOptions)
    {
        if (driverOptions.Count == 0)
            return ticket;

        var featureMap = new Dictionary<string, string>(
            StringComparer.OrdinalIgnoreCase)
        {
            ["EPIJ_Medi"] = "psk:PageMediaType",
            ["EPIJ_Qual"] = "psk:PageOutputQuality",
            ["EPIJ_Bdls"] = "psk:PageBorderless"
        };

        var capabilities = LoadCapabilities(queue);
        var capabilityRoot = capabilities.DocumentElement
            ?? throw new InvalidOperationException("XML capability printer kosong.");

        var capabilityNs = CreateNamespaceManager(capabilities);

        var ticketXml = new XmlDocument();
        using (var stream = ticket.GetXmlStream())
        {
            stream.Position = 0;
            ticketXml.Load(stream);
        }

        var ticketRoot = ticketXml.DocumentElement
            ?? throw new InvalidOperationException("XML PrintTicket kosong.");

        CopyNamespaceDeclarations(capabilityRoot, ticketRoot);

        foreach (var (optionId, selectedValue) in driverOptions)
        {
            if (string.IsNullOrWhiteSpace(selectedValue))
                continue;

            if (!featureMap.TryGetValue(optionId, out string? featureName))
            {
                throw new InvalidOperationException(
                    $"Driver option '{optionId}' belum didukung oleh helper Windows.");
            }

            var capabilityFeature = capabilityRoot.SelectSingleNode(
                $".//psf:Feature[@name='{featureName}']",
                capabilityNs);

            if (capabilityFeature == null)
            {
                throw new InvalidOperationException(
                    $"Feature '{featureName}' tidak ditemukan pada driver printer.");
            }

            string selectedLocalName = LocalQName(selectedValue);
            XmlElement? matchedOption = null;

            foreach (XmlNode node in capabilityFeature.ChildNodes)
            {
                if (node is not XmlElement element || element.LocalName != "Option")
                    continue;

                if (string.Equals(
                    LocalQName(element.GetAttribute("name")),
                    selectedLocalName,
                    StringComparison.OrdinalIgnoreCase))
                {
                    matchedOption = element;
                    break;
                }
            }

            if (matchedOption == null)
            {
                throw new InvalidOperationException(
                    $"Pilihan '{selectedValue}' tidak tersedia untuk '{featureName}'.");
            }

            var ticketNs = CreateNamespaceManager(ticketXml);
            var existingFeature = ticketRoot.SelectSingleNode(
                $"./psf:Feature[@name='{featureName}']",
                ticketNs);

            if (existingFeature != null)
                ticketRoot.RemoveChild(existingFeature);

            var feature = ticketXml.CreateElement("psf", "Feature", PsfNs);
            feature.SetAttribute("name", featureName);

            var option = ticketXml.CreateElement("psf", "Option", PsfNs);
            option.SetAttribute("name", matchedOption.GetAttribute("name"));

            feature.AppendChild(option);
            ticketRoot.AppendChild(feature);
        }

        using var output = new MemoryStream();
        ticketXml.Save(output);
        output.Position = 0;
        return new PrintTicket(output);
    }

    private static void PrintImage(PrintRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PrinterName))
            throw new ArgumentException("Nama printer wajib diisi.");

        if (!File.Exists(request.ImagePath))
            throw new FileNotFoundException("File gambar tidak ditemukan.", request.ImagePath);

        using var server = new LocalPrintServer();
        var queue = server.GetPrintQueue(request.PrinterName);
        queue.Refresh();

        if (queue.QueueStatus.HasFlag(PrintQueueStatus.Offline))
            throw new InvalidOperationException("Printer sedang offline.");

        var ticket = queue.DefaultPrintTicket ?? new PrintTicket();
        ticket.CopyCount = Math.Clamp(request.Copies, 1, 999);
        ticket.PageOrientation = PageOrientation.Portrait;

        double pageWidth;
        double pageHeight;

        if (request.PageSize != null)
        {
            double widthMicrons = request.PageSize.WidthMicrons;
            double heightMicrons = request.PageSize.HeightMicrons;

            if (widthMicrons <= 0 || heightMicrons <= 0)
                throw new ArgumentException("Dimensi kertas tidak valid.");

            // Use the dimensions for the XPS document, but select the driver's
            // named media option in the PrintTicket. Do NOT set PageMediaSize
            // afterward because that can override the named option.
            pageWidth = widthMicrons * 96d / 25400d;
            pageHeight = heightMicrons * 96d / 25400d;

            ticket = ApplyPageMediaSizeOption(
    queue, ticket, widthMicrons, heightMicrons);

            Console.Error.WriteLine("DEBUG: PageMediaSize option applied.");
        }
        else
        {
            pageWidth = ticket.PageMediaSize?.Width ?? 793.7008;
            pageHeight = ticket.PageMediaSize?.Height ?? 1122.5197;
        }

        ticket = ApplyDriverOptions(
            queue, ticket, request.DriverOptions);

        Console.Error.WriteLine("DEBUG: Driver options applied.");

        BitmapImage bitmap;
        using (var imageStream = File.OpenRead(request.ImagePath))
        {
            bitmap = new BitmapImage();
            bitmap.BeginInit();
            bitmap.CacheOption = BitmapCacheOption.OnLoad;
            bitmap.StreamSource = imageStream;
            bitmap.EndInit();
            bitmap.Freeze();
        }

        var image = new System.Windows.Controls.Image
        {
            Source = bitmap,
            Width = pageWidth,
            Height = pageHeight,
            Stretch = Stretch.Uniform
        };

        var page = new FixedPage
        {
            Width = pageWidth,
            Height = pageHeight
        };
        page.Children.Add(image);

        var pageContent = new PageContent();
        ((IAddChild)pageContent).AddChild(page);

        var document = new FixedDocument();
        document.DocumentPaginator.PageSize = new Size(pageWidth, pageHeight);
        document.Pages.Add(pageContent);

        var validation = queue.MergeAndValidatePrintTicket(
            queue.DefaultPrintTicket ?? new PrintTicket(),
            ticket);

        var validatedTicket = validation.ValidatedPrintTicket
            ?? throw new InvalidOperationException(
                "Driver tidak menghasilkan PrintTicket yang valid.");

        double validatedWidth = validatedTicket.PageMediaSize?.Width ?? 0;
        double validatedHeight = validatedTicket.PageMediaSize?.Height ?? 0;

        Console.Error.WriteLine(
            $"Requested page: {pageWidth} x {pageHeight} DIP");
        Console.Error.WriteLine(
            $"Validated page: {validatedWidth} x {validatedHeight} DIP");
        Console.Error.WriteLine(
            $"Document page: {document.DocumentPaginator.PageSize.Width} x " +
            $"{document.DocumentPaginator.PageSize.Height} DIP");

        if (request.PageSize != null)
        {
            bool directMatch =
                Math.Abs(validatedWidth - pageWidth) <= 2 &&
                Math.Abs(validatedHeight - pageHeight) <= 2;

            bool rotatedMatch =
                Math.Abs(validatedWidth - pageHeight) <= 2 &&
                Math.Abs(validatedHeight - pageWidth) <= 2;

            if (!directMatch && !rotatedMatch)
            {
                throw new InvalidOperationException(
                    $"Driver memvalidasi ukuran menjadi {validatedWidth:F1} x " +
                    $"{validatedHeight:F1} DIP, sedangkan ukuran yang diminta " +
                    $"adalah {pageWidth:F1} x {pageHeight:F1} DIP. " +
                    "Pencetakan dibatalkan agar tidak salah ukuran kertas.");
            }
        }

        var writer = PrintQueue.CreateXpsDocumentWriter(queue);
        writer.Write(document, validatedTicket);
        queue.Commit();
    }

    private static void WriteResponse(PrintResponse response)
    {
        Console.Out.WriteLine(JsonSerializer.Serialize(response));
    }
}
