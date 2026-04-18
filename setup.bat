@echo off
:: Bible App - Self-contained setup script
:: Download this single file and double-click to install everything.
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw '%~f0') -replace '(?ms)^.*?^__POWERSHELL__\r?\n','')"
exit /b 0
__POWERSHELL__
$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:USERPROFILE 'BibleApp'
$AppDir      = Join-Path $InstallRoot 'App'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '   Bible App - Setup' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# ── Prerequisites ─────────────────────────────────────────────────────────────
Write-Host 'Checking prerequisites...' -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '  Node.js not found.' -ForegroundColor Red
    Write-Host '  Install from: https://nodejs.org  then run this file again.' -ForegroundColor White
    Read-Host 'Press Enter to exit'; exit 1
}
Write-Host ("  Node.js " + (node --version) + " found.") -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host '  Git not found.' -ForegroundColor Red
    Write-Host '  Install from: https://git-scm.com  then run this file again.' -ForegroundColor White
    Read-Host 'Press Enter to exit'; exit 1
}
Write-Host '  Git found.' -ForegroundColor Green

if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
    Write-Host '  Git LFS not found (needed for the database file).' -ForegroundColor Red
    Write-Host '  Install from: https://git-lfs.github.com  then run this file again.' -ForegroundColor White
    Read-Host 'Press Enter to exit'; exit 1
}
Write-Host '  Git LFS found.' -ForegroundColor Green

# ── Clone repo ────────────────────────────────────────────────────────────────
if (-not (Test-Path $AppDir)) {
    Write-Host ''
    Write-Host 'Downloading app from GitHub (includes ~200MB database - please wait)...' -ForegroundColor Yellow
    git lfs install 2>&1 | Out-Null
    git clone https://github.com/Solendor-S/Bible-App.git $InstallRoot
    if ($LASTEXITCODE -ne 0) { Write-Host 'Clone failed.' -ForegroundColor Red; exit 1 }
    Write-Host '  Download complete.' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host "  Found existing install at $InstallRoot — skipping download." -ForegroundColor Green
}

# ── npm install ───────────────────────────────────────────────────────────────
Write-Host ''
Write-Host 'Installing dependencies...' -ForegroundColor Yellow
Set-Location $AppDir
npm install
if ($LASTEXITCODE -ne 0) { Write-Host 'npm install failed.' -ForegroundColor Red; exit 1 }
Write-Host '  Dependencies installed.' -ForegroundColor Green

# ── Optional Ollama ───────────────────────────────────────────────────────────
Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '   Optional: AI Scholar (Ollama)' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'The AI Scholar lets you ask questions about scripture and the Church Fathers.'
Write-Host 'It runs entirely on your machine using Ollama + gemma4 (~9GB download).'
Write-Host 'Nothing is sent to the internet.'
Write-Host ''
$ai = Read-Host 'Install Ollama and the AI model now? (y/n)'

if ($ai -eq 'y' -or $ai -eq 'Y') {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host 'Downloading Ollama installer...' -ForegroundColor Yellow
        $installer = "$env:TEMP\ollama-setup.exe"
        Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile $installer
        Write-Host 'Running Ollama installer...' -ForegroundColor Yellow
        Start-Process -FilePath $installer -Wait
        $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('PATH','User')
    } else {
        Write-Host '  Ollama already installed.' -ForegroundColor Green
    }

    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        Write-Host 'Downloading gemma4 model (~9GB, this will take a while)...' -ForegroundColor Yellow
        ollama pull gemma4
        Write-Host '  gemma4 ready.' -ForegroundColor Green
    } else {
        Write-Host '  Could not detect ollama after install.' -ForegroundColor Yellow
        Write-Host '  Run "ollama pull gemma4" manually once Ollama is running.' -ForegroundColor Yellow
    }
} else {
    Write-Host '  Skipping. You can install Ollama later from https://ollama.com' -ForegroundColor Gray
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '   Setup complete!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "App installed to: $InstallRoot" -ForegroundColor White
Write-Host 'To launch later: open a terminal in the App folder and run: npm run dev' -ForegroundColor White
Write-Host ''
$go = Read-Host 'Launch the app now? (y/n)'
if ($go -eq 'y' -or $go -eq 'Y') {
    npm run dev
}
