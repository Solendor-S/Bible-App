# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary from across the early church. Optional AI scholar powered by Ollama (gemma4).

## Features

- **KJV Bible** — full text, navigable by book/chapter/verse
- **Church Fathers commentary** — 59,000+ entries from catenabible.com, CCEL Catena Aurea, and hand-curated sources; shown per verse sorted by era
- **Cross-references** — related verses shown inline
- **AI Scholar** — ask questions about the text and Fathers using a local Ollama model (no data leaves your machine)
- **Chat sessions** — persistent conversation history

## Quick Setup (Windows)

1. Download **[setup.bat](setup.bat)** from this repo
2. Double-click it — it will ask to install any missing dependencies, clone the app, and optionally set up the AI

That's it. The script handles everything.

## Manual Setup

```bash
# Git LFS must be installed first (for the 93MB database)
git clone https://github.com/Solendor-S/Bible-App.git
cd Bible-App/App
npm install
npm run dev
```

## AI Scholar (optional)

The AI panel uses Ollama running locally — no data leaves your machine. Install [Ollama](https://ollama.com), then:

```bash
ollama pull gemma4
```

If Ollama isn't running, the rest of the app still works fine.

## Rebuilding the Database

The compiled database (`App/data/bible.db`) is included via Git LFS. To rebuild from source:

```bash
cd App
npm run build-db          # Rebuild from included raw data files
npm run fetch-catenabible-api  # Re-scrape catenabible.com (slow)
npm run fetch-ccel        # Re-fetch CCEL Catena Aurea
npm run fetch-all         # Fetch all + rebuild
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
npm run build     # Package for current platform
npm run package   # Package without making installers
```

Output goes to `out/`.

## Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **better-sqlite3** for the database
- **Ollama** (local) for AI inference
