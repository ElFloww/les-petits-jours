using System.Security.Claims;
using Advent.Api.Middleware;
using Advent.Application;
using MediatR;
using Microsoft.AspNetCore.Http.Features;

namespace Advent.Api.Endpoints;

public sealed record ManagedUserPasswordRequest(string Password);
public sealed record ManagedUserActiveRequest(bool IsActive);

public static class AdministrationEndpoints
{
    public static void MapAdministration(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin/users")
            .RequireAuthorization(policy => policy.RequireClaim("admin", "true"))
            .WithTags("Administration des comptes");

        group.MapGet("/", async (ISender sender, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new ListManagedUsersQuery(), ct)))
            .WithName("ListUsers").WithSummary("Lister les comptes.");

        group.MapPost("/", async (CreateManagedUserCommand request, ISender sender, CancellationToken ct) =>
        {
            var user = await sender.Send(request, ct);
            return TypedResults.Created($"/api/admin/users/{user.Id}", user);
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("CreateUser").WithSummary("Créer un compte activé.")
            .ProducesProblem(400).ProducesProblem(409);

        group.MapPut("/{id:guid}", async (Guid id, UpdateManagedUserRequest request, ISender sender, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new UpdateManagedUserCommand(id, request.Email, request.DisplayName), ct)))
            .AddEndpointFilter<CsrfFilter>()
            .WithName("UpdateUser").WithSummary("Modifier l’adresse email et le nom affiché.")
            .ProducesProblem(400).ProducesProblem(404).ProducesProblem(409);

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal actor, ISender sender, CancellationToken ct) =>
        {
            await sender.Send(new DeleteManagedUserCommand(id, AuthenticationEndpoints.UserId(actor)), ct);
            return TypedResults.NoContent();
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("DeleteUser").WithSummary("Supprimer un compte et ses données associées.")
            .ProducesProblem(400).ProducesProblem(404);

        group.MapPut("/{id:guid}/password", async (Guid id, ManagedUserPasswordRequest request, ISender sender, CancellationToken ct) =>
        {
            await sender.Send(new SetManagedUserPasswordCommand(id, request.Password), ct);
            return TypedResults.NoContent();
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("SetUserPassword").WithSummary("Définir un mot de passe et révoquer les sessions du compte.")
            .ProducesProblem(400).ProducesProblem(404);

        group.MapPost("/{id:guid}/invitation", async (Guid id, ISender sender, IEmailSender email,
            ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            if (!email.IsConfigured)
                throw new AppException(503, "Le service d’envoi des emails n’est pas configuré.");
            try
            {
                await sender.Send(new SendCalendarInvitationCommand(id), ct);
            }
            catch (EmailDeliveryException exception)
            {
                loggerFactory.CreateLogger("CalendarInvitation").LogError(exception, "Échec de l’envoi d’une invitation au calendrier.");
                throw new AppException(503, "L’email d’invitation n’a pas pu être envoyé. Réessayez plus tard.");
            }
            return TypedResults.NoContent();
        }).AddEndpointFilter<CsrfFilter>().RequireRateLimiting("password-reset")
            .WithName("SendCalendarInvitation").WithSummary("Envoyer un lien d’invitation et de définition du mot de passe.")
            .ProducesProblem(400).ProducesProblem(404).ProducesProblem(429).ProducesProblem(503);

        group.MapPut("/{id:guid}/active", async (Guid id, ManagedUserActiveRequest request, ISender sender,
            ClaimsPrincipal actor, CancellationToken ct) =>
        {
            await sender.Send(new SetManagedUserActiveCommand(id, AuthenticationEndpoints.UserId(actor), request.IsActive), ct);
            return TypedResults.NoContent();
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("SetUserActive").WithSummary("Activer ou désactiver un compte.")
            .ProducesProblem(400).ProducesProblem(404);

        var gifts = app.MapGroup("/api/admin/gifts")
            .RequireAuthorization(policy => policy.RequireClaim("admin", "true"))
            .WithTags("Administration des cadeaux");

        gifts.MapGet("/{userId:guid}/{day:int}", async (Guid userId, int day, ISender sender, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new PreviewEntryQuery(userId, day), ct)))
            .WithName("GetManagedGift").WithSummary("Lire un cadeau ou son brouillon pour le modifier.")
            .ProducesProblem(400).ProducesProblem(404);

        gifts.MapPut("/{userId:guid}/{day:int}", async (
            Guid userId, int day, SaveGiftRequest request, ISender sender, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new SaveGiftCommand(userId, day, request), ct)))
            .AddEndpointFilter<CsrfFilter>()
            .WithName("SaveManagedGift").WithSummary("Enregistrer le brouillon ou publier un cadeau d’un compte.")
            .ProducesProblem(400).ProducesProblem(404).ProducesProblem(413);

        gifts.MapPost("/{userId:guid}/{day:int}/media", async (
            Guid userId, int day, HttpRequest request, IGiftMedia media, CancellationToken ct) =>
        {
            if (request.ContentLength > GiftMedia.MaxBytes)
                throw new AppException(413, "Fichier trop volumineux : 300 Mo maximum.");
            var limit = request.HttpContext.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = GiftMedia.MaxBytes;
            var uploaded = await media.Upload(userId, day, request.ContentType ?? "", request.Body, ct);
            return TypedResults.Created($"/api/admin/gifts/{userId}/{day}/media/{uploaded.MediaId}", uploaded);
        }).AddEndpointFilter<CsrfFilter>()
            .WithName("UploadManagedGiftMedia").WithSummary("Importer un média privé pour un cadeau.")
            .ProducesProblem(400).ProducesProblem(413);

        gifts.MapGet("/{userId:guid}/{day:int}/media/{mediaId}", async (
            Guid userId, int day, string mediaId, IGiftMedia media, CancellationToken ct) =>
        {
            var file = await media.Read(userId, day, mediaId, true, ct);
            return TypedResults.File(file.Data, file.ContentType, enableRangeProcessing: true);
        }).WithName("ReadManagedGiftMedia").WithSummary("Lire un média privé dans l’éditeur administrateur.")
            .Produces(200).Produces(206).ProducesProblem(400).ProducesProblem(404);
    }
}

public sealed record UpdateManagedUserRequest(string Email, string DisplayName);
