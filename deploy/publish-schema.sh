#!/bin/sh
set -eu
exec dotnet sqlpackage /Action:Publish \
  /SourceFile:/source/database/bin/Release/Advent.Database.dacpac \
  /TargetServerName:sql /TargetDatabaseName:Advent2026 /TargetUser:sa \
  "/TargetPassword:${MSSQL_SA_PASSWORD:?SQL administrator password required}" \
  /TargetTrustServerCertificate:True /p:BlockOnPossibleDataLoss=True
