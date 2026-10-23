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
    // Grand côté limité à 1600 px : suffisant pour la fenêtre d'ouverture, bien plus léger qu'une photo de téléphone.
    private const string ShrinkFilter = "scale=w='if(gt(iw,ih),min(1600,iw),-2)':h='if(gt(iw,ih),-2,min(1600,ih))'";

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
                if (await Run(heif, ["-q", "85", heifInput, output], ct) && File.Exists(output)) return await Shrunk(output, directory, baseName, ct);
                // Une image multiple écrit « nom-1.jpg », « nom-2.jpg »… : on garde la première.
                var first = Path.Combine(directory, $"{baseName}.converted-1.jpg");
                if (File.Exists(first)) { File.Move(first, output, overwrite: true); return await Shrunk(output, directory, baseName, ct); }
            }
            finally
            {
                DeleteQuietly(heifInput);
                foreach (var extra in Directory.EnumerateFiles(directory, $"{baseName}.converted-*.jpg")) DeleteQuietly(extra);
            }
            DeleteQuietly(output);
        }

        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } ffmpegPath ? ffmpegPath : "ffmpeg";
        if (await Run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath, "-frames:v", "1", "-vf", ShrinkFilter, "-q:v", "4", output], ct)
            && File.Exists(output) && new FileInfo(output).Length > 0)
            return output;
        DeleteQuietly(output);
        return null;
    }

    public async Task<ConvertedImage?> Shrink(string inputPath, string contentType, CancellationToken ct)
    {
        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } ffmpegPath ? ffmpegPath : "ffmpeg";
        var keepsAlpha = contentType is "image/png" or "image/webp";
        var directory = Path.GetDirectoryName(inputPath) ?? Path.GetTempPath();
        var output = Path.Combine(directory, $"{Path.GetFileNameWithoutExtension(inputPath)}.shrunk.{(keepsAlpha ? "webp" : "jpg")}");
        var arguments = new List<string> { "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath, "-frames:v", "1", "-vf", ShrinkFilter };
        if (keepsAlpha) arguments.AddRange(["-c:v", "libwebp", "-q:v", "80"]);
        else arguments.AddRange(["-q:v", "4"]);
        arguments.Add(output);
        if (await Run(ffmpeg, arguments.ToArray(), ct) && File.Exists(output) && new FileInfo(output).Length > 0)
            return new ConvertedImage(output, keepsAlpha ? "image/webp" : "image/jpeg");
        DeleteQuietly(output);
        return null;
    }

    // Redimensionne un JPEG déjà converti ; sans ffmpeg (ou en cas d'échec), on garde le JPEG tel quel.
    private async Task<string> Shrunk(string jpeg, string directory, string baseName, CancellationToken ct)
    {
        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } ffmpegPath ? ffmpegPath : "ffmpeg";
        var small = Path.Combine(directory, $"{baseName}.small.jpg");
        if (await Run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", jpeg, "-vf", ShrinkFilter, "-q:v", "4", small], ct)
            && File.Exists(small) && new FileInfo(small).Length is > 0 and var size && size < new FileInfo(jpeg).Length)
        {
            DeleteQuietly(jpeg);
            return small;
        }
        DeleteQuietly(small);
        return jpeg;
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
