using System.ComponentModel;
using System.Diagnostics;
using Advent.Application;
using Microsoft.Extensions.Configuration;

namespace Advent.Infrastructure;

/// <summary>
/// Recompresse les vidéos en MP4 H.264/AAC (petit côté limité à 540 px : la fenêtre d'ouverture ne dépasse pas 530 px) avec ffmpeg quand il est installé.
/// Sans ffmpeg, ou si le résultat n'est pas plus léger, une vidéo MP4/WebM est conservée telle quelle ; les autres formats (MOV, MKV, AVI, 3GP) exigent la conversion.
/// Réglages optionnels : <c>Media:VideoCompression</c> (false pour désactiver), <c>Media:FfmpegPath</c>, <c>Media:VideoMaxShortSide</c>, <c>Media:VideoCrf</c>.
/// </summary>
public sealed class FfmpegVideoCompressor(IConfiguration configuration) : IVideoCompressor
{
    // Une seule recompression à la fois : ffmpeg est gourmand en processeur.
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<string?> Compress(string inputPath, bool force, CancellationToken ct)
    {
        if (string.Equals(configuration["Media:VideoCompression"], "false", StringComparison.OrdinalIgnoreCase)) return null;
        var ffmpeg = configuration["Media:FfmpegPath"] is { Length: > 0 } path ? path : "ffmpeg";
        var shortSide = int.TryParse(configuration["Media:VideoMaxShortSide"], out var side) && side >= 240 ? side : 540;
        var crf = int.TryParse(configuration["Media:VideoCrf"], out var quality) && quality is >= 18 and <= 38 ? quality : 28;
        var output = Path.Combine(Path.GetDirectoryName(inputPath) ?? Path.GetTempPath(), $"{Path.GetFileNameWithoutExtension(inputPath)}.compressed.mp4");

        var timeoutMinutes = int.TryParse(configuration["Media:VideoTimeoutMinutes"], out var minutes) && minutes > 0 ? minutes : 120;
        var timeoutSpan = TimeSpan.FromMinutes(timeoutMinutes);
        await Gate.WaitAsync(ct);
        try
        {
            var info = new ProcessStartInfo(ffmpeg) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardError = true };
            foreach (var argument in new[]
            {
                "-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i", inputPath,
                "-vf", $"scale=w='if(gt(iw,ih),-2,min({shortSide},iw))':h='if(gt(iw,ih),min({shortSide},ih),-2)'", "-c:v", "libx264", "-preset", "medium", "-crf", crf.ToString(),
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-map_metadata", "-1",
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
                timeout.CancelAfter(timeoutSpan);
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
