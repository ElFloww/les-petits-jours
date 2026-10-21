#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
source="${1:?Usage: sh deploy/restore.sh /absolute/backup.bak --confirm-replace}"
test "${2:-}" = "--confirm-replace" || { echo "Explicit --confirm-replace required." >&2; exit 1; }
test -f "$source" || { echo "Backup not found." >&2; exit 1; }
docker compose -f compose.production.yaml stop proxy api
docker compose -f compose.production.yaml cp "$source" sql:/var/opt/mssql/advent-restore.bak
docker compose -f compose.production.yaml exec -T --user root sql sh -c 'chown mssql:root /var/opt/mssql/advent-restore.bak && chmod 600 /var/opt/mssql/advent-restore.bak'
docker compose -f compose.production.yaml exec -T sql sh -c '
  SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -Q "
    RESTORE VERIFYONLY FROM DISK = N'\''/var/opt/mssql/advent-restore.bak'\'' WITH CHECKSUM;
    ALTER DATABASE [Advent2026] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    BEGIN TRY
      RESTORE DATABASE [Advent2026] FROM DISK = N'\''/var/opt/mssql/advent-restore.bak'\'' WITH REPLACE, CHECKSUM;
      ALTER DATABASE [Advent2026] SET MULTI_USER;
    END TRY
    BEGIN CATCH
      ALTER DATABASE [Advent2026] SET MULTI_USER;
      THROW;
    END CATCH;
  "
'
docker compose -f compose.production.yaml --profile tools run --rm provision
docker compose -f compose.production.yaml up -d --wait api proxy
