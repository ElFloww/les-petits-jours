using System.Security.Claims;
using Advent.Api.Middleware;
using Advent.Application;
using MediatR;
using Microsoft.AspNetCore.Antiforgery;

namespace Advent.Api.Endpoints;

/// <summary>Identifiant et mot de passe, jamais journalisés ni conservés en clair.</summary>
public sealed record LoginRequest(string Username, string Password);
/// <summary>Jeton anti-CSRF à renvoyer dans X-CSRF-Token pour les requêtes POST.</summary>
public sealed record CsrfResponse(string Token);

public static class AuthenticationEndpoints
{
    public static void MapAuthentication(this WebApplication app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Session");
        group.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery, CancellationToken ct) =>
            TypedResults.Ok(new CsrfResponse(antiforgery.GetAndStoreTokens(context).RequestToken!)))
            .WithName("GetCsrf").WithSummary("Obtenir un jeton anti-CSRF.");
        group.MapPost("/login", async (LoginRequest request, ISender sender, HttpContext context,
            IWebHostEnvironment environment, CancellationToken ct) =>
        {
            var result = await sender.Send(new LoginCommand(request.Username, request.Password), ct);
            context.Response.Cookies.Append(SessionAuthentication.CookieName, result.Token,
                SessionAuthentication.Cookie(environment, result.ExpiresAt));
            return TypedResults.Ok(result.Account);
        }).AddEndpointFilter<CsrfFilter>().RequireRateLimiting("login")
            .WithName("Login").WithSummary("Ouvrir une session de huit heures.")
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(429);
        group.MapPost("/logout", async (ISender sender, HttpContext context,
            IWebHostEnvironment environment, CancellationToken ct) =>
        {
            await sender.Send(new LogoutCommand(context.User.FindFirstValue("session")!), ct);
            context.Response.Cookies.Delete(SessionAuthentication.CookieName, SessionAuthentication.Cookie(environment));
            return TypedResults.NoContent();
        }).RequireAuthorization().AddEndpointFilter<CsrfFilter>()
            .WithName("Logout").WithSummary("Révoquer la session courante côté serveur.").ProducesProblem(401);
        group.MapGet("/me", async (ISender sender, ClaimsPrincipal user, CancellationToken ct) =>
            TypedResults.Ok(await sender.Send(new AccountQuery(UserId(user)), ct)))
            .RequireAuthorization().WithName("GetAccount").WithSummary("Consulter son compte.").ProducesProblem(401);
    }

    public static Guid UserId(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
