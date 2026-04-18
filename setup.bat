@echo off
:: Bible App Setup
:: Downloads and runs the setup script from GitHub.

:: ── Request admin privileges ──────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ── Download setup.ps1 with curl (built into Windows 10+) ─────────────────────
echo.
echo Fetching setup script from GitHub...
curl -s -L -o "%TEMP%\bible-setup.ps1" "https://raw.githubusercontent.com/Solendor-S/Bible-App/main/setup.ps1"
if %errorLevel% neq 0 (
    echo Download failed. Check your internet connection.
    pause
    exit /b 1
)

:: ── Run it ────────────────────────────────────────────────────────────────────
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\bible-setup.ps1"
pause
