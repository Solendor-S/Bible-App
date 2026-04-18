# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary from across the early church. Optional AI scholar powered by Ollama (gemma4).

## Features

- **KJV Bible** — full text, navigable by book/chapter/verse
- **Church Fathers commentary** — 59,000+ entries from catenabible.com, CCEL Catena Aurea, and hand-curated sources; shown per verse sorted by era
- **Cross-references** — related verses shown inline
- **AI Scholar** — ask questions about the text and Fathers using a local Ollama model (no data leaves your machine)
- **Chat sessions** — persistent conversation history

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Git LFS](https://git-lfs.github.com/) — required to download the database file
- [Ollama](https://ollama.com/) — only needed for the AI Scholar feature

## Setup

```bash
# 1. Clone (LFS must be installed first)
git clone https://github.com/Solendor-S/bible-app.git
cd bible-app

# 2. Install dependencies
npm install

# 3. Run
npm run dev
```

## AI Scholar (optional)

The AI panel uses Ollama running locally. Install it from [ollama.com](https://ollama.com), then pull the model:

```bash
ollama pull gemma4
```

Make sure Ollama is running before opening the app. If it isn't running, the rest of the app works fine — the AI panel just shows a connection error.

## Rebuilding the Database

The compiled database (`data/bible.db`) is included via Git LFS. If you want to rebuild it from source:

```bash
# Rebuild from raw data files (all included in the repo)
npm run build-db

# Re-scrape commentary from catenabible.com (takes a long time)
npm run fetch-catenabible-api

# Re-fetch CCEL Catena Aurea
npm run fetch-ccel

# Fetch all sources then rebuild
npm run fetch-all
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
