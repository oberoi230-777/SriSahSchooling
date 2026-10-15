$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
$envPath = Join-Path $projectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw "Missing .env in $projectRoot. Copy .env.example to .env first." }

# Normalize Markdown links that sometimes get pasted into .env from chat.
$rawLines = [System.IO.File]::ReadAllLines($envPath)
$cleanLines = New-Object 'System.Collections.Generic.List[string]'
foreach ($rawLine in $rawLines) {
    $line = $rawLine.TrimStart([char]0xFEFF)
    $line = [regex]::Replace($line, '\[([^\]]+)\]\([^)]+\)', '$1')
    $line = $line.Replace('&lt;', '<').Replace('&gt;', '>')
    $cleanLines.Add($line)
}

$settings = @{}
foreach ($line in $cleanLines) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $settings[$key] = $value
    }
}

$migratorPassword = $settings['POSTGRES_PASSWORD']
$appPassword = $settings['APP_DB_PASSWORD']
if ([string]::IsNullOrWhiteSpace($migratorPassword) -or [string]::IsNullOrWhiteSpace($appPassword)) {
    throw 'POSTGRES_PASSWORD and APP_DB_PASSWORD must both be set in .env.'
}
if ($migratorPassword -like 'replace-with-*' -or $appPassword -like 'replace-with-*') {
    throw 'Replace the sample PostgreSQL passwords in .env before running this helper.'
}
if ($migratorPassword -eq $appPassword) {
    throw 'Use two different passwords: POSTGRES_PASSWORD for the migrator role and APP_DB_PASSWORD for the app role.'
}
if ($migratorPassword -notmatch '^[A-Za-z0-9_-]{16,}$' -or $appPassword -notmatch '^[A-Za-z0-9_-]{16,}$') {
    throw 'For easy URL use, both PostgreSQL role passwords must be at least 16 characters using only A-Z, a-z, 0-9, underscore or hyphen.'
}
$adminEmail = $settings['BOOTSTRAP_ADMIN_EMAIL']
$adminPassword = $settings['BOOTSTRAP_ADMIN_PASSWORD']
if ([string]::IsNullOrWhiteSpace($adminEmail) -or [string]::IsNullOrWhiteSpace($adminPassword) -or $adminPassword -like 'replace-with-*') {
    throw 'Set BOOTSTRAP_ADMIN_EMAIL and a real BOOTSTRAP_ADMIN_PASSWORD in .env before setup.'
}
if ($adminPassword.Length -lt 12 -or $adminPassword -cnotmatch '[A-Z]' -or $adminPassword -cnotmatch '[a-z]' -or $adminPassword -notmatch '[0-9]') {
    throw 'BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters with uppercase, lowercase, and a number.'
}
$joinCode = $settings['BOOTSTRAP_JOIN_CODE']
if ([string]::IsNullOrWhiteSpace($joinCode) -or $joinCode -like 'replace-with-*') {
    $randomBytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($randomBytes) } finally { $rng.Dispose() }
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
    $joinCode = -join ($randomBytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
    Write-Host "Generated BOOTSTRAP_JOIN_CODE: $joinCode" -ForegroundColor Yellow
}
$dbName = $settings['POSTGRES_DB']
if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = 'srisah_schooling' }
if ($dbName -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw 'POSTGRES_DB must be a simple PostgreSQL identifier.' }

# Write clean local URLs so Markdown formatting or stale passwords cannot desynchronize them.
$updates = [ordered]@{
    'POSTGRES_DB' = $dbName
    'POSTGRES_USER' = 'srisah_migrator'
    'MIGRATION_DATABASE_URL' = "postgres://srisah_migrator:$migratorPassword@127.0.0.1:5432/$dbName"
    'DATABASE_URL' = "postgres://srisah_app:$appPassword@127.0.0.1:5432/$dbName"
    'PUBLIC_ORIGIN' = 'http://localhost:5173'
    'ALLOWED_ORIGINS' = 'http://localhost:5173,http://localhost:3001'
    'BOOTSTRAP_JOIN_CODE' = $joinCode
}
$remaining = [ordered]@{}
foreach ($key in $updates.Keys) { $remaining[$key] = $updates[$key] }
$finalLines = New-Object 'System.Collections.Generic.List[string]'
foreach ($line in $cleanLines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
        $key = $Matches[1]
        if ($remaining.Contains($key)) {
            $finalLines.Add("$key=$($remaining[$key])")
            $remaining.Remove($key)
            continue
        }
    }
    $finalLines.Add($line)
}
foreach ($key in $remaining.Keys) { $finalLines.Add("$key=$($remaining[$key])") }
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllLines($envPath, $finalLines.ToArray(), $utf8NoBom)
Write-Host 'Cleaned .env URL/origin formatting and synchronized the database URLs to its passwords.' -ForegroundColor Green

$adminUser = $settings['PG_ADMIN_USER']
if ([string]::IsNullOrWhiteSpace($adminUser)) { $adminUser = 'postgres' }
$psql = Get-Command 'psql.exe' -ErrorAction SilentlyContinue
$psqlPath = $null
if ($psql) { $psqlPath = $psql.Source }
if (-not $psqlPath) {
    $installRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    if (Test-Path $installRoot) {
        foreach ($version in (Get-ChildItem -LiteralPath $installRoot -Directory | Sort-Object Name -Descending)) {
            $candidate = Join-Path $version.FullName 'bin\psql.exe'
            if (Test-Path -LiteralPath $candidate) { $psqlPath = $candidate; break }
        }
    }
}
if (-not $psqlPath) { throw 'psql.exe was not found. Install PostgreSQL Command Line Tools or add its bin folder to PATH.' }

# Try starting a local PostgreSQL Windows service if it is installed but stopped.
$portTest = New-Object System.Net.Sockets.TcpClient
try {
    $connect = $portTest.BeginConnect('127.0.0.1', 5432, $null, $null)
    if (-not $connect.AsyncWaitHandle.WaitOne(2500)) { throw 'PostgreSQL is not listening on 127.0.0.1:5432.' }
    $portTest.EndConnect($connect)
} catch {
    $pgService = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
    if ($pgService -and $pgService.Status -ne 'Running') {
        Write-Host "Trying to start PostgreSQL service $($pgService.Name)..." -ForegroundColor Yellow
        try { Start-Service -Name $pgService.Name -ErrorAction Stop; Start-Sleep -Seconds 2 } catch {
            throw "Could not start $($pgService.Name). Start it in Services (services.msc), possibly as Administrator, then rerun this helper."
        }
    }
    $retry = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $retry.BeginConnect('127.0.0.1', 5432, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(2500)) { throw 'No PostgreSQL server is listening on 127.0.0.1:5432. Install/start PostgreSQL 16+ first.' }
        $retry.EndConnect($connect)
    } finally { $retry.Close() }
} finally { $portTest.Close() }

Write-Host "PostgreSQL superuser: $adminUser" -ForegroundColor Cyan
Write-Host 'Enter the password you chose for the PostgreSQL user during installation.' -ForegroundColor Yellow
Write-Host 'This is NOT POSTGRES_PASSWORD, APP_DB_PASSWORD, or BOOTSTRAP_ADMIN_PASSWORD.' -ForegroundColor Yellow
$secureAdminPassword = Read-Host "PostgreSQL password for '$adminUser'" -AsSecureString
if ($secureAdminPassword.Length -eq 0) { throw 'The PostgreSQL administrator password cannot be blank.' }
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureAdminPassword)
$tempSql = Join-Path $env:TEMP ("srisah-db-setup-" + [guid]::NewGuid().ToString('N') + '.sql')
try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $env:SRI_MIGRATOR_PASSWORD = $migratorPassword
    $env:SRI_APP_PASSWORD = $appPassword
    $env:SRI_DB_NAME = $dbName
    $sql = @'
\getenv migrator_password SRI_MIGRATOR_PASSWORD
\getenv app_password SRI_APP_PASSWORD
\getenv db_name SRI_DB_NAME
SELECT format('CREATE ROLE srisah_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'srisah_migrator')
\gexec
ALTER ROLE srisah_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'migrator_password';
SELECT format('CREATE ROLE srisah_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'srisah_app')
\gexec
ALTER ROLE srisah_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD :'app_password';
SELECT format('CREATE DATABASE %I OWNER srisah_migrator', :'db_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
SELECT format('ALTER DATABASE %I OWNER TO srisah_migrator', :'db_name')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO srisah_app', :'db_name')
\gexec
'@
    [System.IO.File]::WriteAllText($tempSql, $sql, $utf8NoBom)
    & $psqlPath -X -w -h '127.0.0.1' -p '5432' -U $adminUser -d 'postgres' -v 'ON_ERROR_STOP=1' -f $tempSql
    if ($LASTEXITCODE -ne 0) { throw "psql failed with exit code $LASTEXITCODE. Verify the PostgreSQL administrator password and the role setup output." }
    Write-Host 'PostgreSQL roles and database are ready. Role passwords were read from .env.' -ForegroundColor Green
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SRI_MIGRATOR_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SRI_APP_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:SRI_DB_NAME -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    Remove-Item -LiteralPath $tempSql -ErrorAction SilentlyContinue
}
