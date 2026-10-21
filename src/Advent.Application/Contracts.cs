using Advent.Domain;

namespace Advent.Application;

public interface IUserRepository
{
    Task<User?> FindByUsername(string username, CancellationToken ct);
    Task<User?> FindByEmail(string email, CancellationToken ct);
    Task<User?> FindById(Guid id, CancellationToken ct);
    Task<IReadOnlyList<User>> List(CancellationToken ct);
    Task<bool> EmailExists(string email, Guid? exceptId, CancellationToken ct);
    Task<int> CountActiveAdmins(CancellationToken ct);
    void Add(User user);
    void Remove(User user);
}

public interface IPasswordResetRepository
{
    void Add(PasswordResetToken token);
    Task ResetPassword(string tokenHash, string passwordHash, DateTimeOffset now, CancellationToken ct);
    Task DeleteExpired(DateTimeOffset now, CancellationToken ct);
}

public interface ICalendarRepository
{
    Task<IReadOnlyList<CalendarEntry>> List(Guid userId, CancellationToken ct);
    Task<CalendarEntry?> Find(Guid userId, int day, CancellationToken ct);
    Task<DateTimeOffset> MarkOpened(Guid userId, int day, DateTimeOffset now, CancellationToken ct);
    Task Upsert(CalendarEntry entry, CancellationToken ct);
    Task SaveDraft(CalendarEntry entry, CancellationToken ct);
}

public interface IMediaRepository
{
    void Add(CalendarMedia media);
    Task<CalendarMedia?> Find(Guid userId, int day, Guid id, CancellationToken ct);
    Task<bool> Exists(Guid userId, int day, Guid id, string type, CancellationToken ct);
}

public interface ISessionRepository
{
    void Add(Session session);
    Task<User?> Resolve(string tokenHash, DateTimeOffset now, CancellationToken ct);
    Task Revoke(string tokenHash, CancellationToken ct);
    Task RevokeAll(Guid userId, CancellationToken ct);
    Task DeleteExpired(DateTimeOffset now, CancellationToken ct);
}

public interface IUnitOfWork
{
    Task SaveChanges(CancellationToken ct);
}

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string? hash, string password);
}

public interface ISessionTokens
{
    string Create();
    string Hash(string token);
}

public interface IEmailSender
{
    bool IsConfigured { get; }
    string? PasswordResetBaseUrl { get; }
    Task SendPasswordReset(string email, string displayName, string link, CancellationToken ct);
}

public sealed class EmailDeliveryException(string message, Exception innerException) : Exception(message, innerException);

public sealed class AppException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>Compte de la personne connectée, sans donnée d'authentification.</summary>
public sealed record AccountResponse(Guid Id, string Username, string? Email, string DisplayName, bool IsAdmin);
/// <summary>État public d'une case du calendrier personnel, sans son contenu.</summary>
public sealed record DayResponse(int Day, string State, DateTimeOffset UnlocksAt);
/// <summary>Calendrier personnel et date courante calculée à Paris par le serveur.</summary>
public sealed record CalendarResponse(int Year, string Today, string Decoration, IReadOnlyList<DayResponse> Days, bool CanPreview = false);
/// <summary>Contenu d'une surprise appartenant à la personne connectée.</summary>
public sealed record EntryResponse(int Day, string Kind, string Title, string Text, string Sticker, DateTimeOffset? FirstOpenedAt,
    IReadOnlyList<ContentBlock>? Blocks = null);
/// <summary>Prévisualisation en lecture seule, avec le statut de publication, réservée au développement.</summary>
public sealed record PreviewEntryResponse(EntryResponse Content, bool IsPublished);
public sealed record LoginResult(AccountResponse Account, string Token, DateTimeOffset ExpiresAt);
