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

:: ── Download and run setup.ps1 from GitHub ───────────────────────────────────
echo.
echo Fetching setup script from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = $env:TEMP + '\bible-setup.ps1'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Solendor-S/Bible-App/main/setup.ps1' -OutFile $s; & $s"

pause
