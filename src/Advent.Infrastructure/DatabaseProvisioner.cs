using Microsoft.Data.SqlClient;

namespace Advent.Infrastructure;

public static class DatabaseProvisioner
{
    public static async Task Provision(string connectionString, string password, CancellationToken ct)
    {
        if (password.Length is < 24 or > 128) throw new Advent.Application.AppException(400, "APP_DB_PASSWORD doit contenir entre 24 et 128 caractères.");
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DECLARE @quoted NVARCHAR(258) = QUOTENAME(@password, '''');
            IF @quoted IS NULL THROW 50000, 'Password exceeds SQL Server limit.', 1;
            IF SUSER_ID(N'advent_app') IS NULL
                EXEC(N'CREATE LOGIN [advent_app] WITH PASSWORD = ' + @quoted + N', CHECK_POLICY = ON');
            ELSE
                EXEC(N'ALTER LOGIN [advent_app] WITH PASSWORD = ' + @quoted);
            IF USER_ID(N'advent_app') IS NULL CREATE USER [advent_app] FOR LOGIN [advent_app];
            GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[Users] TO [advent_app];
            GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[CalendarEntries] TO [advent_app];
            GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[CalendarMedia] TO [advent_app];
            GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::[dbo].[Sessions] TO [advent_app];
            """;
        command.Parameters.Add(new SqlParameter("@password", System.Data.SqlDbType.NVarChar, 128) { Value = password });
        await command.ExecuteNonQueryAsync(ct);
    }
}
