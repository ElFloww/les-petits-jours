namespace Advent.Domain;

public static class CalendarRules
{
    public const int Year = 2026;
    public static readonly TimeZoneInfo Paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");

    public static DateOnly Today(DateTimeOffset now) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, Paris).DateTime);

    public static bool IsAvailable(int day, DateTimeOffset now) =>
        day is >= 1 and <= 24 && Today(now) >= new DateOnly(Year, 12, day);

    public static DateTimeOffset UnlocksAt(int day)
    {
        var local = new DateTime(Year, 12, day, 0, 0, 0, DateTimeKind.Unspecified);
        return new DateTimeOffset(local, Paris.GetUtcOffset(local));
    }
}

public sealed class User
{
    public Guid Id { get; set; }
    public required string Username { get; set; }
    public string? Email { get; set; }
    public required string DisplayName { get; set; }
    public string? PasswordHash { get; set; }
    public bool IsActive { get; set; }
    public bool IsAdmin { get; set; }
}

public sealed class PasswordResetToken
{
    public required string TokenHash { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}

public sealed class CalendarEntry
{
    public Guid UserId { get; set; }
    public int Day { get; set; }
    public required string Kind { get; set; }
    public required string Title { get; set; }
    public required string Text { get; set; }
    public required string Sticker { get; set; }
    public string? BlocksJson { get; set; }
    public string? DraftJson { get; set; }
    public bool IsPublished { get; set; }
    public DateTimeOffset? FirstOpenedAt { get; set; }
}

public sealed class CalendarMedia
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int Day { get; set; }
    public required string ContentType { get; set; }
    public required byte[] Data { get; set; }
}

public sealed class Session
{
    public required string TokenHash { get; set; }
    public Guid UserId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
