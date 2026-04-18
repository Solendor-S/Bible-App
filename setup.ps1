# Bible App - Setup Script
# Run with: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"
$AppDir = Join-Path $PSScriptRoot "App"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Bible App - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check Node.js ─────────────────────────────────────────────────────────
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Node.js is not installed." -ForegroundColor Red
    Write-Host "  Download it from: https://nodejs.org" -ForegroundColor White
    Write-Host "  Install Node.js then run this script again." -ForegroundColor White
    Read-Host "`nPress Enter to exit"
    exit 1
}
$nodeVersion = node --version
Write-Host "  Node.js $nodeVersion found." -ForegroundColor Green

# ── 2. Check Git ──────────────────────────────────────────────────────────────
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Git is not installed." -ForegroundColor Red
    Write-Host "  Download it from: https://git-scm.com" -ForegroundColor White
    Write-Host "  Install Git then run this script again." -ForegroundColor White
    Read-Host "`nPress Enter to exit"
    exit 1
}
Write-Host "  Git found." -ForegroundColor Green

# ── 3. Check Git LFS ─────────────────────────────────────────────────────────
if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "  Git LFS is not installed (needed for the database file)." -ForegroundColor Red
    Write-Host "  Download it from: https://git-lfs.github.com" -ForegroundColor White
    Write-Host "  Install Git LFS then run this script again." -ForegroundColor White
    Read-Host "`nPress Enter to exit"
    exit 1
}
Write-Host "  Git LFS found." -ForegroundColor Green

# ── 4. Clone repo if App folder is missing ───────────────────────────────────
if (-not (Test-Path $AppDir)) {
    Write-Host ""
    Write-Host "Downloading the app from GitHub (this includes a 200MB database - please wait)..." -ForegroundColor Yellow
    git lfs install
    git clone https://github.com/Solendor-S/Bible-App.git "$PSScriptRoot\_clone_tmp" 2>&1
    if (-not (Test-Path "$PSScriptRoot\_clone_tmp\App")) {
        Write-Host "Clone failed or unexpected repo structure." -ForegroundColor Red
        exit 1
    }
    Move-Item "$PSScriptRoot\_clone_tmp\App" $AppDir
    Remove-Item "$PSScriptRoot\_clone_tmp" -Recurse -Force
    Write-Host "  App downloaded." -ForegroundColor Green
} else {
    Write-Host "  App folder already present, skipping download." -ForegroundColor Green
}

# ── 5. Install npm dependencies ───────────────────────────────────────────────
Write-Host ""
Write-Host "Installing dependencies (npm install)..." -ForegroundColor Yellow
Push-Location $AppDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Write-Host "  Dependencies installed." -ForegroundColor Green
} finally {
    Pop-Location
}

# ── 6. Optional: Ollama / AI Scholar ─────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Optional: AI Scholar (Ollama)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "The app has an optional AI Scholar feature that lets you ask questions"
Write-Host "about scripture and the Church Fathers. It uses Ollama running locally"
Write-Host "(the gemma4 model, ~9GB download). Nothing is sent to the internet."
Write-Host ""
$installOllama = Read-Host "Install Ollama and download the AI model? (y/n)"

if ($installOllama -eq "y" -or $installOllama -eq "Y") {
    $ollamaInstalled = Get-Command ollama -ErrorAction SilentlyContinue

    if (-not $ollamaInstalled) {
        Write-Host ""
        Write-Host "Downloading Ollama installer..." -ForegroundColor Yellow
        $ollamaInstaller = "$env:TEMP\ollama-setup.exe"
        Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $ollamaInstaller
        Write-Host "Running Ollama installer..." -ForegroundColor Yellow
        Start-Process -FilePath $ollamaInstaller -Wait
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("PATH", "User")
    } else {
        Write-Host "  Ollama already installed." -ForegroundColor Green
    }

    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        Write-Host ""
        Write-Host "Downloading gemma4 model (~9GB, this will take a while)..." -ForegroundColor Yellow
        ollama pull gemma4
        Write-Host "  gemma4 ready." -ForegroundColor Green
    } else {
        Write-Host "  Could not find ollama after install. You can run 'ollama pull gemma4' manually later." -ForegroundColor Yellow
    }
} else {
    Write-Host "  Skipping Ollama. You can install it later from https://ollama.com" -ForegroundColor Gray
}

# ── 7. Done ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To launch the app, run:" -ForegroundColor White
Write-Host "  cd App" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""

$launch = Read-Host "Launch the app now? (y/n)"
if ($launch -eq "y" -or $launch -eq "Y") {
    Push-Location $AppDir
    npm run dev
    Pop-Location
}
