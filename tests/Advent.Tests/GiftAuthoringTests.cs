using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Advent.Application;
using Advent.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Advent.Tests;

public sealed class GiftAuthoringTests
{
    [Fact]
    public void RichContentValidationPreservesLongTextAndRejectsUnsafeOrIncompleteBlocks()
    {
        var validator = new ContentItemValidator();
        var content = new ContentItem(1, "surprise", "Un cadeau", new string('a', 50000), "sourire", false,
            [new("quote", "Une attention à partager.", Caption: "Pour toi")]);
        Assert.True(validator.Validate(content).IsValid);
        Assert.False(validator.Validate(content with { Text = new string('a', 50001) }).IsValid);
        Assert.True(validator.Validate(content with { Text = "" }).IsValid);
        Assert.False(validator.Validate(content with { Text = "", Blocks = [] }).IsValid);
        Assert.False(validator.Validate(content with { Blocks = [new("image", MediaId: "../secret", Caption: "Image")] }).IsValid);
        Assert.False(validator.Validate(content with { Blocks = [new("html", "<script>")] }).IsValid);
        Assert.False(validator.Validate(content with { Blocks = [new("video", MediaId: Guid.NewGuid().ToString("N"))] }).IsValid);
        Assert.False(validator.Validate(content with { Blocks = [null!] }).IsValid);
        Assert.False(validator.Validate(content with { Blocks = Enumerable.Repeat(new ContentBlock("text", "Texte"), 21).ToArray() }).IsValid);
        var save = new SaveGiftValidator();
        Assert.False(save.Validate(new SaveGiftCommand(Guid.NewGuid(), 1, new(content, true))).IsValid);
        Assert.True(save.Validate(new SaveGiftCommand(Guid.NewGuid(), 1, new(content with { Reviewed = true }, true))).IsValid);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task LocalComposerPersistsDraftsAndPrivateMediaWithoutChangingPublishedGiftsOrOpenings()
    {
        await using var fixture = new SqlFixture();
        await fixture.Initialize();
        using var owner = fixture.CreateClient();
        using var other = fixture.CreateClient();
        using var anonymous = fixture.CreateClient();
        await SqlApiTests.Login(owner, "louisa", fixture.Password);
        await SqlApiTests.Login(other, "orleane", fixture.Password);

        // Tiny valid PNG: no external content or runtime downloads.
        var image = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP7sAAAAASUVORK5CYII=");
        using var upload = await Upload(owner, image, "image/png");
        Assert.Equal(HttpStatusCode.Created, upload.StatusCode);
        var uploaded = (await upload.Content.ReadFromJsonAsync<UploadedMediaResponse>())!;
        var previewUrl = $"/api/preview/calendar/1/media/{uploaded.MediaId}";
        var publicUrl = $"/api/calendar/1/media/{uploaded.MediaId}";
        Assert.Equal(previewUrl, upload.Headers.Location!.OriginalString);
        Assert.Equal(image, await owner.GetByteArrayAsync(previewUrl));
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(previewUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(previewUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync(publicUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync(previewUrl.Replace("/1/", "/2/"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(owner, "<svg/>"u8.ToArray(), "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(owner, image, "image/svg+xml")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Upload(owner, image, "image/png", false)).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            (await Upload(owner, new byte[GiftMedia.MaxImageBytes + 1], "image/png")).StatusCode);

        var original = (await owner.GetFromJsonAsync<PreviewEntryResponse>("/api/preview/calendar/1"))!.Content;
        var content = new ContentItem(1, "surprise", "Noël en images", new string('x', 12000), "sourire", false,
            [new("quote", "Une petite attention, un grand sourire.", Caption: "Pour toi"), new("image", MediaId: uploaded.MediaId, Caption: "Notre petite lumière")]);
        Assert.Equal(HttpStatusCode.BadRequest, (await Save(owner, content, false, false)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Save(other, content, false)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Save(owner, content, true)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Save(owner, content, false)).StatusCode);
        var draft = (await owner.GetFromJsonAsync<PreviewEntryResponse>("/api/preview/calendar/1"))!;
        Assert.Equal(12000, draft.Content.Text.Length);
        Assert.Equal(uploaded.MediaId, draft.Content.Blocks![1].MediaId);
        Assert.False(draft.IsPublished);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
            var persisted = await db.CalendarEntries.SingleAsync(x => x.UserId == Guid.Parse("a1111111-1111-4111-8111-111111111111") && x.Day == 1);
            Assert.Equal(original.Text, persisted.Text);
            Assert.NotNull(persisted.DraftJson);
            Assert.Null(persisted.FirstOpenedAt);
        }

        Assert.Equal(HttpStatusCode.OK, (await Save(owner, content with { Reviewed = true }, true)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync(publicUrl)).StatusCode);
        fixture.Clock.Now = DateTimeOffset.Parse("2026-12-10T12:00:00Z");
        await fixture.RenewSessions();
        Assert.Equal(image, await owner.GetByteArrayAsync(publicUrl));
        using var range = new HttpRequestMessage(HttpMethod.Get, publicUrl);
        range.Headers.Range = new RangeHeaderValue(0, 7);
        using var partial = await owner.SendAsync(range);
        Assert.Equal(HttpStatusCode.PartialContent, partial.StatusCode);
        Assert.Equal(image[..8], await partial.Content.ReadAsByteArrayAsync());
        var opened = (await (await SqlApiTests.Open(owner, 1)).Content.ReadFromJsonAsync<EntryResponse>())!;
        Assert.NotNull(opened.FirstOpenedAt);
        var changed = content with { Title = "Un brouillon différent", Text = "Encore en préparation", Reviewed = false };
        Assert.Equal(HttpStatusCode.OK, (await Save(owner, changed, false)).StatusCode);
        var published = (await owner.GetFromJsonAsync<EntryResponse>("/api/calendar/1"))!;
        Assert.Equal(content.Title, published.Title);
        Assert.Equal(content.Text, published.Text);
        Assert.Equal(opened.FirstOpenedAt, published.FirstOpenedAt);
        Assert.Equal(changed.Title, (await owner.GetFromJsonAsync<PreviewEntryResponse>("/api/preview/calendar/1"))!.Content.Title);
        Assert.Equal(HttpStatusCode.OK, (await Save(owner, changed with { Reviewed = true, Blocks = [] }, true)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.GetAsync(publicUrl)).StatusCode);
        Assert.Equal(opened.FirstOpenedAt, (await owner.GetFromJsonAsync<EntryResponse>("/api/calendar/1"))!.FirstOpenedAt);
        Assert.Equal(image, await owner.GetByteArrayAsync(previewUrl));
        Assert.DoesNotContain(uploaded.MediaId, await owner.GetStringAsync("/api/calendar/"));
        var openApi = await owner.GetStringAsync("/openapi/v1.json");
        Assert.Contains("UploadGiftMedia", openApi);
        Assert.Contains("SaveGift", openApi);
    }

    private static async Task<HttpResponseMessage> Upload(HttpClient client, byte[] data, string contentType, bool csrf = true)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/preview/calendar/1/media") { Content = new ByteArrayContent(data) };
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        if (csrf) request.Headers.Add("X-CSRF-Token", await SqlApiTests.Csrf(client));
        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> Save(HttpClient client, ContentItem content, bool publish, bool csrf = true)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, $"/api/preview/calendar/{content.Day}") { Content = JsonContent.Create(new SaveGiftRequest(content, publish)) };
        if (csrf) request.Headers.Add("X-CSRF-Token", await SqlApiTests.Csrf(client));
        return await client.SendAsync(request);
    }
}
