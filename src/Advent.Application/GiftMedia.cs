using Advent.Domain;

namespace Advent.Application;

/// <summary>Identifiant opaque et type du média importé pour un cadeau.</summary>
public sealed record UploadedMediaResponse(string MediaId, string Type);
public sealed record MediaFile(byte[] Data, string ContentType);

/// <summary>Convertit/recompresse les vidéos importées (ffmpeg). Optionnel : sans lui, seuls MP4 et WebM sont conservés tels quels.</summary>
public interface IVideoCompressor
{
    /// <param name="force">Vrai quand le format source n'est pas lisible par les navigateurs : le résultat est gardé même s'il n'est pas plus léger.</param>
    /// <returns>Chemin d'un MP4, ou <c>null</c> si la conversion est indisponible ou échoue (ou, hors <paramref name="force"/>, ne gagne rien).</returns>
    Task<string?> Compress(string inputPath, bool force, CancellationToken ct);
}

/// <summary>Convertit en JPEG les images que les navigateurs ne savent pas afficher (HEIC/HEIF de l'iPhone, BMP, TIFF).</summary>
public interface IImageConverter
{
    /// <returns>Chemin d'un JPEG, ou <c>null</c> si la conversion est indisponible ou échoue.</returns>
    Task<string?> ToJpeg(string inputPath, string contentType, CancellationToken ct);
}

public interface IGiftMedia
{
    Task<UploadedMediaResponse> Upload(Guid userId, int day, string contentType, Stream source, CancellationToken ct);
    Task<MediaFile> Read(Guid userId, int day, string mediaId, bool preview, CancellationToken ct);
}

public sealed class GiftMedia(IMediaRepository media, IEntryReader entries, IUnitOfWork uow,
    IVideoCompressor? compressor = null, IImageConverter? imageConverter = null) : IGiftMedia
{
    public const int MaxBytes = 300 * 1024 * 1024;
    public const int MaxImageBytes = 40 * 1024 * 1024;
    /// <summary>Taille maximale d'une image à convertir (un TIFF ou un BMP peut être très lourd avant conversion).</summary>
    public const int MaxImageSourceBytes = 100 * 1024 * 1024;

    private const string TooLarge = "Fichier trop volumineux : 40 Mo par image, 300 Mo par vidéo ou audio.";

    private static readonly HashSet<string> Images = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
        "image/heic", "image/heif", "image/bmp", "image/tiff"];
    private static readonly HashSet<string> ImagesToConvert = ["image/heic", "image/heif", "image/bmp", "image/tiff"];
    private static readonly HashSet<string> Videos = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
        "video/x-msvideo", "video/3gpp"];
    private static readonly HashSet<string> VideosKeptAsIs = ["video/mp4", "video/webm"];
    private static readonly HashSet<string> Audios = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/aac", "audio/flac"];

    public async Task<UploadedMediaResponse> Upload(Guid userId, int day, string contentType, Stream source, CancellationToken ct)
    {
        ValidateDay(day);
        contentType = contentType.Split(';')[0].Trim().ToLowerInvariant();
        if (!Images.Contains(contentType) && !Videos.Contains(contentType) && !Audios.Contains(contentType))
            throw new AppException(400, "Format non pris en charge. Images : JPG, PNG, WebP, GIF, AVIF, HEIC, BMP, TIFF. Vidéos : MP4, MOV, WebM, MKV, AVI, 3GP. Audio : MP3, M4A, AAC, WAV, OGG, FLAC.");
        if (Videos.Contains(contentType) || ImagesToConvert.Contains(contentType))
            return await UploadConverted(userId, day, contentType, source, ct);

        var limit = Images.Contains(contentType) ? MaxImageBytes : MaxBytes;
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > limit) throw new AppException(413, TooLarge);
            await buffer.WriteAsync(chunk.AsMemory(0, read), ct);
        }
        var data = buffer.ToArray();
        if (!MatchesContentType(data, contentType))
            throw new AppException(400, "Le fichier est vide, endommagé ou ne correspond pas au format annoncé.");
        return await Store(userId, day, contentType, data, ct);
    }

    // Vidéos et images à convertir : écrites sur disque (pas en mémoire), contrôlées, puis converties par les outils externes.
    private async Task<UploadedMediaResponse> UploadConverted(Guid userId, int day, string contentType, Stream source, CancellationToken ct)
    {
        var isVideo = Videos.Contains(contentType);
        var limit = isVideo ? MaxBytes : MaxImageSourceBytes;
        var input = Path.Combine(Path.GetTempPath(), $"petits-jours-{Guid.NewGuid():N}.upload");
        string? converted = null;
        try
        {
            var header = new byte[16];
            var headerLength = 0;
            await using (var file = new FileStream(input, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                var chunk = new byte[81920];
                long total = 0;
                int read;
                while ((read = await source.ReadAsync(chunk, ct)) > 0)
                {
                    if (total + read > limit) throw new AppException(413, TooLarge);
                    if (headerLength < header.Length)
                    {
                        var copy = Math.Min(read, header.Length - headerLength);
                        Array.Copy(chunk, 0, header, headerLength, copy);
                        headerLength += copy;
                    }
                    total += read;
                    await file.WriteAsync(chunk.AsMemory(0, read), ct);
                }
            }
            if (!MatchesContentType(header.AsSpan(0, headerLength), contentType))
                throw new AppException(400, "Le fichier est vide, endommagé ou ne correspond pas au format annoncé.");

            var path = input;
            var finalType = contentType;
            if (isVideo)
            {
                var keep = VideosKeptAsIs.Contains(contentType);
                converted = compressor is null ? null : await compressor.Compress(input, force: !keep, ct);
                if (converted is not null) { path = converted; finalType = "video/mp4"; }
                else if (!keep)
                    throw new AppException(415, "Cette vidéo n'a pas pu être convertie (format illisible ou conversion indisponible). Essaie un fichier MP4.");
            }
            else
            {
                converted = imageConverter is null ? null : await imageConverter.ToJpeg(input, contentType, ct);
                if (converted is null)
                    throw new AppException(415, "Cette image n'a pas pu être convertie (format illisible ou conversion indisponible). Essaie un fichier JPG ou PNG.");
                path = converted;
                finalType = "image/jpeg";
                if (new FileInfo(path).Length > MaxImageBytes) throw new AppException(413, TooLarge);
            }
            return await Store(userId, day, finalType, await File.ReadAllBytesAsync(path, ct), ct);
        }
        finally
        {
            DeleteQuietly(input);
            if (converted is not null) DeleteQuietly(converted);
        }
    }

    private async Task<UploadedMediaResponse> Store(Guid userId, int day, string contentType, byte[] data, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        media.Add(new CalendarMedia { Id = id, UserId = userId, Day = day, ContentType = contentType, Data = data });
        await uow.SaveChanges(ct);
        return new(id.ToString("N"), contentType.Split('/')[0]);
    }

    private static void DeleteQuietly(string path)
    {
        try { File.Delete(path); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    public async Task<MediaFile> Read(Guid userId, int day, string mediaId, bool preview, CancellationToken ct)
    {
        ValidateDay(day);
        if (!Guid.TryParseExact(mediaId, "N", out var id)) throw new AppException(404, "Média introuvable.");
        if (!preview)
        {
            var entry = await entries.Available(userId, day, ct);
            if (!(GiftContent.Blocks(entry)?.Any(block => block.MediaId == mediaId) ?? false))
                throw new AppException(404, "Ce média n'appartient pas au cadeau publié.");
        }
        var file = await media.Find(userId, day, id, ct) ?? throw new AppException(404, "Média introuvable.");
        return new(file.Data, file.ContentType);
    }

    private static void ValidateDay(int day)
    {
        if (day is < 1 or > 24) throw new AppException(400, "Le jour doit être compris entre 1 et 24.");
    }

    private static bool IsIsoMedia(ReadOnlySpan<byte> data) => data.Length >= 12 && data[4..8].SequenceEqual("ftyp"u8);

    private static bool MatchesContentType(ReadOnlySpan<byte> data, string contentType) => contentType switch
    {
        "image/jpeg" => data.StartsWith<byte>([0xff, 0xd8, 0xff]),
        "image/png" => data.StartsWith<byte>([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/gif" => data.StartsWith("GIF87a"u8) || data.StartsWith("GIF89a"u8),
        "image/webp" => data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8),
        "image/avif" or "image/heic" or "image/heif" => IsIsoMedia(data),
        "image/bmp" => data.StartsWith("BM"u8),
        "image/tiff" => data.StartsWith<byte>([0x49, 0x49, 0x2a, 0x00]) || data.StartsWith<byte>([0x4d, 0x4d, 0x00, 0x2a]),
        "video/mp4" or "video/3gpp" => IsIsoMedia(data),
        "video/quicktime" => IsIsoMedia(data) || (data.Length >= 8 && (data[4..8].SequenceEqual("moov"u8) || data[4..8].SequenceEqual("mdat"u8)
            || data[4..8].SequenceEqual("wide"u8) || data[4..8].SequenceEqual("free"u8) || data[4..8].SequenceEqual("skip"u8))),
        "video/webm" or "video/x-matroska" => data.StartsWith<byte>([0x1a, 0x45, 0xdf, 0xa3]),
        "video/x-msvideo" => data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("AVI "u8),
        "audio/mpeg" => data.StartsWith("ID3"u8) || (data.Length > 2 && data[0] == 0xff && (data[1] & 0xe0) == 0xe0),
        "audio/aac" => data.Length > 2 && data[0] == 0xff && (data[1] & 0xf6) == 0xf0,
        "audio/mp4" => IsIsoMedia(data),
        "audio/flac" => data.StartsWith("fLaC"u8),
        "audio/wav" => data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("WAVE"u8),
        "audio/ogg" => data.StartsWith("OggS"u8),
        _ => false
    };
}
