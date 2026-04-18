# Bible App - Setup Script
# Automatically downloaded and run by setup.bat, or run directly:
#   powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = 'Stop'
$InstallRoot = Join-Path $env:USERPROFILE 'BibleApp'
$AppDir      = Join-Path $InstallRoot 'App'

function Bail($msg) {
    Write-Host ''
    Write-Host $msg -ForegroundColor Red
    Write-Host 'You must install all prerequisites to use this software.' -ForegroundColor Red
    for ($i = 5; $i -ge 1; $i--) {
        Write-Host "Closing in $i..." -ForegroundColor DarkGray
        Start-Sleep 1
    }
    exit 1
}

function Install-Prereq($name, $wingetId, $manualUrl) {
    Write-Host ''
    $ans = Read-Host "  Install $name now? (y/n)"
    if ($ans -ne 'y' -and $ans -ne 'Y') {
        Bail "  $name is required but was not installed."
    }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "  Installing $name via winget..." -ForegroundColor Yellow
        winget install --id $wingetId -e --accept-source-agreements --accept-package-agreements
    } else {
        Write-Host "  Opening download page for $name..." -ForegroundColor Yellow
        Start-Process $manualUrl
        Read-Host "  Install $name, then press Enter to continue"
    }

    # Refresh PATH so newly installed tools are found
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('PATH', 'User')
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '   Bible App - Setup' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# ── Prerequisites ─────────────────────────────────────────────────────────────
Write-Host 'Checking prerequisites...' -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '  Node.js not found.' -ForegroundColor Red
    Install-Prereq 'Node.js' 'OpenJS.NodeJS.LTS' 'https://nodejs.org'
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Bail '  Node.js still not found after install. Please restart and run setup again.'
    }
}
Write-Host ("  Node.js " + (node --version) + " found.") -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host '  Git not found.' -ForegroundColor Red
    Install-Prereq 'Git' 'Git.Git' 'https://git-scm.com'
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Bail '  Git still not found after install. Please restart and run setup again.'
    }
}
Write-Host '  Git found.' -ForegroundColor Green

if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
    Write-Host '  Git LFS not found.' -ForegroundColor Red
    Install-Prereq 'Git LFS' 'GitHub.GitLFS' 'https://git-lfs.github.com'
    if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
        Bail '  Git LFS still not found after install. Please restart and run setup again.'
    }
}
Write-Host '  Git LFS found.' -ForegroundColor Green

# ── Clone ─────────────────────────────────────────────────────────────────────
if (-not (Test-Path $AppDir)) {
    Write-Host ''
    Write-Host 'Downloading app from GitHub (includes ~200MB database - please wait)...' -ForegroundColor Yellow
    git lfs install 2>&1 | Out-Null
    git clone https://github.com/Solendor-S/Bible-App.git $InstallRoot
    if ($LASTEXITCODE -ne 0) { Bail 'Clone failed. Check your internet connection.' }
    Write-Host '  Download complete.' -ForegroundColor Green
} else {
    Write-Host ''
    Write-Host "  Found existing install at $InstallRoot - skipping download." -ForegroundColor Green
}

# ── npm install ───────────────────────────────────────────────────────────────
Write-Host ''
Write-Host 'Installing dependencies...' -ForegroundColor Yellow
Set-Location $AppDir
npm install
if ($LASTEXITCODE -ne 0) { Bail 'npm install failed.' }
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
        Write-Host '  Could not find ollama after install.' -ForegroundColor Yellow
        Write-Host '  Run "ollama pull gemma4" manually once Ollama is running.' -ForegroundColor Yellow
    }
} else {
    Write-Host '  Skipping. Install later from https://ollama.com' -ForegroundColor Gray
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '   Setup complete!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "App installed to: $InstallRoot" -ForegroundColor White
Write-Host 'To launch later: open a terminal, cd into the App folder, and run: npm run dev' -ForegroundColor White
Write-Host ''
$go = Read-Host 'Launch the app now? (y/n)'
if ($go -eq 'y' -or $go -eq 'Y') {
    Set-Location $AppDir
    npm run dev
}
