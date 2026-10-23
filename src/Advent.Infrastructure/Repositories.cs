using Advent.Application;
using Advent.Domain;
using Microsoft.EntityFrameworkCore;

namespace Advent.Infrastructure;

public sealed class UserRepository(AdventDbContext db) : IUserRepository
{
    public Task<User?> FindByUsername(string username, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(x => x.Username == username, ct);
    public Task<User?> FindByEmail(string email, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(x => x.Email == email, ct);
    public Task<User?> FindById(Guid id, CancellationToken ct) =>
        db.Users.SingleOrDefaultAsync(x => x.Id == id, ct);
    public async Task<IReadOnlyList<User>> List(CancellationToken ct) =>
        await db.Users.AsNoTracking().OrderBy(x => x.DisplayName).ToArrayAsync(ct);
    public Task<bool> EmailExists(string email, Guid? exceptId, CancellationToken ct) =>
        db.Users.AnyAsync(x => x.Email == email && x.Id != exceptId, ct);
    public Task<int> CountActiveAdmins(CancellationToken ct) =>
        db.Users.CountAsync(x => x.IsAdmin && x.IsActive, ct);
    public void Add(User user) => db.Users.Add(user);
    public void Remove(User user) => db.Users.Remove(user);
}

public sealed class PasswordResetRepository(AdventDbContext db) : IPasswordResetRepository
{
    public void Add(PasswordResetToken token) => db.PasswordResetTokens.Add(token);

    public async Task ResetPassword(string tokenHash, string passwordHash, DateTimeOffset now, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var token = await db.PasswordResetTokens.SingleOrDefaultAsync(
            x => x.TokenHash == tokenHash && x.ExpiresAt > now, ct);
        if (token is null) throw new AppException(400, "Ce lien de réinitialisation est invalide ou expiré.");

        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == token.UserId && x.IsActive, ct)
            ?? throw new AppException(400, "Ce lien de réinitialisation est invalide ou expiré.");
        var consumed = await db.PasswordResetTokens.Where(x => x.TokenHash == tokenHash && x.ExpiresAt > now)
            .ExecuteDeleteAsync(ct);
        if (consumed != 1) throw new AppException(400, "Ce lien de réinitialisation est invalide ou expiré.");
        user.PasswordHash = passwordHash;
        await db.PasswordResetTokens.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.Sessions.Where(x => x.UserId == user.Id).ExecuteDeleteAsync(ct);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public async Task DeleteExpired(DateTimeOffset now, CancellationToken ct) =>
        await db.PasswordResetTokens.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(ct);
}

public sealed class CalendarRepository(AdventDbContext db) : ICalendarRepository
{
    public async Task<IReadOnlyList<CalendarEntry>> List(Guid userId, CancellationToken ct) =>
        await db.CalendarEntries.AsNoTracking().Where(x => x.UserId == userId).ToArrayAsync(ct);

    public Task<CalendarEntry?> Find(Guid userId, int day, CancellationToken ct) =>
        db.CalendarEntries.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId && x.Day == day, ct);

    public async Task<DateTimeOffset> MarkOpened(Guid userId, int day, DateTimeOffset now, CancellationToken ct)
    {
        // Conditional SQL update preserves the first opening even with concurrent tabs.
        await db.CalendarEntries.Where(x => x.UserId == userId && x.Day == day && x.FirstOpenedAt == null && x.IsPublished)
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.FirstOpenedAt, now), ct);
        return await db.CalendarEntries.Where(x => x.UserId == userId && x.Day == day && x.IsPublished)
            .Select(x => x.FirstOpenedAt).SingleOrDefaultAsync(ct)
            ?? throw new AppException(404, "Cette surprise n'est plus publiée.");
    }

    public async Task Upsert(CalendarEntry entry, CancellationToken ct)
    {
        var existing = await db.CalendarEntries.FindAsync([entry.UserId, entry.Day], ct);
        if (existing is null) db.CalendarEntries.Add(entry);
        else
        {
            existing.Kind = entry.Kind;
            existing.Title = entry.Title;
            existing.Text = entry.Text;
            existing.Sticker = entry.Sticker;
            existing.IsPublished = entry.IsPublished;
            existing.BlocksJson = entry.BlocksJson;
            existing.DraftJson = null;
        }
    }

    public async Task SaveDraft(CalendarEntry entry, CancellationToken ct)
    {
        var existing = await db.CalendarEntries.FindAsync([entry.UserId, entry.Day], ct);
        if (existing is null) db.CalendarEntries.Add(entry);
        else existing.DraftJson = entry.DraftJson;
    }
}

public sealed class MediaRepository(AdventDbContext db) : IMediaRepository
{
    public void Add(CalendarMedia media) => db.CalendarMedia.Add(media);
    public Task<CalendarMedia?> Find(Guid userId, int day, Guid id, CancellationToken ct) =>
        db.CalendarMedia.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId && x.Day == day && x.Id == id, ct);
    public Task<bool> Exists(Guid userId, int day, Guid id, string type, CancellationToken ct) =>
        db.CalendarMedia.AnyAsync(x => x.UserId == userId && x.Day == day && x.Id == id && x.ContentType.StartsWith(type + "/"), ct);
    public async Task<IReadOnlyList<MediaInfo>> List(CancellationToken ct) =>
        await db.CalendarMedia.AsNoTracking().OrderBy(x => x.UserId).ThenBy(x => x.Day)
            .Select(x => new MediaInfo(x.Id, x.UserId, x.Day, x.ContentType, x.Data.Length)).ToListAsync(ct);
    public Task<CalendarMedia?> FindForUpdate(Guid id, CancellationToken ct) =>
        db.CalendarMedia.SingleOrDefaultAsync(x => x.Id == id, ct);
}

public sealed class SessionRepository(AdventDbContext db) : ISessionRepository
{
    public void Add(Session session) => db.Sessions.Add(session);
    public Task<User?> Resolve(string tokenHash, DateTimeOffset now, CancellationToken ct) =>
        (from session in db.Sessions.AsNoTracking()
         join user in db.Users.AsNoTracking() on session.UserId equals user.Id
         where session.TokenHash == tokenHash && session.ExpiresAt > now && user.IsActive
         select user).SingleOrDefaultAsync(ct);
    public async Task Revoke(string tokenHash, CancellationToken ct) =>
        await db.Sessions.Where(x => x.TokenHash == tokenHash).ExecuteDeleteAsync(ct);
    public async Task RevokeAll(Guid userId, CancellationToken ct)
    {
        var sessions = await db.Sessions.Where(x => x.UserId == userId).ToArrayAsync(ct);
        db.Sessions.RemoveRange(sessions);
    }
    public async Task DeleteExpired(DateTimeOffset now, CancellationToken ct) =>
        await db.Sessions.Where(x => x.ExpiresAt <= now).ExecuteDeleteAsync(ct);
}
