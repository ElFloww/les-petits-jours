using Microsoft.AspNetCore.Antiforgery;

namespace Advent.Api.Middleware;

public sealed class CsrfFilter(IAntiforgery antiforgery, ILogger<CsrfFilter> logger) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            logger.LogWarning("Rejected antiforgery validation; trace {TraceId}", context.HttpContext.TraceIdentifier);
            return TypedResults.Problem(statusCode: 400, title: "La page a expiré. Actualisez-la puis réessayez.");
        }
        return await next(context);
    }
}
