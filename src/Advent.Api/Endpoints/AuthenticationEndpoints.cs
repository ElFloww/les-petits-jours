using System.Security.Claims;
using Advent.Api.Middleware;
using Advent.Application;
using MediatR;
using Microsoft.AspNetCore.Antiforgery;

namespace Advent.Api.Endpoints;

/// <summary>Email et mot de passe, jamais journalisés ni conservés en clair.</summary>
public sealed record LoginRequest(string? Email, string Password, string? Username = null);
public sealed record ForgotPasswordRequest(string Email);
public sealed record ResetPasswordRequest(string Token, string Password);
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
            var identifier = request.Email ?? request.Username ?? "";
            var result = await sender.Send(new LoginCommand(identifier, request.Password), ct);
            context.Response.Cookies.Append(SessionAuthentication.CookieName, result.Token,
                SessionAuthentication.Cookie(environment, result.ExpiresAt));
            return TypedResults.Ok(result.Account);
        }).AddEndpointFilter<CsrfFilter>().RequireRateLimiting("login")
            .WithName("Login").WithSummary("Ouvrir une session persistante de 30 jours.")
            .ProducesProblem(400).ProducesProblem(401).ProducesProblem(429);
        group.MapPost("/forgot-password", async (ForgotPasswordRequest request, ISender sender,
            IEmailSender email, ILoggerFactory loggerFactory, CancellationToken ct) =>
        {
            if (!email.IsConfigured)
                throw new AppException(503, "Le service d’envoi des emails n’est pas configuré.");
            try
            {
                await sender.Send(new ForgotPasswordCommand(request.Email), ct);
            }
            catch (EmailDeliveryException exception)
            {
                loggerFactory.CreateLogger("PasswordReset").LogError(exception, "Échec de l’envoi d’un email de réinitialisation.");
            }
            return TypedResults.Accepted((string?)null, new { message = "Si cette adresse correspond à un compte actif, un email de réinitialisation va être envoyé." });
        }).AddEndpointFilter<CsrfFilter>().RequireRateLimiting("password-reset")
            .WithName("ForgotPassword").WithSummary("Demander un lien de réinitialisation par email.")
            .ProducesProblem(400).ProducesProblem(429).ProducesProblem(503);
        group.MapPost("/reset-password", async (ResetPasswordRequest request, ISender sender, CancellationToken ct) =>
        {
            await sender.Send(new ResetPasswordCommand(request.Token, request.Password), ct);
            return TypedResults.NoContent();
        }).AddEndpointFilter<CsrfFilter>().RequireRateLimiting("password-reset")
            .WithName("ResetPassword").WithSummary("Définir un nouveau mot de passe à partir d’un lien à usage unique.")
            .ProducesProblem(400).ProducesProblem(429);
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
