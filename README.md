# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary sorted by era. Optional AI scholar powered by a local Ollama model — no data leaves your machine.

## Features

- **KJV Bible** — full text, navigable by book/chapter/verse with browser-style back/forward history
- **Church Fathers commentary** — 59,000+ entries from catenabible.com, CCEL Catena Aurea, and hand-curated sources; shown per verse, sorted chronologically
- **Word study** — click any word to see the underlying Greek (NT) or Hebrew (OT) with Strongs concordance entry
- **Cross-references** — related verses shown inline per selected verse
- **Parallel translations** — compare two translations side by side
- **Concordance** — search every occurrence of any word across the Bible
- **Nave's Topical Bible** — browse topics linked to any verse
- **Apocrypha** — full text of deuterocanonical books
- **Historical context** — Josephus and archaeological/manuscript references keyed to verses
- **Verse highlights** — color-code verses (Important, Conviction, Promise, Blessing)
- **Bookmarks** — save and revisit any verse
- **Notes** — attach personal notes to verses, organized in notebooks
- **Search** — full-text search across verses and Fathers commentary
- **Red-letter mode** — toggle Christ's words in red
- **AI Scholar** — ask questions about the text and Fathers using a local Ollama model
- **Chat sessions** — persistent AI conversation history
- **Built-in updater** — check and apply updates from within the app

## Setup

### Windows

1. Download **[setup.bat](setup.bat)** from this repo
2. Double-click it — it will install missing dependencies, clone the app, and optionally set up the AI

### macOS

1. Download **[setup.sh](setup.sh)** from this repo
2. Open Terminal, `cd` to your Downloads folder, and run:

```bash
chmod +x setup.sh && ./setup.sh
```

Both scripts handle everything automatically.

## Manual Setup

```bash
# Git LFS must be installed first (for the 93 MB database)
git lfs install
git clone https://github.com/Solendor-S/Bible-App.git ~/BibleApp
cd ~/BibleApp/App
npm install
npm run dev
```

## Updating

The app checks for updates on launch and shows a toast if a new version is available. Click **Launch Updater** to apply it automatically.

**macOS manual update** (run from anywhere):
```bash
cd ~/BibleApp && git fetch --no-tags origin main && git reset --hard origin/main && git lfs pull && rm -rf App/node_modules && npm install --prefix App
```

## AI Scholar (optional)

The AI panel uses Ollama running locally. Install [Ollama](https://ollama.com), then pull one of the supported models:

| Model | Quality | RAM needed |
|-------|---------|------------|
| `gemma4` | Best | ~12 GB |
| `gemma4:e2b` | Balanced | ~6 GB |
| `gemma3:4b` | Fast | ~3 GB |
| `qwen3:4b` | Fast | ~3 GB |
| `phi4-mini` | Lightest | ~2.5 GB |

```bash
ollama pull gemma4   # or any model from the table above
```

If Ollama isn't running, the rest of the app works fine without it.

## Rebuilding the Database

The compiled database (`App/data/bible.db`) is included via Git LFS. To rebuild from source:

```bash
cd App
npm run build-db                # Rebuild from included raw data files
npm run fetch-catenabible-api   # Re-scrape catenabible.com (slow)
npm run fetch-ccel              # Re-fetch CCEL Catena Aurea
npm run fetch-all               # Fetch all + rebuild
```

## Data Sources

| Source | Entries | Notes |
|--------|---------|-------|
| [catenabible.com](https://www.catenabible.com) | ~52,700 | Scraped via their API |
| [CCEL Catena Aurea](https://www.ccel.org) | ~6,600 | Aquinas's compilation |
| Hand-curated | ~55 | Selected excerpts |
| KJV text | 31,100 verses | Public domain |
| Cross-references | ~300,000 | From public dataset |

## Building a Distributable

```bash
cd App
npm run build     # Package + make installer for current platform
npm run package   # Package without making installers
```

Output goes to `App/out/`.

## Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **sql.js** (SQLite compiled to WebAssembly) for the database
- **Ollama** (local) for AI inference
