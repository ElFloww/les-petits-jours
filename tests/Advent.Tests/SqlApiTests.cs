using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Advent.Application;
using Advent.Infrastructure;
using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Advent.Tests;

public sealed class SqlApiTests
{
    [Fact]
    [Trait("Category", "Integration")]
    public async Task RealSqlServerProtectsSessionsDatesPublicationAndOwnership()
    {
        await using var fixture = new SqlFixture();
        await fixture.Initialize();
        using var anonymous = fixture.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/calendar/")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/preview/calendar/24")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/openapi/v1.json")).StatusCode);

        using var louisa = fixture.CreateClient();
        using var orleane = fixture.CreateClient();
        using var thomas = fixture.CreateClient();
        var cookie = await Login(louisa, "louisa", fixture.Password);
        await Login(orleane, "orleane", fixture.Password);
        await Login(thomas, "thomas", fixture.Password);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        var calendar = await louisa.GetFromJsonAsync<CalendarResponse>("/api/calendar/");
        Assert.Equal(24, calendar!.Days.Count);
        Assert.True(calendar.CanPreview);
        Assert.All(calendar.Days, day => Assert.Equal("locked", day.State));
        Assert.Equal(HttpStatusCode.Forbidden, (await louisa.GetAsync("/api/calendar/1")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await louisa.GetAsync("/api/calendar/24?preview=true")).StatusCode);
        foreach (var (client, username) in new[] { (louisa, "louisa"), (orleane, "orleane"), (thomas, "thomas") })
        {
            var expected = ContentAndCredentialsTests.Content().People.Single(person => person.Username == username);
            foreach (var content in expected.Entries)
            {
                var preview = await client.GetFromJsonAsync<PreviewEntryResponse>($"/api/preview/calendar/{content.Day}");
                Assert.Equal(content.Text, preview!.Content.Text);
                Assert.Equal(content.Sticker, preview.Content.Sticker);
                Assert.False(preview.IsPublished);
                Assert.Null(preview.Content.FirstOpenedAt);
            }
        }
        var ownPreview = await louisa.GetStringAsync("/api/preview/calendar/24");
        Assert.Equal(ownPreview, await louisa.GetStringAsync("/api/preview/calendar/24?userId=b2222222-2222-4222-8222-222222222222"));
        Assert.DoesNotContain("sharedMemories", ownPreview);
        Assert.Equal(HttpStatusCode.BadRequest, (await louisa.GetAsync("/api/preview/calendar/25")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await louisa.GetAsync("/api/preview/calendar/0")).StatusCode);
        Assert.All((await louisa.GetFromJsonAsync<CalendarResponse>("/api/calendar/"))!.Days,
            day => Assert.Equal("locked", day.State));

        fixture.Clock.Now = DateTimeOffset.Parse("2026-11-30T23:00:00Z");
        // Keep sessions alive when moving the test clock, without extra login attempts.
        await fixture.RenewSessions();
        calendar = await louisa.GetFromJsonAsync<CalendarResponse>("/api/calendar/");
        Assert.Equal("available", calendar!.Days[0].State);
        Assert.Equal("locked", calendar.Days[1].State);
        Assert.Equal(HttpStatusCode.NotFound, (await louisa.GetAsync("/api/calendar/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Open(louisa, 1)).StatusCode);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
            Assert.All(await db.CalendarEntries.ToArrayAsync(), entry => Assert.Null(entry.FirstOpenedAt));
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ImportContentCommand(ContentAndCredentialsTests.Reviewed(), true));
        }
        Assert.True((await louisa.GetFromJsonAsync<PreviewEntryResponse>("/api/preview/calendar/24"))!.IsPublished);
        fixture.Clock.Now = DateTimeOffset.Parse("2026-12-10T12:00:00Z");
        await fixture.RenewSessions();
        calendar = await louisa.GetFromJsonAsync<CalendarResponse>("/api/calendar/");
        Assert.Equal(10, calendar!.Days.Count(day => day.State == "available"));
        var rawCalendar = await louisa.GetStringAsync("/api/calendar/");
        Assert.DoesNotContain("text", rawCalendar, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("notes", rawCalendar, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.Forbidden, (await Open(louisa, 11)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await louisa.GetAsync("/api/calendar/25")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await louisa.PostAsync("/api/calendar/1/open", null)).StatusCode);

        var first = await (await Open(louisa, 1)).Content.ReadFromJsonAsync<EntryResponse>();
        Assert.NotNull(first!.FirstOpenedAt);
        var reread = await (await Open(louisa, 1)).Content.ReadFromJsonAsync<EntryResponse>();
        Assert.Equal(first, reread);
        var other = await orleane.GetFromJsonAsync<EntryResponse>("/api/calendar/1");
        var third = await thomas.GetFromJsonAsync<EntryResponse>("/api/calendar/1");
        Assert.NotEqual(first.Text, other!.Text);
        Assert.NotEqual(first.Text, third!.Text);
        Assert.Null(other.FirstOpenedAt);
        Assert.Null(third.FirstOpenedAt);
        var forged = await louisa.GetFromJsonAsync<EntryResponse>(
            "/api/calendar/1?userId=b2222222-2222-4222-8222-222222222222");
        Assert.Equal(first, forged);
        Assert.DoesNotContain("sharedMemories", await louisa.GetStringAsync("/api/calendar/1"));
        await Task.WhenAll(Open(louisa, 2), Open(louisa, 2));
        var concurrent = await louisa.GetFromJsonAsync<EntryResponse>("/api/calendar/2");
        Assert.NotNull(concurrent!.FirstOpenedAt);
        var stable = await louisa.GetStringAsync("/api/calendar/");
        Assert.Equal(stable, await louisa.GetStringAsync("/api/calendar/"));

        var token = await Csrf(louisa);
        var logout = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logout.Headers.Add("X-CSRF-Token", token);
        Assert.Equal(HttpStatusCode.NoContent, (await louisa.SendAsync(logout)).StatusCode);
        using var replay = fixture.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        replay.DefaultRequestHeaders.Add("Cookie", cookie.Split(';')[0]);
        Assert.Equal(HttpStatusCode.Unauthorized, (await replay.GetAsync("/api/auth/me")).StatusCode);

        using (var scope = fixture.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(new DisableAccountCommand("orleane"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await orleane.GetAsync("/api/calendar/")).StatusCode);
        fixture.Clock.Now = fixture.Clock.Now.AddDays(31);
        Assert.Equal(HttpStatusCode.Unauthorized, (await thomas.GetAsync("/api/auth/me")).StatusCode);

        using var invalid = fixture.CreateClient();
        var unknown = await TryLogin(invalid, "unknown", "wrong");
        var wrong = await TryLogin(invalid, "thomas", "wrong");
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal((await unknown.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString(),
            (await wrong.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.TooManyRequests, (await TryLogin(invalid, "thomas", "wrong")).StatusCode);

        await fixture.PublishSchema();
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
            Assert.Equal(4, await db.Users.CountAsync());
            Assert.Equal(72, await db.CalendarEntries.CountAsync());
            Assert.NotNull((await db.CalendarEntries.SingleAsync(x => x.UserId == Guid.Parse("a1111111-1111-4111-8111-111111111111") && x.Day == 1)).FirstOpenedAt);
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task AdminCanManageUsersAndResetPasswordsByEmail()
    {
        await using var fixture = new SqlFixture();
        await fixture.Initialize();
        using (var scope = fixture.Services.CreateScope())
        {
            var sender = scope.ServiceProvider.GetRequiredService<ISender>();
            await sender.Send(new InitializeDefaultAdminCommand("admin@localhost.test", "Advent2026!Local"));
            await sender.Send(new InitializeDefaultAdminCommand(null, null));
        }

        using var admin = fixture.CreateClient();
        var cookie = await Login(admin, "admin@localhost.test", "Advent2026!Local");
        Assert.Contains("expires=", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/users/")).StatusCode);
        using var anonymous = fixture.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/users/")).StatusCode);

        var create = new HttpRequestMessage(HttpMethod.Post, "/api/admin/users/")
        {
            Content = JsonContent.Create(new { email = "ami@example.com", displayName = "Ami", password = fixture.Password })
        };
        create.Headers.Add("X-CSRF-Token", await Csrf(admin));
        var created = await admin.SendAsync(create);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var user = (await created.Content.ReadFromJsonAsync<ManagedUserResponse>())!;

        var invitation = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/users/{user.Id}/invitation");
        invitation.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(invitation)).StatusCode);
        Assert.Equal("ami@example.com", fixture.Email.LastInvitationEmail);
        var invitationLink = new Uri(fixture.Email.LastInvitationLink!);
        var invitationToken = Uri.UnescapeDataString(invitationLink.Query["?resetToken=".Length..]);
        const string invitationPassword = "invitation-password-secure!";
        var invitationReset = new HttpRequestMessage(HttpMethod.Post, "/api/auth/reset-password")
        {
            Content = JsonContent.Create(new { token = invitationToken, password = invitationPassword })
        };
        invitationReset.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(invitationReset)).StatusCode);

        var adminUser = (await admin.GetFromJsonAsync<ManagedUserResponse[]>("/api/admin/users/"))!
            .Single(x => x.IsAdmin && x.IsActive);
        var selfDelete = new HttpRequestMessage(HttpMethod.Delete, $"/api/admin/users/{adminUser.Id}");
        selfDelete.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.SendAsync(selfDelete)).StatusCode);

        using var member = fixture.CreateClient();
        await Login(member, "ami@example.com", invitationPassword);
        var louisa = (await admin.GetFromJsonAsync<ManagedUserResponse[]>("/api/admin/users/"))!
            .Single(x => x.Username == "louisa");
        Assert.Equal(HttpStatusCode.Forbidden,
            (await member.GetAsync($"/api/admin/gifts/{louisa.Id}/1")).StatusCode);
        var saveGift = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/gifts/{louisa.Id}/1")
        {
            Content = JsonContent.Create(new
            {
                content = new
                {
                    day = 1, kind = "surprise", title = "Un cadeau préparé par l’administration",
                    text = "Un petit mot à découvrir.", sticker = "sourire", reviewed = true, blocks = (object?)null
                },
                publish = true
            })
        };
        saveGift.Headers.Add("X-CSRF-Token", await Csrf(admin));
        var savedGift = await admin.SendAsync(saveGift);
        Assert.Equal(HttpStatusCode.OK, savedGift.StatusCode);
        Assert.True((await savedGift.Content.ReadFromJsonAsync<PreviewEntryResponse>())!.IsPublished);

        var update = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/users/{user.Id}")
        {
            Content = JsonContent.Create(new { email = "nouvelle@example.com", displayName = "Nouvel ami" })
        };
        update.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.OK, (await admin.SendAsync(update)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await member.GetAsync("/api/auth/me")).StatusCode);
        await Login(member, "nouvelle@example.com", invitationPassword);

        var forgot = new HttpRequestMessage(HttpMethod.Post, "/api/auth/forgot-password")
        {
            Content = JsonContent.Create(new { email = "nouvelle@example.com" })
        };
        forgot.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.Accepted, (await admin.SendAsync(forgot)).StatusCode);
        var link = new Uri(fixture.Email.LastLink!);
        var token = Uri.UnescapeDataString(link.Query["?resetToken=".Length..]);
        var reset = new HttpRequestMessage(HttpMethod.Post, "/api/auth/reset-password")
        {
            Content = JsonContent.Create(new { token, password = "a-new-and-secure-password" })
        };
        reset.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(reset)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await member.GetAsync("/api/auth/me")).StatusCode);
        await Login(member, "nouvelle@example.com", "a-new-and-secure-password");
        Assert.Equal(HttpStatusCode.OK, (await member.GetAsync("/api/auth/me")).StatusCode);

        var saveOwnGift = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/gifts/{user.Id}/1")
        {
            Content = JsonContent.Create(new
            {
                content = new
                {
                    day = 1, kind = "surprise", title = "À supprimer avec le compte",
                    text = "Ce cadeau ne doit pas rester orphelin.", sticker = "sourire", reviewed = true, blocks = (object?)null
                },
                publish = true
            })
        };
        saveOwnGift.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.OK, (await admin.SendAsync(saveOwnGift)).StatusCode);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
            Assert.Contains(await db.CalendarEntries.ToArrayAsync(), entry => entry.UserId == user.Id);
        }

        var disable = new HttpRequestMessage(HttpMethod.Put, $"/api/admin/users/{user.Id}/active")
        {
            Content = JsonContent.Create(new { isActive = false })
        };
        disable.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(disable)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await member.GetAsync("/api/auth/me")).StatusCode);

        var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/admin/users/{user.Id}");
        delete.Headers.Add("X-CSRF-Token", await Csrf(admin));
        Assert.Equal(HttpStatusCode.NoContent, (await admin.SendAsync(delete)).StatusCode);
        Assert.DoesNotContain((await admin.GetFromJsonAsync<ManagedUserResponse[]>("/api/admin/users/"))!,
            managed => managed.Id == user.Id);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
            Assert.DoesNotContain(await db.CalendarEntries.ToArrayAsync(), entry => entry.UserId == user.Id);
            Assert.Null(await db.Users.FindAsync(user.Id));
        }
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task DevelopmentStartupCreatesDefaultAdminWhenNoUsersExist()
    {
        await using var fixture = new SqlFixture();
        await fixture.PublishSchema();
        await fixture.ClearUsers();

        using var admin = fixture.CreateClient();
        await Login(admin, "admin@localhost.test", "Advent2026!Local");
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
        var user = await db.Users.SingleAsync();
        Assert.Equal("admin@localhost.test", user.Email);
        Assert.True(user.IsAdmin);
        Assert.True(user.IsActive);
    }

    internal static async Task<string> Csrf(HttpClient client) =>
        (await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf")).GetProperty("token").GetString()!;

    private static async Task<HttpResponseMessage> TryLogin(HttpClient client, string username, string password)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { username, password }) };
        request.Headers.Add("X-CSRF-Token", await Csrf(client));
        return await client.SendAsync(request);
    }

    internal static async Task<string> Login(HttpClient client, string username, string password)
    {
        var result = username.Contains('@')
            ? await TryLoginEmail(client, username, password)
            : await TryLogin(client, username, password);
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var account = (await result.Content.ReadFromJsonAsync<AccountResponse>())!;
        if (!username.Contains('@')) Assert.Equal(username, account.Username);
        return result.Headers.GetValues("Set-Cookie").Single(value => value.StartsWith("advent.session="));
    }

    private static async Task<HttpResponseMessage> TryLoginEmail(HttpClient client, string email, string password)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { email, password }) };
        request.Headers.Add("X-CSRF-Token", await Csrf(client));
        return await client.SendAsync(request);
    }

    internal static async Task<HttpResponseMessage> Open(HttpClient client, int day)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/calendar/{day}/open");
        request.Headers.Add("X-CSRF-Token", await Csrf(client));
        return await client.SendAsync(request);
    }
}

internal sealed class MutableClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.Parse("2026-11-30T22:59:59Z");
    public override DateTimeOffset GetUtcNow() => Now;
}

internal sealed class FakeEmailSender : IEmailSender
{
    public bool IsConfigured => true;
    public string PasswordResetBaseUrl => "https://example.test/";
    public string? LastLink { get; private set; }
    public string? LastInvitationLink { get; private set; }
    public string? LastInvitationEmail { get; private set; }

    public Task SendPasswordReset(string email, string displayName, string link, CancellationToken ct)
    {
        LastLink = link;
        return Task.CompletedTask;
    }

    public Task SendCalendarInvitation(string email, string displayName, string link, CancellationToken ct)
    {
        LastInvitationEmail = email;
        LastInvitationLink = link;
        return Task.CompletedTask;
    }
}

internal sealed class SqlFixture : WebApplicationFactory<Program>
{
    private readonly string databaseName = "AdventTest_" + Guid.NewGuid().ToString("N");
    private readonly string server = Environment.GetEnvironmentVariable("ADVENT_TEST_SQL")
        ?? @"Server=.\SQLEXPRESS;Integrated Security=True;Encrypt=True;TrustServerCertificate=True";
    public string Password { get; } = Guid.NewGuid().ToString("N") + "!aA7";
    public FakeEmailSender Email { get; } = new();
    public MutableClock Clock { get; } = new();
    private string ConnectionString => new SqlConnectionStringBuilder(server) { InitialCatalog = databaseName }.ConnectionString;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Advent", ConnectionString);
        builder.UseSetting("Preview:Enabled", "true");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Email);
        });
    }

    public async Task Initialize()
    {
        await PublishSchema();
        using var scope = Services.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        foreach (var username in ContentCatalog.Usernames)
            await sender.Send(new SetPasswordCommand(username, Password));
        await sender.Send(new ImportContentCommand(ContentAndCredentialsTests.Content(), false));
    }

    public async Task RenewSessions()
    {
        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AdventDbContext>().Sessions
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.ExpiresAt, Clock.Now.AddHours(8)));
    }

    public async Task PublishSchema()
    {
        var start = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = ContentAndCredentialsTests.Root,
            RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false
        };
        foreach (var argument in new[] { "sqlpackage", "/Action:Publish",
            "/SourceFile:" + Path.Combine(ContentAndCredentialsTests.Root, "database", "bin", "Debug", "Advent.Database.dacpac"),
            "/TargetConnectionString:" + ConnectionString, "/p:BlockOnPossibleDataLoss=True" })
            start.ArgumentList.Add(argument);
        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        Assert.True(process.ExitCode == 0, await stdout + await stderr);
    }

    public async Task ClearUsers()
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM [dbo].[Users]";
        await command.ExecuteNonQueryAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        SqlConnection.ClearAllPools();
        await using var connection = new SqlConnection(new SqlConnectionStringBuilder(server) { InitialCatalog = "master" }.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"IF DB_ID(N'{databaseName}') IS NOT NULL BEGIN ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]; END";
        await command.ExecuteNonQueryAsync();
    }
}
