using System.Text.Json;
using Advent.Application;
using Advent.Infrastructure;

namespace Advent.Tests;

public sealed class ContentAndCredentialsTests
{
    internal static string Root
    {
        get
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Advent.slnx")))
                directory = directory.Parent;
            return directory?.FullName ?? throw new InvalidOperationException("Solution root not found.");
        }
    }

    internal static ContentDocument Content() =>
        JsonSerializer.Deserialize<ContentDocument>(
            File.ReadAllText(Path.Combine(Root, "content", "calendar.2026.json")),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    internal static ContentDocument Reviewed() => Content() with
    {
        People = Content().People.Select(person => person with
        {
            Entries = person.Entries.Select(entry => entry with { Reviewed = true }).ToArray()
        }).ToArray()
    };

    [Fact]
    public void DraftsContain72UniqueTextsAndValidStickers()
    {
        var document = Content();
        Assert.True(new ImportContentValidator().Validate(new ImportContentCommand(document, false)).IsValid);
        Assert.False(new ImportContentValidator().Validate(new ImportContentCommand(document, true)).IsValid);
        Assert.True(new ImportContentValidator().Validate(new ImportContentCommand(Reviewed(), true)).IsValid);
        var entries = document.People.SelectMany(x => x.Entries).ToArray();
        Assert.Equal(72, entries.Length);
        Assert.Equal(72, entries.Select(x => x.Text).Distinct().Count());
        foreach (var entry in entries)
            Assert.True(File.Exists(Path.Combine(Root, "frontend", "public", "stickers", entry.Sticker + ".webp")));
    }

    [Fact]
    public void DuplicateDayAndInvalidContentAreRejected()
    {
        var document = Content();
        var person = document.People[0];
        var entries = person.Entries.ToArray();
        entries[1] = entries[0] with { Kind = "html", Sticker = "../private", Text = "" };
        var invalid = document with { People = [person with { Entries = entries }, .. document.People.Skip(1)] };
        Assert.False(new ImportContentValidator().Validate(new ImportContentCommand(invalid, false)).IsValid);
    }

    [Theory]
    [InlineData("{\"year\":2026,\"people\":null}")]
    [InlineData("{\"year\":2026,\"people\":[null,null,null]}")]
    [InlineData("{\"year\":2026,\"people\":[{\"username\":\"louisa\",\"notes\":null,\"entries\":[null]}]}")]
    public void MalformedEditorialDocumentsAreRejectedWithoutCrashing(string json)
    {
        var document = JsonSerializer.Deserialize<ContentDocument>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.False(new ImportContentValidator().Validate(new ImportContentCommand(document, true)).IsValid);
    }

    [Fact]
    public void PasswordsUseRandomSaltAndVerifyWithoutPlaintext()
    {
        var service = new PasswordService();
        var secret = Guid.NewGuid().ToString("N");
        var first = service.Hash(secret);
        Assert.NotEqual(first, service.Hash(secret));
        Assert.DoesNotContain(secret, first);
        Assert.True(service.Verify(first, secret));
        Assert.False(service.Verify(first, "not-the-password"));
        Assert.False(service.Verify(null, secret));
        Assert.StartsWith("pbkdf2-sha256$600000$", first);
    }

    [Fact]
    public void SessionTokensAreUnpredictableAndHashed()
    {
        var service = new SessionTokens();
        var first = service.Create();
        Assert.Equal(64, first.Length);
        Assert.NotEqual(first, service.Create());
        Assert.NotEqual(first, service.Hash(first));
        Assert.Equal(service.Hash(first), service.Hash(first));
    }
}
