using Advent.Domain;

namespace Advent.Application;

/// <summary>Identifiant opaque et type du média importé pour un cadeau.</summary>
public sealed record UploadedMediaResponse(string MediaId, string Type);
public sealed record MediaFile(byte[] Data, string ContentType);

public interface IGiftMedia
{
    Task<UploadedMediaResponse> Upload(Guid userId, int day, string contentType, Stream source, CancellationToken ct);
    Task<MediaFile> Read(Guid userId, int day, string mediaId, bool preview, CancellationToken ct);
}

public sealed class GiftMedia(IMediaRepository media, IEntryReader entries, IUnitOfWork uow) : IGiftMedia
{
    public const int MaxBytes = 50 * 1024 * 1024;
    public const int MaxImageBytes = 10 * 1024 * 1024;

    public async Task<UploadedMediaResponse> Upload(Guid userId, int day, string contentType, Stream source, CancellationToken ct)
    {
        ValidateDay(day);
        if (contentType is not ("image/jpeg" or "image/png" or "image/webp" or "image/gif" or "video/mp4" or "video/webm" or "audio/mpeg" or "audio/wav" or "audio/ogg"))
            throw new AppException(400, "Format non pris en charge. Utilisez JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV ou OGG.");
        var limit = contentType.StartsWith("image/", StringComparison.Ordinal) ? MaxImageBytes : MaxBytes;
        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > limit)
                throw new AppException(413, "Fichier trop volumineux : 10 Mo par image, 50 Mo par vidéo ou audio.");
            await buffer.WriteAsync(chunk.AsMemory(0, read), ct);
        }
        var data = buffer.ToArray();
        if (!MatchesContentType(data, contentType))
            throw new AppException(400, "Le fichier est vide, endommagé ou ne correspond pas au format annoncé.");
        var id = Guid.NewGuid();
        media.Add(new CalendarMedia { Id = id, UserId = userId, Day = day, ContentType = contentType, Data = data });
        await uow.SaveChanges(ct);
        return new(id.ToString("N"), contentType.Split('/')[0]);
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

    private static bool MatchesContentType(ReadOnlySpan<byte> data, string contentType) => contentType switch
    {
        "image/jpeg" => data.StartsWith<byte>([0xff, 0xd8, 0xff]),
        "image/png" => data.StartsWith<byte>([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/gif" => data.StartsWith("GIF87a"u8) || data.StartsWith("GIF89a"u8),
        "image/webp" => data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8),
        "video/mp4" => data.Length >= 12 && data[4..8].SequenceEqual("ftyp"u8),
        "video/webm" => data.StartsWith<byte>([0x1a, 0x45, 0xdf, 0xa3]),
        "audio/mpeg" => data.StartsWith("ID3"u8) || (data.Length > 2 && data[0] == 0xff && (data[1] & 0xe0) == 0xe0),
        "audio/wav" => data.Length >= 12 && data.StartsWith("RIFF"u8) && data[8..12].SequenceEqual("WAVE"u8),
        "audio/ogg" => data.StartsWith("OggS"u8),
        _ => false
    };
}
