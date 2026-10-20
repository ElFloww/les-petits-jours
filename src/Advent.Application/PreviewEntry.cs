using FluentValidation;
using MediatR;

namespace Advent.Application;

public sealed record PreviewEntryQuery(Guid UserId, int Day) : IRequest<PreviewEntryResponse>;

public sealed class PreviewEntryValidator : AbstractValidator<PreviewEntryQuery>
{
    public PreviewEntryValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Day).InclusiveBetween(1, 24);
    }
}

public sealed class PreviewEntryHandler(ICalendarRepository entries) : IRequestHandler<PreviewEntryQuery, PreviewEntryResponse>
{
    public async Task<PreviewEntryResponse> Handle(PreviewEntryQuery request, CancellationToken ct)
    {
        var entry = await entries.Find(request.UserId, request.Day, ct)
            ?? throw new AppException(404, "Aucun contenu pour cette case. Importez d'abord votre fichier de brouillons.");
        if (GiftContent.Draft(entry) is { } draft)
            return new(new(draft.Day, draft.Kind, draft.Title, draft.Text, draft.Sticker, entry.FirstOpenedAt, draft.Blocks), false);
        return new(EntryReader.Response(entry), entry.IsPublished);
    }
}
