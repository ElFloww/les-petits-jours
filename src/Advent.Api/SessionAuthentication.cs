using System.Security.Claims;
using System.Text.Encodings.Web;
using Advent.Application;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Advent.Api;

public sealed class SessionAuthentication(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger, UrlEncoder encoder,
    ISessionRepository sessions, ISessionTokens tokens, TimeProvider clock)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "AdventSession";
    public const string CookieName = "advent.session";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(CookieName, out var token))
            return AuthenticateResult.NoResult();
        if (token.Length != 64 || !token.All(Uri.IsHexDigit))
            return AuthenticateResult.Fail("Invalid session.");
        var hash = tokens.Hash(token);
        var user = await sessions.Resolve(hash, clock.GetUtcNow(), Context.RequestAborted);
        if (user is null) return AuthenticateResult.Fail("Expired session.");
        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim("session", hash)
        ], SchemeName);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }

    public static CookieOptions Cookie(IWebHostEnvironment environment, DateTimeOffset? expires = null) => new()
    {
        HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Strict,
        Path = "/", Expires = expires, IsEssential = true
    };
}
