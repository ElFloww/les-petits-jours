using System.Security.Claims;
using Advent.Api.Middleware;
using Advent.Application;
using MediatR;
using Microsoft.AspNetCore.Http.Features;

namespace Advent.Api.Endpoints;

public sealed record PreviewSettings(bool Enabled);

public static class PreviewEndpoints
{
    public static void MapPreview(this WebApplication app)
    {
        if (!app.Services.GetRequiredService<PreviewSettings>().Enabled) return;

        var group = app.MapGroup("/api/preview/calendar").RequireAuthorization().WithTags("Atelier local");
        group.MapGet("/{day:int}", async (
            int day, ISender sender, ClaimsPrincipal user, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new PreviewEntryQuery(AuthenticationEndpoints.UserId(user), day), ct)))
            .RequireAuthorization().WithTags("Atelier local")
            .WithName("PreviewEntry").WithSummary("Prévisualiser sa case, même future ou en brouillon, sans l'ouvrir.")
            .WithDescription("Disponible uniquement en Development avec Preview:Enabled. Aucune donnée ni date n'est modifiée.")
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(404);

        group.MapPut("/{day:int}", async (
            int day, SaveGiftRequest request, ISender sender, ClaimsPrincipal user, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new SaveGiftCommand(AuthenticationEndpoints.UserId(user), day, request), ct)))
            .AddEndpointFilter<CsrfFilter>()
            .WithName("SaveGift").WithSummary("Enregistrer un brouillon séparé ou publier explicitement son cadeau.")
            .WithDescription("Atelier Development uniquement. La publication exige content.reviewed=true. Les ouvertures restent inchangées.")
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(413);

        group.MapPost("/{day:int}/media", async (
            int day, HttpRequest request, IGiftMedia media, ClaimsPrincipal user, CancellationToken ct) =>
        {
            if (request.ContentLength > GiftMedia.MaxBytes)
                throw new AppException(413, "Fichier trop volumineux : 300 Mo maximum.");
            var limit = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = GiftMedia.MaxBytes;
            var uploaded = await media.Upload(AuthenticationEndpoints.UserId(user), day,
                request.ContentType ?? "", request.Body, ct);
            return TypedResults.Created($"/api/preview/calendar/{day}/media/{uploaded.MediaId}", uploaded);
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("UploadGiftMedia").WithSummary("Importer un média privé pour cette personne et ce jour.")
            .WithDescription("Corps binaire brut et Content-Type du fichier. Images : 40 Mo ; vidéos et audio : 300 Mo (vidéos recompressées côté serveur si ffmpeg est présent). Atelier uniquement.")
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(413);

        group.MapGet("/{day:int}/media/{mediaId}", async (
            int day, string mediaId, IGiftMedia media, ClaimsPrincipal user, CancellationToken ct) =>
        {
            var file = await media.Read(AuthenticationEndpoints.UserId(user), day, mediaId, true, ct);
            return TypedResults.File(file.Data, file.ContentType, enableRangeProcessing: true);
        }).WithName("PreviewGiftMedia").WithSummary("Lire son média dans l'atelier, avant publication ou déverrouillage.")
            .Produces(200).Produces(206).ProducesProblem(400).ProducesProblem(401).ProducesProblem(404);
    }
}
