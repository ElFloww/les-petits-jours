#!/bin/sh
set -eu

secrets_dir=/run/advent-secrets
app_password="$(cat "$secrets_dir/app-db-password")"
if [ "${1:-}" = admin ] && [ "${2:-}" = provision-db ]; then
    sa_password="$(cat "$secrets_dir/sa-password")"
    export ConnectionStrings__Advent="Server=sql;Database=Advent2026;User Id=sa;Password=$sa_password;Encrypt=True;TrustServerCertificate=True"
    export APP_DB_PASSWORD="$app_password"
else
    export ConnectionStrings__Advent="Server=sql;Database=Advent2026;User Id=advent_app;Password=$app_password;Encrypt=True;TrustServerCertificate=True"
fi

exec dotnet Advent.Api.dll "$@"
