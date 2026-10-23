using System.ComponentModel;
using System.Diagnostics;
using Advent.Application;
using Microsoft.Extensions.Configuration;

namespace Advent.Infrastructure;

/// <summary>
/// Recompresse les vidéos en MP4 H.264/AAC (720p max) avec ffmpeg quand il est installé.
/// Sans ffmpeg, ou si le résultat n'est pas plus léger, une vidéo MP4/WebM est conservée telle quelle ; les autres formats (MOV, MKV, AVI, 3GP) exigent la conversion.
/// Réglages optionnels : <c>Media:VideoCompression</c> (false pour désactiver), <c>Media:FfmpegPath</c>, <c>Media:VideoMaxWidth</c>, <c>Media:VideoCrf</c>.
/// </summary>
public sealed class FfmpegVideoCompressor(IConfiguration configuration) : IVideoCompressor
{
    // Une seule recompression à la fois : ffmpeg est gourmand en processeur.
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static readonly TimeSpan Timeout = TimeSpan.FromMinutes(20);

    public async Task<string?> Compress(string inputPath, bool force, CancellationToken ct)
    {
        if (string.Equals(configuration["Media:VideoCompression"], "false", StringComparison.OrdinalIgnoreCase)) return null;
        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } path ? path : "ffmpeg";
        var maxWidth = int.TryParse(configuration["Media:VideoMaxWidth"], out var width) && width >= 320 ? width : 1280;
        var crf = int.TryParse(configuration["Media:VideoCrf"], out var quality) && quality is >= 18 and <= 35 ? quality : 26;
        var output = Path.Combine(Path.GetDirectoryName(inputPath) ?? Path.GetTempPath(), $"{Path.GetFileNameWithoutExtension(inputPath)}.compressed.mp4");

        await Gate.WaitAsync(ct);
        try
        {
            var info = new ProcessStartInfo(ffmpeg) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true };
            foreach (var argument in new[]
            {
                "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath,
                "-vf", $"scale='min({maxWidth},iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", crf.ToString(),
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-map_metadata", "-1",
                "-threads", "2", output
            }) info.ArgumentList.Add(argument);

            Process? process;
            try { process = Process.Start(info); }
            catch (Win32Exception) { return null; }       // ffmpeg n'est pas installé
            if (process is null) return null;

            using (process)
            {
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
                    DeleteQuietly(output);
                    if (ct.IsCancellationRequested) throw;
                    return null;                            // trop long : on garde l'original
                }
                _ = await errors;
                if (process.ExitCode != 0) { DeleteQuietly(output); return null; }
            }

            var result = new FileInfo(output);
            if (!result.Exists || result.Length == 0 || (!force && result.Length >= new FileInfo(inputPath).Length))
            {
                DeleteQuietly(output);
                return null;
            }
            return output;
        }
        finally { Gate.Release(); }
    }

    private static void DeleteQuietly(string path)
    {
        try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}
