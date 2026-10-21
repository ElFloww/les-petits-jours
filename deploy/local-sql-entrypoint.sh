#!/bin/bash
set -euo pipefail
umask 077

secrets_dir=/run/advent-secrets
mkdir -p "$secrets_dir"
for name in sa-password app-db-password; do
    if [ ! -s "$secrets_dir/$name" ]; then
        password="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')!Aa"
        printf '%s' "$password" > "$secrets_dir/$name"
    fi
    chmod 444 "$secrets_dir/$name"
done
chmod 755 "$secrets_dir"

export MSSQL_SA_PASSWORD
MSSQL_SA_PASSWORD="$(cat "$secrets_dir/sa-password")"
exec /opt/mssql/bin/sqlservr
