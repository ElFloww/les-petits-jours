using Advent.Domain;

namespace Advent.Application;

public sealed record MediaInfo(Guid Id, Guid UserId, int Day, string ContentType, long Bytes);
public sealed record OptimizeMediaResult(string MediaId, string ContentType, long Before, long After, bool Changed, string? Reason);

/// <summary>Recompresse les médias déjà stockés en base (même identifiant : les cadeaux publiés continuent de fonctionner).</summary>
public interface IMediaOptimizer
{
    Task<IReadOnlyList<MediaInfo>> List(CancellationToken ct);
    Task<OptimizeMediaResult> Optimize(Guid id, CancellationToken ct);
}

public sealed class MediaOptimizer(IMediaRepository media, IUnitOfWork uow,
    IVideoCompressor? compressor = null, IImageConverter? images = null) : IMediaOptimizer
{
    /// <summary>Le média n'est remplacé que s'il gagne au moins 15 % : relancer l'opération ne dégrade pas inutilement un fichier déjà léger.</summary>
    private const double RequiredRatio = 0.85;

    public Task<IReadOnlyList<MediaInfo>> List(CancellationToken ct) => media.List(ct);

    public async Task<OptimizeMediaResult> Optimize(Guid id, CancellationToken ct)
    {
        var file = await media.FindForUpdate(id, ct) ?? throw new AppException(404, "Média introuvable.");
        var before = (long)file.Data.Length;
        var kind = file.ContentType.Split('/')[0];
        OptimizeMediaResult Unchanged(string reason) => new(file.Id.ToString("N"), file.ContentType, before, before, false, reason);

        if (kind == "audio" || file.ContentType is "image/gif" or "image/avif") return Unchanged("Format conservé tel quel.");
        if (file.ContentType == "image/webp" && IsAnimatedWebp(file.Data)) return Unchanged("WebP animé conservé tel quel.");

        var input = Path.Combine(Path.GetTempPath(), $"petits-jours-{Guid.NewGuid():N}.upload");
        string? output = null;
        try
        {
            await File.WriteAllBytesAsync(input, file.Data, ct);
            var newType = file.ContentType;
            if (kind == "video")
            {
                if (compressor is null) return Unchanged("Compression indisponible (ffmpeg absent).");
                output = await compressor.Compress(input, false, ct);
                newType = "video/mp4";
            }
            else
            {
                if (images is null) return Unchanged("Compression indisponible (ffmpeg absent).");
                var shrunk = await images.Shrink(input, file.ContentType, ct);
                output = shrunk?.Path;
                newType = shrunk?.ContentType ?? newType;
            }
            if (output is null) return Unchanged("Déjà optimisé, ou conversion impossible.");
            var after = new FileInfo(output).Length;
            if (after > before * RequiredRatio) return Unchanged("Gain trop faible : fichier conservé.");
            file.Data = await File.ReadAllBytesAsync(output, ct);
            file.ContentType = newType;
            await uow.SaveChanges(ct);
            return new(file.Id.ToString("N"), newType, before, after, true, null);
        }
        finally
        {
            DeleteQuietly(input);
            if (output is not null) DeleteQuietly(output);
        }
    }

    // Un WebP animé porte le drapeau « animation » (bit 1) dans l'en-tête VP8X : l'aplatir en image fixe le détruirait.
    private static bool IsAnimatedWebp(byte[] data) =>
        data.Length > 21 && data.AsSpan(12, 4).SequenceEqual("VP8X"u8) && (data[20] & 0x02) != 0;

    private static void DeleteQuietly(string path)
    {
        try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }
}
