#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
destination="${1:?Usage: sh deploy/backup.sh /absolute/backup-directory}"
case "$destination" in /*) ;; *) echo "Use an absolute backup destination." >&2; exit 1 ;; esac
umask 077
mkdir -p "$destination"
name="Advent2026-$(date -u +%Y%m%dT%H%M%SZ).bak"
docker compose exec -T sql sh -c '
  SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b \
  -Q "BACKUP DATABASE [Advent2026] TO DISK = N'\''/var/opt/mssql/advent-backup.bak'\'' WITH COPY_ONLY, INIT, CHECKSUM; RESTORE VERIFYONLY FROM DISK = N'\''/var/opt/mssql/advent-backup.bak'\'' WITH CHECKSUM;"
'
docker compose cp sql:/var/opt/mssql/advent-backup.bak "$destination/$name"
chmod 600 "$destination/$name"
echo "Verified backup saved to $destination/$name. Transfer it to encrypted off-host storage."
