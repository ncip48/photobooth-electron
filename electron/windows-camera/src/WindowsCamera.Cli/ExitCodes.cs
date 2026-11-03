namespace WindowsCamera.Cli;

public static class ExitCodes
{
    public const int Ok             = 0;
    public const int UsageError     = 2;
    public const int NoCamera       = 3;
    public const int NotSelected    = 4;
    public const int CaptureFailed  = 5;
    public const int PropertyFailed = 6;
    public const int Timeout        = 7;
}
