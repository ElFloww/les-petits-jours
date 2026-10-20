using System.Net;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Advent.Api;
using Advent.Api.Endpoints;
using Advent.Api.Middleware;
using Advent.Application;
using Advent.Infrastructure;
using Autofac;
using Autofac.Extensions.DependencyInjection;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 512 * 1024);
var connection = builder.Configuration.GetConnectionString("Advent")
    ?? throw new InvalidOperationException("Configurez ConnectionStrings__Advent hors du dépôt.");
builder.Host.UseServiceProviderFactory(new AutofacServiceProviderFactory());
builder.Host.ConfigureContainer<ContainerBuilder>(container =>
{
    container.RegisterModule<ApplicationModule>();
    container.RegisterModule(new InfrastructureModule(connection));
});
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton(new PreviewSettings(
    builder.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Preview:Enabled")));
builder.Services.AddAuthentication(SessionAuthentication.SchemeName)
    .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, SessionAuthentication>(
        SessionAuthentication.SchemeName, _ => { });
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-Token";
    options.Cookie.Name = "advent.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
});
var protection = builder.Services.AddDataProtection().SetApplicationName("Advent2026");
if (builder.Configuration["DataProtection:Path"] is { Length: > 0 } keysPath)
    protection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    if (builder.Configuration["Proxy:Address"] is { Length: > 0 } proxy)
        options.KnownProxies.Add(IPAddress.Parse(proxy));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            }));
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path == "/api/auth/login"
            ? RateLimitPartition.GetFixedWindowLimiter("login-global", _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 30, Window = TimeSpan.FromMinutes(15), QueueLimit = 0 })
            : RateLimitPartition.GetNoLimiter("other"));
    options.OnRejected = async (context, ct) =>
    {
        var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
            ? (int)Math.Ceiling(retryAfter.TotalSeconds) : 60;
        context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        await Microsoft.AspNetCore.Http.Results.Problem(statusCode: 429,
            title: "Trop de tentatives. Patientez avant de réessayer.").ExecuteAsync(context.HttpContext);
    };
});
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNameCaseInsensitive = false;
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    options.SerializerOptions.AllowDuplicateProperties = false;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

var app = builder.Build();
if (args.FirstOrDefault() == "admin")
{
    Environment.ExitCode = await AdminCli.Run(app.Services, args.Skip(1).ToArray(), app.Lifetime.ApplicationStopping);
    return;
}
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    await next(context);
});
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapAuthentication();
app.MapCalendar();
app.MapPreview();
app.MapHealthChecks("/health");
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.Run();

public partial class Program;
