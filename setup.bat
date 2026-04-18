@echo off
:: Bible App Setup - fully self-contained, no download needed

:: ── Request admin privileges ──────────────────────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: ── Write setup script to temp file ──────────────────────────────────────────
set PS=%TEMP%\bible-setup.ps1
(
echo $ErrorActionPreference = 'Stop'
echo $InstallRoot = Join-Path $env:USERPROFILE 'BibleApp'
echo $AppDir = Join-Path $InstallRoot 'App'
echo $UpdaterDir = Join-Path $AppDir 'updater'
echo.
echo function Bail^($msg^) {
echo     Write-Host ''
echo     Write-Host $msg -ForegroundColor Red
echo     Write-Host 'You must install all prerequisites to use this software.' -ForegroundColor Red
echo     for ^($i = 5; $i -ge 1; $i--^) {
echo         Write-Host "Closing in $i..." -ForegroundColor DarkGray
echo         Start-Sleep 1
echo     }
echo     exit 1
echo }
echo.
echo function Install-Prereq^($name, $wingetId, $manualUrl^) {
echo     Write-Host ''
echo     $ans = Read-Host "  Install $name now? (y/n)"
echo     if ^($ans -ne 'y' -and $ans -ne 'Y'^) { Bail "  $name is required but was not installed." }
echo     if ^(Get-Command winget -ErrorAction SilentlyContinue^) {
echo         Write-Host "  Installing $name via winget..." -ForegroundColor Yellow
echo         winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
echo     } else {
echo         Write-Host "  Opening download page for $name..." -ForegroundColor Yellow
echo         Start-Process $manualUrl
echo         Read-Host "  Install $name then press Enter to continue"
echo     }
echo     $env:PATH = [System.Environment]::GetEnvironmentVariable^('PATH','Machine'^) + ';' + [System.Environment]::GetEnvironmentVariable^('PATH','User'^)
echo }
echo.
echo Write-Host ''
echo Write-Host '========================================' -ForegroundColor Cyan
echo Write-Host '   Bible App - Setup' -ForegroundColor Cyan
echo Write-Host '========================================' -ForegroundColor Cyan
echo Write-Host ''
echo Write-Host 'Checking prerequisites...' -ForegroundColor Yellow
echo.
echo if ^(-not ^(Get-Command node -ErrorAction SilentlyContinue^)^) {
echo     Write-Host '  Node.js not found.' -ForegroundColor Red
echo     Install-Prereq 'Node.js' 'OpenJS.NodeJS.LTS' 'https://nodejs.org'
echo     if ^(-not ^(Get-Command node -ErrorAction SilentlyContinue^)^) { Bail 'Node.js still not found. Please restart and run setup again.' }
echo }
echo Write-Host ^("  Node.js " + ^(node --version^) + " found."^) -ForegroundColor Green
echo.
echo if ^(-not ^(Get-Command git -ErrorAction SilentlyContinue^)^) {
echo     Write-Host '  Git not found.' -ForegroundColor Red
echo     Install-Prereq 'Git' 'Git.Git' 'https://git-scm.com'
echo     if ^(-not ^(Get-Command git -ErrorAction SilentlyContinue^)^) { Bail 'Git still not found. Please restart and run setup again.' }
echo }
echo Write-Host '  Git found.' -ForegroundColor Green
echo.
echo if ^(-not ^(Get-Command git-lfs -ErrorAction SilentlyContinue^)^) {
echo     Write-Host '  Git LFS not found.' -ForegroundColor Red
echo     Install-Prereq 'Git LFS' 'GitHub.GitLFS' 'https://git-lfs.github.com'
echo     if ^(-not ^(Get-Command git-lfs -ErrorAction SilentlyContinue^)^) { Bail 'Git LFS still not found. Please restart and run setup again.' }
echo }
echo Write-Host '  Git LFS found.' -ForegroundColor Green
echo.
echo if ^(-not ^(Test-Path $AppDir^)^) {
echo     Write-Host ''
echo     Write-Host 'Downloading app from GitHub ^(includes ~200MB database^)...' -ForegroundColor Yellow
echo     git lfs install 2^>^&1 ^| Out-Null
echo     git clone https://github.com/Solendor-S/Bible-App.git $InstallRoot
echo     if ^($LASTEXITCODE -ne 0^) { Bail 'Clone failed. Check your internet connection.' }
echo     Write-Host '  Download complete.' -ForegroundColor Green
echo } else {
echo     Write-Host ''
echo     Write-Host "  Found existing install at $InstallRoot - skipping download." -ForegroundColor Green
echo }
echo.
echo Write-Host ''
echo Write-Host 'Installing app dependencies...' -ForegroundColor Yellow
echo Set-Location $AppDir
echo npm install
echo if ^($LASTEXITCODE -ne 0^) { Bail 'npm install failed.' }
echo Write-Host '  App dependencies installed.' -ForegroundColor Green
echo.
echo Write-Host ''
echo Write-Host 'Installing updater dependencies...' -ForegroundColor Yellow
echo Set-Location $UpdaterDir
echo npm install
echo if ^($LASTEXITCODE -ne 0^) { Bail 'Updater npm install failed.' }
echo Write-Host '  Updater dependencies installed.' -ForegroundColor Green
echo.
echo Write-Host ''
echo Write-Host 'Building updater ^(this may take a minute^)...' -ForegroundColor Yellow
echo Set-Location $UpdaterDir
echo npm run package
echo if ^($LASTEXITCODE -ne 0^) { Bail 'Updater build failed.' }
echo Write-Host '  Updater built successfully.' -ForegroundColor Green
echo.
echo # ── Create Desktop shortcut for updater ─────────────────────────────────
echo $UpdaterExe = Join-Path $UpdaterDir 'out\BibleAppUpdater-win32-x64\BibleAppUpdater.exe'
echo $DesktopUpdater = Join-Path ^([Environment]::GetFolderPath^('Desktop'^)^) 'Bible App Updater.lnk'
echo if ^(Test-Path $UpdaterExe^) {
echo     $wsh = New-Object -ComObject WScript.Shell
echo     $sc = $wsh.CreateShortcut^($DesktopUpdater^)
echo     $sc.TargetPath = $UpdaterExe
echo     $sc.Description = 'Check for Bible App updates'
echo     $sc.Save^(^)
echo     Write-Host "  Shortcut created: $DesktopUpdater" -ForegroundColor Green
echo } else {
echo     Write-Host '  Warning: updater exe not found, skipping Desktop shortcut.' -ForegroundColor Yellow
echo     Write-Host "  Expected at: $UpdaterExe" -ForegroundColor DarkGray
echo }
echo.
echo Write-Host ''
echo Write-Host '========================================' -ForegroundColor Cyan
echo Write-Host '   Optional: AI Scholar ^(Ollama^)' -ForegroundColor Cyan
echo Write-Host '========================================' -ForegroundColor Cyan
echo Write-Host ''
echo Write-Host 'The AI Scholar lets you ask questions about scripture and the Church Fathers.'
echo Write-Host 'It runs locally using Ollama + gemma4 ^(~9GB download^). Nothing leaves your machine.'
echo Write-Host ''
echo $ai = Read-Host 'Install Ollama and the AI model now? ^(y/n^)'
echo if ^($ai -eq 'y' -or $ai -eq 'Y'^) {
echo     if ^(-not ^(Get-Command ollama -ErrorAction SilentlyContinue^)^) {
echo         Write-Host 'Downloading Ollama...' -ForegroundColor Yellow
echo         $installer = "$env:TEMP\ollama-setup.exe"
echo         Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile $installer
echo         Start-Process -FilePath $installer -Wait
echo         $env:PATH = [System.Environment]::GetEnvironmentVariable^('PATH','Machine'^) + ';' + [System.Environment]::GetEnvironmentVariable^('PATH','User'^)
echo     } else { Write-Host '  Ollama already installed.' -ForegroundColor Green }
echo     if ^(Get-Command ollama -ErrorAction SilentlyContinue^) {
echo         Write-Host 'Downloading gemma4 ^(~9GB^)...' -ForegroundColor Yellow
echo         ollama pull gemma4
echo     } else { Write-Host '  Run "ollama pull gemma4" manually once Ollama is running.' -ForegroundColor Yellow }
echo } else { Write-Host '  Skipping. Install later from https://ollama.com' -ForegroundColor Gray }
echo.
echo Write-Host ''
echo Write-Host '========================================' -ForegroundColor Green
echo Write-Host '   Setup complete!' -ForegroundColor Green
echo Write-Host '========================================' -ForegroundColor Green
echo Write-Host ''
echo Write-Host "App installed to: $InstallRoot" -ForegroundColor White
echo Write-Host 'To launch the Bible App: cd into the App folder and run: npm run dev' -ForegroundColor White
echo Write-Host 'To check for updates:    use the "Bible App Updater" shortcut on your Desktop' -ForegroundColor White
echo Write-Host ''
echo $go = Read-Host 'Launch the app now? ^(y/n^)'
echo if ^($go -eq 'y' -or $go -eq 'Y'^) { Set-Location $AppDir; npm run dev }
) > "%PS%"

:: ── Run it ────────────────────────────────────────────────────────────────────
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS%"
pause
