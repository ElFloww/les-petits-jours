using System.Net;
using Advent.Api.Endpoints;
using Advent.Application;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Advent.Tests;

public sealed class PreviewExposureTests
{
    [Theory]
    [InlineData("Production", "true")]
    [InlineData("Production", "false")]
    [InlineData("Staging", "true")]
    [InlineData("Development", "false")]
    public async Task PreviewRoutesAreAbsentOutsideExplicitDevelopment(string environment, string enabled)
    {
        await using var app = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("ConnectionStrings:Advent", "Server=localhost;Database=Unused;Integrated Security=True");
            builder.UseSetting("Preview:Enabled", enabled);
        });
        using var client = app.CreateClient();
        Assert.False(app.Services.GetRequiredService<PreviewSettings>().Enabled);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/preview/calendar/24")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsync("/api/preview/calendar/24", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync("/api/preview/calendar/24/media", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/preview/calendar/24/media/" + Guid.NewGuid().ToString("N"))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/calendar/")).StatusCode);
        if (environment == "Development")
            Assert.DoesNotContain("/api/preview/", await client.GetStringAsync("/openapi/v1.json"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    public void PreviewQueriesValidateDayAndOwner(int day)
    {
        var validator = new PreviewEntryValidator();
        Assert.False(validator.Validate(new PreviewEntryQuery(Guid.NewGuid(), day)).IsValid);
        Assert.False(validator.Validate(new PreviewEntryQuery(Guid.Empty, 1)).IsValid);
        Assert.True(validator.Validate(new PreviewEntryQuery(Guid.NewGuid(), 24)).IsValid);
    }
}
