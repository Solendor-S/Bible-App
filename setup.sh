#!/bin/bash

# ══════════════════════════════════════════════════════════════════════════════
#  Bible App – macOS Setup
#  Mirrors the Windows setup.bat / setup.ps1 behaviour for Mac users.
# ══════════════════════════════════════════════════════════════════════════════

set -e

INSTALL_ROOT="$HOME/BibleApp"
APP_DIR="$INSTALL_ROOT/App"
UPDATER_DIR="$APP_DIR/updater"
REPO_URL="https://github.com/Solendor-S/Bible-App.git"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; GRAY='\033[0;37m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}  ✔ $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
info() { echo -e "${CYAN}  → $*${RESET}"; }
err()  { echo -e "${RED}  ✘ $*${RESET}"; }

bail() {
    echo ""
    err "$1"
    err "You must install all prerequisites to use this software."
    echo ""
    for i in 5 4 3 2 1; do
        echo -e "${GRAY}  Closing in $i...${RESET}"
        sleep 1
    done
    exit 1
}

# ── Helper: ask yes/no ────────────────────────────────────────────────────────
ask() {
    local prompt="$1"
    local answer
    read -r -p "$(echo -e "${CYAN}  $prompt (y/n): ${RESET}")" answer
    [[ "$answer" == "y" || "$answer" == "Y" ]]
}

# ── Helper: install via Homebrew or open download page ────────────────────────
install_prereq() {
    local name="$1"
    local brew_formula="$2"   # empty string = not brew-installable
    local manual_url="$3"

    echo ""
    if ! ask "Install $name now?"; then
        bail "$name is required but was not installed."
    fi

    if command -v brew &>/dev/null && [[ -n "$brew_formula" ]]; then
        info "Installing $name via Homebrew..."
        brew install "$brew_formula"
    else
        info "Opening download page for $name..."
        open "$manual_url" 2>/dev/null || true
        read -r -p "$(echo -e "${CYAN}  Install $name then press Enter to continue...${RESET}")"
    fi
}

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}========================================${RESET}"
echo -e "${CYAN}  Bible App – macOS Setup${RESET}"
echo -e "${CYAN}========================================${RESET}"
echo ""
info "Checking prerequisites..."
echo ""

# ── Node.js ───────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    err "Node.js not found."
    install_prereq "Node.js" "node" "https://nodejs.org"
    # Reload PATH (Homebrew installs to /opt/homebrew/bin on Apple Silicon)
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    if ! command -v node &>/dev/null; then
        bail "Node.js still not found. Please restart your terminal and run setup again."
    fi
fi
ok "Node.js $(node --version) found."
echo ""

# ── Git ───────────────────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
    err "Git not found."
    # On macOS, running git triggers Xcode Command Line Tools install prompt
    info "macOS may prompt you to install Xcode Command Line Tools (includes Git)."
    info "Accept that prompt, then re-run this script."
    xcode-select --install 2>/dev/null || true
    read -r -p "$(echo -e "${CYAN}  Press Enter once Git is installed...${RESET}")"
    if ! command -v git &>/dev/null; then
        bail "Git still not found. Please install it and run setup again."
    fi
fi
ok "Git $(git --version | awk '{print $3}') found."
echo ""

# ── Git LFS ───────────────────────────────────────────────────────────────────
if ! command -v git-lfs &>/dev/null; then
    err "Git LFS not found (required for the 93 MB database)."
    install_prereq "Git LFS" "git-lfs" "https://git-lfs.github.com"
    export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    if ! command -v git-lfs &>/dev/null; then
        bail "Git LFS still not found. Please install it and run setup again."
    fi
fi
ok "Git LFS found."
echo ""

# ── Homebrew (optional but recommended – not fatal if missing) ─────────────────
if ! command -v brew &>/dev/null; then
    warn "Homebrew not found. Some optional installs may need manual steps."
fi

# ══════════════════════════════════════════════════════════════════════════════
#  Clone repo
# ══════════════════════════════════════════════════════════════════════════════
if [[ ! -d "$APP_DIR" ]]; then
    echo ""
    info "Downloading app from GitHub (includes ~200 MB database)..."
    git lfs install 2>/dev/null || true
    git clone "$REPO_URL" "$INSTALL_ROOT"
    ok "Download complete."
else
    echo ""
    ok "Found existing install at $INSTALL_ROOT – skipping download."
fi

# ══════════════════════════════════════════════════════════════════════════════
#  Install app dependencies
# ══════════════════════════════════════════════════════════════════════════════
echo ""
info "Installing app dependencies..."
cd "$APP_DIR"
npm install || bail "npm install failed in App/."
ok "App dependencies installed."

# ══════════════════════════════════════════════════════════════════════════════
#  Install + build updater
# ══════════════════════════════════════════════════════════════════════════════
echo ""
info "Installing updater dependencies..."
cd "$UPDATER_DIR"
npm install || bail "npm install failed in App/updater/."
ok "Updater dependencies installed."

echo ""
info "Building updater (this may take a minute)..."
npm run package || bail "Updater build failed."
ok "Updater built successfully."

# ══════════════════════════════════════════════════════════════════════════════
#  Create desktop launcher (.command file – double-clickable on macOS)
# ══════════════════════════════════════════════════════════════════════════════
DESKTOP="$HOME/Desktop"
LAUNCHER="$DESKTOP/Bible Study.command"

cat > "$LAUNCHER" <<EOF
#!/bin/bash
# Bible Study App Launcher
cd "$APP_DIR"
npm run dev
EOF
chmod +x "$LAUNCHER"
ok "Desktop launcher created: $LAUNCHER"

# Updater launcher
UPDATER_BIN=$(find "$UPDATER_DIR/out" -name "BibleAppUpdater" -type f 2>/dev/null | head -1)
UPDATER_APP=$(find "$UPDATER_DIR/out" -name "BibleAppUpdater.app" -type d 2>/dev/null | head -1)

UPDATER_LAUNCHER="$DESKTOP/Bible App Updater.command"
if [[ -n "$UPDATER_APP" ]]; then
    cat > "$UPDATER_LAUNCHER" <<EOF
#!/bin/bash
open "$UPDATER_APP"
EOF
    chmod +x "$UPDATER_LAUNCHER"
    ok "Updater launcher created: $UPDATER_LAUNCHER"
elif [[ -n "$UPDATER_BIN" ]]; then
    cat > "$UPDATER_LAUNCHER" <<EOF
#!/bin/bash
"$UPDATER_BIN"
EOF
    chmod +x "$UPDATER_LAUNCHER"
    ok "Updater launcher created: $UPDATER_LAUNCHER"
else
    warn "Updater executable not found; skipping updater shortcut."
fi

# ══════════════════════════════════════════════════════════════════════════════
#  Optional: Ollama AI Scholar
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}========================================${RESET}"
echo -e "${CYAN}  Optional: AI Scholar (Ollama)${RESET}"
echo -e "${CYAN}========================================${RESET}"
echo ""
echo "  The AI Scholar lets you ask questions about scripture and the Church Fathers."
echo "  It runs locally using Ollama + gemma4 (~9 GB download). Nothing leaves your machine."
echo ""

if ask "Install Ollama and the AI model now?"; then
    if ! command -v ollama &>/dev/null; then
        info "Downloading Ollama..."
        if command -v brew &>/dev/null; then
            brew install ollama
        else
            # Fall back to official macOS installer
            TMP_PKG="/tmp/ollama-mac.pkg"
            curl -fSL "https://ollama.com/download/Ollama-darwin.zip" -o "/tmp/Ollama-darwin.zip"
            info "Ollama downloaded. Unzipping..."
            unzip -q "/tmp/Ollama-darwin.zip" -d "/tmp/OllamaInstall"
            APP_PATH=$(find /tmp/OllamaInstall -name "Ollama.app" | head -1)
            if [[ -n "$APP_PATH" ]]; then
                cp -r "$APP_PATH" /Applications/Ollama.app
                ok "Ollama.app installed to /Applications."
                open /Applications/Ollama.app
                info "Ollama is starting – wait a few seconds before pulling the model."
                sleep 8
            else
                warn "Could not auto-install Ollama. Visit https://ollama.com to install manually."
            fi
        fi
        export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
    else
        ok "Ollama already installed."
    fi

    if command -v ollama &>/dev/null; then
        info "Downloading gemma4 (~9 GB)..."
        ollama pull gemma4
        ok "gemma4 model ready."
    else
        warn "Run 'ollama pull gemma4' manually once Ollama is running."
    fi
else
    echo -e "${GRAY}  Skipping. Install later from https://ollama.com${RESET}"
fi

# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}========================================${RESET}"
echo -e "${GREEN}  Setup complete!${RESET}"
echo -e "${GREEN}========================================${RESET}"
echo ""
echo -e "  App installed to: ${CYAN}$INSTALL_ROOT${RESET}"
echo -e "  To launch: double-click ${CYAN}\"Bible Study\"${RESET} on your Desktop"
echo -e "             (or run ${CYAN}npm run dev${RESET} inside $APP_DIR)"
echo ""

if ask "Launch the app now?"; then
    cd "$APP_DIR"
    npm run dev
fi
