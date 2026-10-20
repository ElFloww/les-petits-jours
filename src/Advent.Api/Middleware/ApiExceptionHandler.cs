using Advent.Application;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;

namespace Advent.Api.Middleware;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception error, CancellationToken ct)
    {
        var (status, title) = error switch
        {
            AppException app => (app.Status, app.Message),
            ValidationException => (400, "Les données envoyées ne sont pas valides."),
            BadHttpRequestException { StatusCode: 413 } => (413, "Le contenu dépasse la taille autorisée."),
            BadHttpRequestException => (400, "La requête n'est pas valide."),
            _ => (500, "Un problème est survenu. Réessayez dans un instant.")
        };
        // Do not log request payloads, passwords or database exception messages.
        if (status >= 500) logger.LogError("API failure {ErrorType}; trace {TraceId}", error.GetType().Name, context.TraceIdentifier);
        else logger.LogWarning("API rejected request ({Status}); trace {TraceId}", status, context.TraceIdentifier);
        await Results.Problem(statusCode: status, title: title, extensions:
            new Dictionary<string, object?> { ["traceId"] = context.TraceIdentifier }).ExecuteAsync(context);
        return true;
    }
}
