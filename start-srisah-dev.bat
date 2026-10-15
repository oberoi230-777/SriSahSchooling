@echo off
setlocal
cd /d "%~dp0"
title SriSah Schooling - Local Development

echo.
echo ================================================
echo  SriSah Schooling - Local Development
echo ================================================
echo.

if not exist "package.json" (
  echo ERROR: Put this .bat file in the SriSah project folder beside package.json.
  echo Do not put it in the unrelated ClipForge repository.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not on PATH. Install Node.js 20 LTS, then reopen this window.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is not installed or not on PATH. Reinstall Node.js 20 LTS with npm enabled.
  pause
  exit /b 1
)

if not exist ".env" (
  if not exist ".env.example" (
    echo ERROR: .env.example is missing. Restore the SriSah project files first.
    pause
    exit /b 1
  )
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example.
  echo Set PostgreSQL URLs and the BOOTSTRAP_ADMIN_* values in .env before continuing.
  echo The admin login is created by the one-time bootstrap command, not by Vite.
  start "Edit SriSah environment" notepad.exe "%CD%\.env"
  echo.
  echo Save .env, close Notepad, then run this .bat again.
  pause
  exit /b 0
)

if not exist "node_modules" (
  echo Installing locked npm dependencies...
  call npm ci
  if errorlevel 1 (
    echo ERROR: npm ci failed. Review the error above.
    pause
    exit /b 1
  )
)

echo.
echo Login setup:
echo  - Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in .env.
echo  - After PostgreSQL is running and the schema is migrated, run: npm run bootstrap
echo  - Use that email and password for the initial admin login.
echo  - Parents register using the family enrollment code; students and teachers are invited.
echo.

if /I "%~1"=="web" (
  echo Starting web frontend only: npm run dev:web
  echo The API and PostgreSQL must already be running for sign-in to work.
  call npm run dev:web
) else (
  echo Starting the full development stack: npm run dev
  call npm run dev
)

if errorlevel 1 (
  echo.
  echo The development command exited with an error. Check PostgreSQL, .env and the messages above.
)
echo.
pause
endlocal
