using System.Globalization;
using Advent.Domain;
using FluentValidation;
using MediatR;

namespace Advent.Application;

public sealed record LoginCommand(string Email, string Password) : IRequest<LoginResult>;
public sealed record LogoutCommand(string TokenHash) : IRequest;
public sealed record AccountQuery(Guid UserId) : IRequest<AccountResponse>;
public sealed record CalendarQuery(Guid UserId) : IRequest<CalendarResponse>;
public sealed record EntryQuery(Guid UserId, int Day) : IRequest<EntryResponse>;
public sealed record OpenEntryCommand(Guid UserId, int Day) : IRequest<EntryResponse>;

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().MaximumLength(254);
        RuleFor(x => x.Password).NotEmpty().MaximumLength(256);
    }
}

public sealed class LogoutValidator : AbstractValidator<LogoutCommand>
{
    public LogoutValidator() => RuleFor(x => x.TokenHash).Length(64);
}

public sealed class AccountValidator : AbstractValidator<AccountQuery>
{
    public AccountValidator() => RuleFor(x => x.UserId).NotEmpty();
}

public sealed class CalendarValidator : AbstractValidator<CalendarQuery>
{
    public CalendarValidator() => RuleFor(x => x.UserId).NotEmpty();
}

public sealed class EntryValidator : AbstractValidator<EntryQuery>
{
    public EntryValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Day).InclusiveBetween(1, 24);
    }
}

public sealed class OpenEntryValidator : AbstractValidator<OpenEntryCommand>
{
    public OpenEntryValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Day).InclusiveBetween(1, 24);
    }
}

public sealed class LoginHandler(
    IUserRepository users, IPasswordService passwords, ISessionTokens tokens,
    ISessionRepository sessions, IUnitOfWork uow, TimeProvider clock) : IRequestHandler<LoginCommand, LoginResult>
{
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromDays(30);

    public async Task<LoginResult> Handle(LoginCommand request, CancellationToken ct)
    {
        var identifier = request.Email.Trim();
        var user = identifier.Contains('@')
            ? await users.FindByEmail(identifier.ToLowerInvariant(), ct)
            : await users.FindByUsername(identifier.ToLowerInvariant(), ct);
        var valid = passwords.Verify(user?.PasswordHash, request.Password);
        if (!valid || user is not { IsActive: true })
            throw new AppException(401, "Identifiant ou mot de passe incorrect.");

        var token = tokens.Create();
        var expires = clock.GetUtcNow().Add(SessionLifetime);
        await sessions.DeleteExpired(clock.GetUtcNow(), ct);
        sessions.Add(new Session { TokenHash = tokens.Hash(token), UserId = user.Id, ExpiresAt = expires });
        await uow.SaveChanges(ct);
        return new(new(user.Id, user.Username, user.Email, user.DisplayName, user.IsAdmin), token, expires);
    }
}

public sealed class LogoutHandler(ISessionRepository sessions) : IRequestHandler<LogoutCommand>
{
    public Task Handle(LogoutCommand request, CancellationToken ct) => sessions.Revoke(request.TokenHash, ct);
}

public sealed class AccountHandler(IUserRepository users) : IRequestHandler<AccountQuery, AccountResponse>
{
    public async Task<AccountResponse> Handle(AccountQuery request, CancellationToken ct)
    {
        var user = await users.FindById(request.UserId, ct);
        if (user is not { IsActive: true }) throw new AppException(401, "Votre session a expiré.");
        return new(user.Id, user.Username, user.Email, user.DisplayName, user.IsAdmin);
    }
}

public sealed class CalendarHandler(ICalendarRepository entries, TimeProvider clock) : IRequestHandler<CalendarQuery, CalendarResponse>
{
    private static readonly string[] Phrases =
    [
        "Un peu de patience, beaucoup de magie.",
        "Les petits bonheurs font les grands décembres.",
        "Aujourd'hui, on collectionne les sourires.",
        "Une surprise se cache dans l'hiver."
    ];

    public async Task<CalendarResponse> Handle(CalendarQuery request, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var today = CalendarRules.Today(now);
        var entriesByDay = (await entries.List(request.UserId, ct)).ToDictionary(x => x.Day);
        var days = Enumerable.Range(1, 24).Select(day => new DayResponse(day,
            !CalendarRules.IsAvailable(day, now) ? "locked" :
            entriesByDay.TryGetValue(day, out var entry) && entry.FirstOpenedAt.HasValue ? "opened" : "available",
            CalendarRules.UnlocksAt(day))).ToArray();
        var seed = BitConverter.ToUInt32(request.UserId.ToByteArray(), 0);
        var decoration = Phrases[(int)((seed + (uint)today.DayNumber) % Phrases.Length)];
        return new(CalendarRules.Year, today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), decoration, days);
    }
}

public interface IEntryReader
{
    Task<CalendarEntry> Available(Guid userId, int day, CancellationToken ct);
}

public sealed class EntryReader(ICalendarRepository entries, TimeProvider clock) : IEntryReader
{
    public async Task<CalendarEntry> Available(Guid userId, int day, CancellationToken ct)
    {
        if (!CalendarRules.IsAvailable(day, clock.GetUtcNow()))
            throw new AppException(403, "Un peu de patience : ce cadeau n'est pas encore disponible.");
        var entry = await entries.Find(userId, day, ct);
        if (entry is not { IsPublished: true })
            throw new AppException(404, "Cette surprise est encore en préparation. Revenez un peu plus tard.");
        return entry;
    }

    public static EntryResponse Response(CalendarEntry entry) =>
        new(entry.Day, entry.Kind, entry.Title, entry.Text, entry.Sticker, entry.FirstOpenedAt, GiftContent.Blocks(entry));
}

public sealed class EntryHandler(IEntryReader reader) : IRequestHandler<EntryQuery, EntryResponse>
{
    public async Task<EntryResponse> Handle(EntryQuery request, CancellationToken ct) =>
        EntryReader.Response(await reader.Available(request.UserId, request.Day, ct));
}

public sealed class OpenEntryHandler(IEntryReader reader, ICalendarRepository entries, TimeProvider clock)
    : IRequestHandler<OpenEntryCommand, EntryResponse>
{
    public async Task<EntryResponse> Handle(OpenEntryCommand request, CancellationToken ct)
    {
        var entry = await reader.Available(request.UserId, request.Day, ct);
        entry.FirstOpenedAt = await entries.MarkOpened(request.UserId, request.Day, clock.GetUtcNow(), ct);
        return EntryReader.Response(entry);
    }
}
