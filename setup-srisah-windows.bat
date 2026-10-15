@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title SriSah Schooling - Automatic Local Setup

echo.
echo ============================================================
echo  SriSah Schooling - Local PostgreSQL and app setup
echo ============================================================
echo This helper reads database-role passwords from .env.
echo It will prompt only for the PostgreSQL installer superuser password.
echo The helper does not install PostgreSQL itself.
echo.

if not exist "package.json" (
  echo ERROR: Put this BAT and setup-srisah-db.ps1 in the SriSah project root beside package.json.
  pause
  exit /b 1
)
if not exist "setup-srisah-db.ps1" (
  echo ERROR: setup-srisah-db.ps1 is missing. Extract both helper files into the project root.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is missing from PATH. Install Node.js 20+ and reopen this window.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is missing from PATH. Reinstall Node.js with npm enabled.
  pause
  exit /b 1
)

if not exist ".env" (
  if not exist ".env.example" (
    echo ERROR: .env.example is missing.
    pause
    exit /b 1
  )
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example.
  echo Set different POSTGRES_PASSWORD and APP_DB_PASSWORD values and their URLs.
  echo Also set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.
  start "Edit SriSah .env" notepad.exe "%CD%\.env"
  echo Save .env and run this BAT again.
  pause
  exit /b 0
)

if not exist "node_modules" (
  echo Installing npm dependencies...
  call npm ci
  if errorlevel 1 goto FAILED
)

echo.
echo STEP 1: Reading .env and configuring PostgreSQL roles/database.
echo The two role passwords come from .env; you will NOT be asked to enter them.
echo A hidden password prompt will ask only for the PostgreSQL superuser password
 echo you set when installing PostgreSQL (usually username postgres).
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-srisah-db.ps1"
if errorlevel 1 goto FAILED

echo.
echo STEP 2: Applying SriSah schema migrations.
call node db/migrate.js
if errorlevel 1 goto FAILED

echo.
echo STEP 3: Creating/updating the initial portal admin from .env.
call npm run bootstrap
if errorlevel 1 goto FAILED

echo.
echo Setup is complete. Starting npm run dev (API + web).
echo Open the Vite Local URL, usually http://localhost:5173.
echo Sign in with BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env.
echo.
call npm run dev
if errorlevel 1 goto FAILED
pause
endlocal
exit /b 0

:FAILED
echo.
echo Setup stopped. Review the error above and fix it before rerunning.
pause
exit /b 1
