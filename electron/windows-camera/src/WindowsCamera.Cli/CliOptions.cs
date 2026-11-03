namespace WindowsCamera.Cli;

public sealed class CliOptions
{
    public bool List     { get; private set; }
    public bool Status   { get; private set; }
    public bool Capture  { get; private set; }
    public bool LiveView { get; private set; }

    public string? Out        { get; private set; }
    public int Index          { get; private set; }
    public bool Json          { get; private set; }
    public bool Verbose       { get; private set; }
    public int TimeoutSeconds { get; private set; } = 120;

    public List<(string Key, string Value)> Sets { get; } = new();

    public static CliOptions Parse(string[] args)
    {
        var o = new CliOptions();
        for (var i = 0; i < args.Length; i++)
        {
            var a = args[i];
            string Next(string flag) =>
                i + 1 < args.Length ? args[++i]
                : throw new ArgumentException($"--{flag} requires a value.");

            switch (a)
            {
                case "--list":     o.List = true; break;
                case "--status":   o.Status = true; break;
                case "--capture":  o.Capture = true; break;
                case "--liveview": o.LiveView = true; break;
                case "--json":     o.Json = true; break;
                case "--verbose":  o.Verbose = true; break;
                case "--out":      o.Out = Next("out"); break;
                case "--index":    o.Index = int.Parse(Next("index")); break;
                case "--timeout":  o.TimeoutSeconds = int.Parse(Next("timeout")); break;
                case "--set":
                {
                    var pair = Next("set");
                    var split = pair.IndexOf('=');
                    if (split <= 0) throw new ArgumentException($"--set expects key=value, got \"{pair}\".");
                    o.Sets.Add((pair[..split], pair[(split + 1)..]));
                    break;
                }
                case "-h" or "--help": throw new HelpRequested();
                default:
                    throw new ArgumentException($"Unknown argument \"{a}\".");
            }
        }
        return o;
    }
}

public sealed class HelpRequested : Exception { }
