using System.ComponentModel;
using System.Diagnostics;
using Advent.Application;
using Microsoft.Extensions.Configuration;

namespace Advent.Infrastructure;

/// <summary>
/// Convertit en JPEG les images que les navigateurs n'affichent pas : HEIC/HEIF (iPhone) via <c>heif-convert</c> (libheif-examples),
/// BMP/TIFF — et HEIC en secours — via ffmpeg. Réglages optionnels : <c>Media:HeifConvertPath</c>, <c>Media:FfmpegPath</c>.
/// </summary>
public sealed class ExternalImageConverter(IConfiguration configuration) : IImageConverter
{
    private static readonly TimeSpan Timeout = TimeSpan.FromMinutes(2);

    public async Task<string?> ToJpeg(string inputPath, string contentType, CancellationToken ct)
    {
        var directory = Path.GetDirectoryName(inputPath) ?? Path.GetTempPath();
        var baseName = Path.GetFileNameWithoutExtension(inputPath);
        var output = Path.Combine(directory, $"{baseName}.converted.jpg");
        var isHeif = contentType is "image/heic" or "image/heif";

        if (isHeif)
        {
            var heif = configuration["Media:HeifConvertPath"] is { Length: > 0 } path ? path : "heif-convert";
            // heif-convert reconnaît le format au contenu mais se base sur l'extension : on lui donne un .heic.
            var heifInput = Path.Combine(directory, $"{baseName}.heic");
            File.Copy(inputPath, heifInput, overwrite: true);
            try
            {
                if (await Run(heif, ["-q", "88", heifInput, output], ct) && File.Exists(output)) return output;
                // Une image multiple écrit « nom-1.jpg », « nom-2.jpg »… : on garde la première.
                var first = Path.Combine(directory, $"{baseName}.converted-1.jpg");
                if (File.Exists(first)) { File.Move(first, output, overwrite: true); return output; }
            }
            finally
            {
                DeleteQuietly(heifInput);
                foreach (var extra in Directory.EnumerateFiles(directory, $"{baseName}.converted-*.jpg")) DeleteQuietly(extra);
            }
            DeleteQuietly(output);
        }

        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } ffmpegPath ? ffmpegPath : "ffmpeg";
        if (await Run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath, "-frames:v", "1", "-q:v", "2", output], ct)
            && File.Exists(output) && new FileInfo(output).Length > 0)
            return output;
        DeleteQuietly(output);
        return null;
    }

    private static async Task<bool> Run(string executable, string[] arguments, CancellationToken ct)
    {
        var info = new ProcessStartInfo(executable) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true, RedirectStandardOutput = true };
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        Process? process;
        try { process = Process.Start(info); }
        catch (Win32Exception) { return false; }          // l'outil n'est pas installé
        if (process is null) return false;
        using (process)
        {
            var output = process.StandardOutput.ReadToEndAsync(CancellationToken.None);
            var errors = process.StandardError.ReadToEndAsync(CancellationToken.None);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(Timeout);
            try
            {
                await process.WaitForExitAsync(timeout.Token);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
                if (ct.IsCancellationRequested) throw;
                return false;
            }
            _ = await output;
            _ = await errors;
            return process.ExitCode == 0;
        }
    }

    private static void DeleteQuietly(string path)
    {
        try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}
