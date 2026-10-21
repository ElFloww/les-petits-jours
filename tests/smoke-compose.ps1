$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$project = "advent-smoke-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$env:MSSQL_SA_PASSWORD = [guid]::NewGuid().ToString('N') + '!Aa7'
$env:APP_DB_PASSWORD = [guid]::NewGuid().ToString('N') + '!Aa8'
$env:ADVENT_PASSWORD = [guid]::NewGuid().ToString('N') + '!Aa9'
$env:SITE_DOMAIN = 'localhost'

function Compose {
    & docker compose -p $project -f .\compose.production.yaml -f .\tests\compose.smoke.yaml @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed: $($args[0])" }
}

try {
    Compose --profile tools build
    Compose up -d --wait sql
    Compose --profile tools run --rm schema
    Compose --profile tools run --rm provision
    Compose run --rm -e ADVENT_PASSWORD api admin set-password louisa
    Compose run --rm api admin import /content/calendar.2026.json
    Compose up -d --wait api frontend proxy

    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    # Only the disposable localhost Caddy CA is trusted by this smoke client.
    $handler.ServerCertificateCustomValidationCallback = [System.Net.Http.HttpClientHandler]::DangerousAcceptAnyServerCertificateValidator
    $client = New-Object System.Net.Http.HttpClient($handler)
    $client.BaseAddress = [uri]'https://localhost:18443'
    $homepage = $client.GetStringAsync('/').GetAwaiter().GetResult()
    if ($homepage -notmatch 'Les petits jours') { throw 'Wrong frontend served.' }
    $token = ($client.GetStringAsync('/api/auth/csrf').GetAwaiter().GetResult() | ConvertFrom-Json).token
    $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, '/api/auth/login')
    $request.Headers.Add('X-CSRF-Token', $token)
    $body = @{ username = 'louisa'; password = $env:ADVENT_PASSWORD } | ConvertTo-Json
    $request.Content = New-Object System.Net.Http.StringContent($body, [System.Text.Encoding]::UTF8, 'application/json')
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 200) { throw "Production login failed: $($response.StatusCode)" }
    $cookies = $response.Headers.GetValues('Set-Cookie') -join ';'
    if ($cookies -notmatch '(?i)secure' -or $cookies -notmatch '(?i)httponly') { throw 'Secure cookie missing.' }
    $calendar = $client.GetStringAsync('/api/calendar/').GetAwaiter().GetResult() | ConvertFrom-Json
    if ($calendar.days.Count -ne 24) { throw 'Calendar must contain exactly 24 days.' }
    $noCsrf = $client.PostAsync('/api/auth/logout', $null).GetAwaiter().GetResult()
    if ([int]$noCsrf.StatusCode -ne 400) { throw 'CSRF protection missing.' }

    Compose restart api
    Compose up -d --wait api
    $account = $client.GetStringAsync('/api/auth/me').GetAwaiter().GetResult() | ConvertFrom-Json
    if ($account.username -ne 'louisa') { throw 'Session was not persisted across API restart.' }
    node .\tests\sql-smoke.mjs $project backup
    if ($LASTEXITCODE -ne 0) { throw 'SQL backup failed.' }
    Compose stop proxy api
    node .\tests\sql-smoke.mjs $project restore
    if ($LASTEXITCODE -ne 0) { throw 'SQL restore failed.' }
    Compose up -d --wait api proxy
    $restored = $client.GetStringAsync('/api/calendar/').GetAwaiter().GetResult() | ConvertFrom-Json
    if ($restored.days.Count -ne 24) { throw 'Restored calendar is incomplete.' }
    Write-Output 'PASS: HTTPS, secure login, CSRF, 24 days, persisted sessions, SQL backup and restore.'
    $client.Dispose()
} finally {
    & docker compose -p $project -f .\compose.production.yaml -f .\tests\compose.smoke.yaml --profile tools down -v --remove-orphans --rmi local
    Remove-Item Env:\MSSQL_SA_PASSWORD, Env:\APP_DB_PASSWORD, Env:\ADVENT_PASSWORD, Env:\SITE_DOMAIN
}
