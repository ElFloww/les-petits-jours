using Advent.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Advent.Api;

public sealed class DatabaseHealthCheck(IServiceScopeFactory scopes) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AdventDbContext>();
        var ready = await db.Users.AsNoTracking().CountAsync(ct) >= 3;
        return ready ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("Schema or seed is incomplete.");
    }
}
