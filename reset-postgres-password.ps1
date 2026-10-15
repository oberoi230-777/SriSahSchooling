$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$trustInstalled = $false
$failure = $null
$restoreFailure = $null
$tempSql = $null
$newPlain = $null
$pointer = [IntPtr]::Zero
$service = $null
$hbaPath = $null
$backupPath = $null
$originalBytes = $null

function Wait-ForPostgresPort {
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $attempt = $client.BeginConnect('127.0.0.1', 5432, $null, $null)
            if ($attempt.AsyncWaitHandle.WaitOne(500)) {
                $client.EndConnect($attempt)
                return
            }
        } catch {
        } finally {
            $client.Close()
        }
        Start-Sleep -Milliseconds 300
    }
    throw 'PostgreSQL did not start listening on 127.0.0.1:5432 within 45 seconds.'
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run reset-postgres-password.bat as Administrator (right-click it, then Run as administrator).'
    }

    $services = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'postgresql*' })
    if ($services.Count -eq 0) { throw 'No PostgreSQL Windows service was found. Install PostgreSQL first.' }
    $runningServices = @($services | Where-Object { $_.State -eq 'Running' })
    if ($runningServices.Count -eq 1) { $service = $runningServices[0] }
    elseif ($services.Count -eq 1) { $service = $services[0] }
    else {
        Write-Host 'PostgreSQL services found:'
        for ($i = 0; $i -lt $services.Count; $i++) { Write-Host "  [$i] $($services[$i].Name) ($($services[$i].State))" }
        $selection = Read-Host 'Enter the number for the PostgreSQL instance listening on port 5432'
        $index = 0
        if (-not [int]::TryParse($selection, [ref]$index) -or $index -lt 0 -or $index -ge $services.Count) { throw 'Invalid service selection.' }
        $service = $services[$index]
    }

    $dataMatch = [regex]::Match($service.PathName, '(?i)-D\s+"([^"]+)"')
    if (-not $dataMatch.Success) { $dataMatch = [regex]::Match($service.PathName, '(?i)-D\s+([^\s]+)') }
    $dataDir = if ($dataMatch.Success) { $dataMatch.Groups[1].Value } else { $null }
    if (-not $dataDir -or -not (Test-Path -LiteralPath (Join-Path $dataDir 'pg_hba.conf'))) {
        $dataDir = Read-Host 'Enter the PostgreSQL data directory that contains pg_hba.conf'
    }
    $hbaPath = Join-Path $dataDir 'pg_hba.conf'
    if (-not (Test-Path -LiteralPath $hbaPath)) { throw "Could not find pg_hba.conf at $hbaPath" }

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
    if (-not $psqlPath) { throw 'psql.exe not found. Install PostgreSQL Command Line Tools or add its bin folder to PATH.' }

    Write-Host 'Choose a new PostgreSQL superuser password.' -ForegroundColor Cyan
    Write-Host 'Use 20+ URL-safe characters (A-Z, a-z, 0-9, hyphen or underscore).' -ForegroundColor Yellow
    Write-Host 'This changes only the PostgreSQL role named postgres; it does not change SriSah app-role passwords.' -ForegroundColor Yellow
    $secureOne = Read-Host 'New password (hidden)' -AsSecureString
    $secureTwo = Read-Host 'Confirm new password (hidden)' -AsSecureString
    if ($secureOne.Length -lt 20) { throw 'The new PostgreSQL password must be at least 20 characters.' }
    $ptrOne = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureOne)
    $ptrTwo = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureTwo)
    try {
        $newPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptrOne)
        $confirmPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptrTwo)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptrOne)
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptrTwo)
    }
    if ($newPlain -cne $confirmPlain) { throw 'The two passwords did not match.' }
    if ($newPlain -notmatch '^[A-Za-z0-9_-]{20,}$') { throw 'Use only A-Z, a-z, 0-9, hyphen and underscore so the password can be used safely in local connection URLs.' }
    $confirmPlain = $null

    $originalBytes = [System.IO.File]::ReadAllBytes($hbaPath)
    $originalText = [System.IO.File]::ReadAllText($hbaPath)
    $backupPath = "$hbaPath.srisah-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    [System.IO.File]::WriteAllBytes($backupPath, $originalBytes)
    $trustLine = 'host all postgres 127.0.0.1/32 trust'
    if ($originalText -match '(?im)^\s*host\s+all\s+postgres\s+127\.0\.0\.1/32\s+trust\s*(?:#.*)?$') {
        throw 'A localhost trust rule for postgres already exists in pg_hba.conf. Review that file and its backups before proceeding.'
    }

    if ($service.State -ne 'Running') {
        Write-Host "Starting PostgreSQL service $($service.Name)..." -ForegroundColor Yellow
        Start-Service -Name $service.Name
    }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    $trustInstalled = $true
    [System.IO.File]::WriteAllText($hbaPath, $trustLine + "`r`n" + $originalText, $utf8NoBom)
    Write-Host 'Temporarily allowing only local 127.0.0.1 password reset; restarting PostgreSQL...' -ForegroundColor Yellow
    Restart-Service -Name $service.Name -Force
    Wait-ForPostgresPort

    $sql = @'
\getenv reset_password SRI_RESET_PASSWORD
ALTER ROLE postgres WITH PASSWORD :'reset_password';
'@
    $tempSql = Join-Path $env:TEMP ('srisah-pg-reset-' + [guid]::NewGuid().ToString('N') + '.sql')
    [System.IO.File]::WriteAllText($tempSql, $sql, $utf8NoBom)
    $env:SRI_RESET_PASSWORD = $newPlain
    & $psqlPath -X -w -h '127.0.0.1' -p '5432' -U 'postgres' -d 'postgres' -v 'ON_ERROR_STOP=1' -f $tempSql
    if ($LASTEXITCODE -ne 0) { throw "psql could not update the postgres role (exit code $LASTEXITCODE)." }
    Write-Host 'PostgreSQL password updated. Restoring original pg_hba.conf now...' -ForegroundColor Green
} catch {
    $failure = $_.Exception.Message
} finally {
    if ($trustInstalled -and $hbaPath -and $originalBytes) {
        try {
            [System.IO.File]::WriteAllBytes($hbaPath, $originalBytes)
            if ($service) { Restart-Service -Name $service.Name -Force; Wait-ForPostgresPort }
            $trustInstalled = $false
        } catch {
            $restoreFailure = $_.Exception.Message
        }
    }
    Remove-Item Env:SRI_RESET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($tempSql) { Remove-Item -LiteralPath $tempSql -ErrorAction SilentlyContinue }
}

if ($restoreFailure) {
    Write-Host "CRITICAL: Could not restore/restart PostgreSQL configuration: $restoreFailure" -ForegroundColor Red
    Write-Host "Original pg_hba.conf backup: $backupPath" -ForegroundColor Red
    Write-Host 'Restore that backup to pg_hba.conf and restart the PostgreSQL service before exposing the database.' -ForegroundColor Red
    exit 2
}
if ($failure) {
    Write-Host "Password reset failed: $failure" -ForegroundColor Red
    if ($backupPath) { Write-Host "Original pg_hba.conf backup: $backupPath" }
    exit 1
}

try {
    $env:PGPASSWORD = $newPlain
    & $psqlPath -X -w -h '127.0.0.1' -p '5432' -U 'postgres' -d 'postgres' -v 'ON_ERROR_STOP=1' -c 'SELECT current_user;'
    if ($LASTEXITCODE -ne 0) { throw 'New password verification failed after pg_hba.conf was restored.' }
    Write-Host "SUCCESS: PostgreSQL superuser password reset and original pg_hba.conf restored." -ForegroundColor Green
    Write-Host "Backup kept at: $backupPath" -ForegroundColor Cyan
    Write-Host 'Use this new password only when the SriSah setup helper asks for the PostgreSQL superuser password.'
} catch {
    Write-Host "Password verification failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Keep the pg_hba.conf backup for recovery: $backupPath" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $newPlain = $null
}
