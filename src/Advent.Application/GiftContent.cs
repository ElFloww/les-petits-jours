using System.Text.Json;
using Advent.Domain;
using FluentValidation;
using MediatR;

namespace Advent.Application;

/// <summary>Bloc de texte, citation, image, vidéo ou audio. MediaId référence un média privé du même cadeau.</summary>
public sealed record ContentBlock(string Type, string? Text = null, string? MediaId = null, string? Caption = null);
/// <summary>Enregistre un brouillon ou publie explicitement un cadeau relu.</summary>
public sealed record SaveGiftRequest(ContentItem Content, bool Publish = false);
public sealed record SaveGiftCommand(Guid UserId, int Day, SaveGiftRequest Request) : IRequest<PreviewEntryResponse>;

public static class GiftContent
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string? SerializeBlocks(IReadOnlyList<ContentBlock>? blocks) =>
        blocks is { Count: > 0 } ? JsonSerializer.Serialize(blocks, Json) : null;
    public static IReadOnlyList<ContentBlock>? Blocks(CalendarEntry entry) =>
        entry.BlocksJson is null ? null : JsonSerializer.Deserialize<ContentBlock[]>(entry.BlocksJson, Json);
    public static string SerializeDraft(ContentItem item) => JsonSerializer.Serialize(item, Json);
    public static ContentItem? Draft(CalendarEntry entry) =>
        entry.DraftJson is null ? null : JsonSerializer.Deserialize<ContentItem>(entry.DraftJson, Json);

    public static async Task ValidateMedia(IMediaRepository media, Guid userId, int day, IReadOnlyList<ContentBlock>? blocks, CancellationToken ct)
    {
        foreach (var block in blocks ?? [])
            if (block.MediaId is not null && !await media.Exists(userId, day, Guid.ParseExact(block.MediaId, "N"), block.Type, ct))
                throw new AppException(400, "Un média est absent ou n'appartient pas à ce cadeau. Importez-le à nouveau.");
    }
}

public sealed class ContentBlockValidator : AbstractValidator<ContentBlock>
{
    public ContentBlockValidator()
    {
        RuleFor(x => x.Type).Must(type => type is "text" or "quote" or "image" or "video" or "audio");
        RuleFor(x => x.Caption).MaximumLength(500);
        When(x => x.Type is "text" or "quote", () =>
        {
            RuleFor(x => x.Text).NotEmpty().MaximumLength(20000);
            RuleFor(x => x.MediaId).Null();
        });
        When(x => x.Type is "image" or "video" or "audio", () =>
        {
            RuleFor(x => x.MediaId).Must(id => Guid.TryParseExact(id, "N", out _));
            RuleFor(x => x.Text).Null();
            RuleFor(x => x.Caption).NotEmpty();
        });
    }
}

public sealed class SaveGiftValidator : AbstractValidator<SaveGiftCommand>
{
    public SaveGiftValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Day).InclusiveBetween(1, 24);
        RuleFor(x => x.Request).NotNull().DependentRules(() =>
        {
            RuleFor(x => x.Request.Content).NotNull().SetValidator(new ContentItemValidator());
            When(x => x.Request.Content is not null, () =>
            {
                RuleFor(x => x.Request.Content.Day).Equal(x => x.Day);
                RuleFor(x => x.Request.Content.Reviewed).Equal(true).When(x => x.Request.Publish);
            });
        });
    }
}

public sealed class SaveGiftHandler(IUserRepository users, ICalendarRepository entries, IMediaRepository media, IUnitOfWork uow)
    : IRequestHandler<SaveGiftCommand, PreviewEntryResponse>
{
    public async Task<PreviewEntryResponse> Handle(SaveGiftCommand request, CancellationToken ct)
    {
        if (await users.FindById(request.UserId, ct) is null)
            throw new AppException(404, "Compte introuvable.");
        var content = request.Request.Content;
        await GiftContent.ValidateMedia(media, request.UserId, request.Day, content.Blocks, ct);
        var existing = await entries.Find(request.UserId, request.Day, ct);

        var entry = new CalendarEntry
        {
            UserId = request.UserId, Day = request.Day, Kind = content.Kind, Title = content.Title,
            Text = content.Text, Sticker = content.Sticker, BlocksJson = GiftContent.SerializeBlocks(content.Blocks),
            IsPublished = request.Request.Publish, FirstOpenedAt = existing?.FirstOpenedAt
        };
        if (request.Request.Publish) await entries.Upsert(entry, ct);
        else
        {
            entry.DraftJson = GiftContent.SerializeDraft(content with { Reviewed = false });
            await entries.SaveDraft(entry, ct);
        }
        await uow.SaveChanges(ct);
        return new(EntryReader.Response(entry), request.Request.Publish);
    }
}
