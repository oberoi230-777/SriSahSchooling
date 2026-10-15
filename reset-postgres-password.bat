@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
title PostgreSQL Local Password Reset

echo.
echo ============================================================
echo  PostgreSQL local superuser password reset
echo ============================================================
echo This changes only the PostgreSQL role named postgres.
echo It briefly permits trust authentication for 127.0.0.1 only,
echo resets the password, restores the original pg_hba.conf, and restarts the service.
echo.

if not exist "%~dp0reset-postgres-password.ps1" (
  echo ERROR: reset-postgres-password.ps1 is missing. Extract both files together.
  pause
  exit /b 1
)

net session >nul 2>nul
if errorlevel 1 (
  echo Please right-click this BAT and choose "Run as administrator".
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-postgres-password.ps1"
if errorlevel 1 (
  echo.
  echo The password reset did not complete. Read the PowerShell error above.
  pause
  exit /b 1
)
echo.
pause
endlocal
