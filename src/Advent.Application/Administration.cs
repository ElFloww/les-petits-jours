using Advent.Domain;
using FluentValidation;
using MediatR;

namespace Advent.Application;

public sealed record EditorialNotes(string Tone, string SharedMemories, string Avoid);
/// <summary>Contenu éditorial d'un cadeau, avec des blocs facultatifs de texte ou de médias privés.</summary>
public sealed record ContentItem(int Day, string Kind, string Title, string Text, string Sticker, bool Reviewed,
    IReadOnlyList<ContentBlock>? Blocks = null);
public sealed record PersonContent(string Username, EditorialNotes Notes, IReadOnlyList<ContentItem> Entries);
public sealed record ContentDocument(int Year, IReadOnlyList<PersonContent> People);
public sealed record ImportContentCommand(ContentDocument Document, bool Publish) : IRequest<int>;
public sealed record SetPasswordCommand(string Username, string Password) : IRequest;
public sealed record DisableAccountCommand(string Username) : IRequest;

public static class ContentCatalog
{
    public static readonly string[] Usernames = ["louisa", "orleane", "thomas"];
    public static readonly string[] Kinds = ["blague", "anecdote", "activite", "surprise"];
    public static readonly string[] Stickers =
    [
        "sourire", "clin-oeil", "rire", "surprise", "sceptique", "bisou",
        "langue", "bouderie", "grrr", "reflexion", "lunettes-noires", "baiser",
        "chapeau", "joues-gonflees", "chut", "grimace", "pikachu", "larmes",
        "lunettes-bleues", "burger", "malice", "mousse", "cri", "zen"
    ];
}

public sealed class ImportContentValidator : AbstractValidator<ImportContentCommand>
{
    public ImportContentValidator()
    {
        RuleFor(x => x.Document).NotNull().DependentRules(() =>
        {
            RuleFor(x => x.Document.Year).Equal(CalendarRules.Year);
            RuleFor(x => x.Document.People).NotNull().Must(people =>
                people is not null && people.Count == 3 && people.All(person => person is not null) &&
                people.Select(x => x.Username).Order().SequenceEqual(ContentCatalog.Usernames.Order()));
            RuleForEach(x => x.Document.People).SetValidator(new PersonContentValidator());
            RuleFor(x => x.Document).Must(doc => doc.People.All(p => p.Entries.All(e => e is not null && e.Reviewed)))
                .When(x => x.Publish && x.Document.People is not null && x.Document.People.All(p => p is not null && p.Entries is not null))
                .WithMessage("Chaque texte doit être relu (reviewed: true) avant publication.");
        });
    }
}

public sealed class PersonContentValidator : AbstractValidator<PersonContent>
{
    public PersonContentValidator()
    {
        RuleFor(x => x.Username).Must(ContentCatalog.Usernames.Contains);
        RuleFor(x => x.Notes).NotNull();
        RuleFor(x => x.Entries).NotNull().Must(entries =>
            entries is not null && entries.All(entry => entry is not null) &&
            entries.Select(x => x.Day).Order().SequenceEqual(Enumerable.Range(1, 24)));
        RuleForEach(x => x.Entries).SetValidator(new ContentItemValidator());
    }
}

public sealed class ContentItemValidator : AbstractValidator<ContentItem>
{
    public ContentItemValidator()
    {
        RuleFor(x => x.Day).InclusiveBetween(1, 24);
        RuleFor(x => x.Kind).Must(ContentCatalog.Kinds.Contains);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Text).NotNull().MaximumLength(50000);
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.Text) || x.Blocks is { Count: > 0 });
        RuleFor(x => x.Sticker).Must(ContentCatalog.Stickers.Contains);
        RuleFor(x => x.Blocks).Must(blocks => blocks is null || blocks.Count <= 20);
        RuleForEach(x => x.Blocks).NotNull().SetValidator(new ContentBlockValidator());
    }
}

public sealed class SetPasswordValidator : AbstractValidator<SetPasswordCommand>
{
    public SetPasswordValidator()
    {
        RuleFor(x => x.Username).Must(ContentCatalog.Usernames.Contains);
        RuleFor(x => x.Password).MinimumLength(14).MaximumLength(256);
    }
}

public sealed class DisableAccountValidator : AbstractValidator<DisableAccountCommand>
{
    public DisableAccountValidator() => RuleFor(x => x.Username).Must(ContentCatalog.Usernames.Contains);
}

public sealed class ImportContentHandler(IUserRepository users, ICalendarRepository entries, IMediaRepository media, IUnitOfWork uow)
    : IRequestHandler<ImportContentCommand, int>
{
    public async Task<int> Handle(ImportContentCommand request, CancellationToken ct)
    {
        foreach (var person in request.Document.People)
        {
            var user = await users.FindByUsername(person.Username, ct)
                ?? throw new AppException(404, "Compte absent : déployez d'abord le DACPAC.");
            foreach (var item in person.Entries)
            {
                await GiftContent.ValidateMedia(media, user.Id, item.Day, item.Blocks, ct);
                await entries.Upsert(new CalendarEntry
                {
                    UserId = user.Id, Day = item.Day, Kind = item.Kind, Title = item.Title,
                    Text = item.Text, Sticker = item.Sticker, IsPublished = request.Publish,
                    BlocksJson = GiftContent.SerializeBlocks(item.Blocks)
                }, ct);
            }
        }
        await uow.SaveChanges(ct);
        return 72;
    }
}

public sealed class SetPasswordHandler(IUserRepository users, IPasswordService passwords, ISessionRepository sessions, IUnitOfWork uow)
    : IRequestHandler<SetPasswordCommand>
{
    public async Task Handle(SetPasswordCommand request, CancellationToken ct)
    {
        var user = await users.FindByUsername(request.Username, ct)
            ?? throw new AppException(404, "Compte absent : déployez d'abord le DACPAC.");
        user.PasswordHash = passwords.Hash(request.Password);
        user.IsActive = true;
        await sessions.RevokeAll(user.Id, ct);
        await uow.SaveChanges(ct);
    }
}

public sealed class DisableAccountHandler(IUserRepository users, ISessionRepository sessions, IUnitOfWork uow)
    : IRequestHandler<DisableAccountCommand>
{
    public async Task Handle(DisableAccountCommand request, CancellationToken ct)
    {
        var user = await users.FindByUsername(request.Username, ct)
            ?? throw new AppException(404, "Compte introuvable.");
        user.IsActive = false;
        await sessions.RevokeAll(user.Id, ct);
        await uow.SaveChanges(ct);
    }
}
