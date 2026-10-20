using System.Security.Claims;
using Advent.Api.Middleware;
using Advent.Application;
using MediatR;

namespace Advent.Api.Endpoints;

public static class CalendarEndpoints
{
    public static void MapCalendar(this WebApplication app)
    {
        var group = app.MapGroup("/api/calendar").RequireAuthorization().WithTags("Calendrier");
        group.MapGet("/", async (ISender sender, ClaimsPrincipal user, PreviewSettings preview, CancellationToken ct) =>
            TypedResults.Ok((await sender.Send(new CalendarQuery(AuthenticationEndpoints.UserId(user)), ct))
                with { CanPreview = preview.Enabled }))
            .WithName("GetCalendar").WithSummary("Lire les 24 états de son calendrier, sans les surprises.");
        group.MapGet("/{day:int}", async (int day, ISender sender, ClaimsPrincipal user, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new EntryQuery(AuthenticationEndpoints.UserId(user), day), ct)))
            .WithName("GetEntry").WithSummary("Lire une surprise disponible sans enregistrer d'ouverture.")
            .ProducesProblem(400).ProducesProblem(403).ProducesProblem(404);
        group.MapPost("/{day:int}/open", async (int day, ISender sender, ClaimsPrincipal user, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new OpenEntryCommand(AuthenticationEndpoints.UserId(user), day), ct)))
            .AddEndpointFilter<CsrfFilter>().WithName("OpenEntry").WithSummary("Ouvrir une case ou la relire, de façon idempotente.")
            .ProducesProblem(400).ProducesProblem(403).ProducesProblem(404);
        group.MapGet("/{day:int}/media/{mediaId}", async (
            int day, string mediaId, IGiftMedia media, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var file = await media.Read(AuthenticationEndpoints.UserId(user), day, mediaId, false, ct);
            return TypedResults.File(file.Data, file.ContentType, enableRangeProcessing: true);
        }).WithName("GetGiftMedia").WithSummary("Lire un média de son cadeau publié et déverrouillé, sans enregistrer d'ouverture.")
            .Produces(200).Produces(206).ProducesProblem(400).ProducesProblem(401).ProducesProblem(403).ProducesProblem(404);
    }
}
