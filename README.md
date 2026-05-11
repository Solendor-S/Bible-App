# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary sorted chronologically by era. Optional AI scholar powered by a local Ollama model — no data leaves your machine.

## Features

- **KJV Bible** — full text, navigable by book/chapter/verse with browser-style back/forward history
- **Book browser** — dropdown grouped by category (Torah, Gospels, Epistles, Prophets, etc.) alongside the passage search bar
- **Church Fathers commentary** — 59,000+ entries from catenabible.com, CCEL Catena Aurea, and hand-curated sources; shown per verse, sorted chronologically
- **Overview tab** — verse notes, chapter summaries with themes, and pericope (passage grouping) context sourced from bibleref.com
- **Word study** — click any word to see the underlying Greek (NT) or Hebrew (OT) with Strongs concordance, BDB/Thayer's lexicon entries, morphology, and textual variants
- **Cross-references** — related verses shown inline per selected verse
- **Parallel translations** — compare two translations side by side
- **Concordance** — search every occurrence of any word across the Bible
- **Nave's Topical Bible** — browse topics linked to any verse
- **Apocrypha** — full text of deuterocanonical books
- **Historical context** — Josephus (*Antiquities* and *Jewish War*) keyed to verses
- **Maps** — biblical geography referenced to the selected passage
- **Councils & Heresies** — reference tables of ecumenical councils and early church heresies
- **Verse highlights** — color-code verses (Important, Conviction, Promise, Blessing)
- **Bookmarks** — save and revisit any verse
- **Notes** — attach personal notes to verses, organised in notebooks
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
# Git LFS must be installed first (for the database)
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

**Windows manual update** (run from anywhere in PowerShell):
```powershell
cd "$env:USERPROFILE\BibleApp"; git fetch --no-tags origin main; git reset --hard origin/main; git lfs pull; if (Test-Path App\node_modules) { Remove-Item -Recurse -Force App\node_modules }; npm install --prefix App
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

## Data Sources

### Scripture & Cross-References

| Source | Content | Notes |
|--------|---------|-------|
| KJV text | 31,100 verses | Public domain |
| Cross-references | ~340,000 | Public domain dataset |
| Parallel translations | ESV, NASB, NIV, ASV, YLT, WEB, and more | Various sources |

### Church Fathers Commentary

| Source | Entries | Notes |
|--------|---------|-------|
| [catenabible.com](https://www.catenabible.com) | ~52,700 | Scraped via their API |
| [CCEL Catena Aurea](https://www.ccel.org) | ~6,600 | Aquinas's compilation of Fathers on the Gospels |
| Hand-curated | ~55 | Selected patristic excerpts |

### Word Study

| Source | Content | Notes |
|--------|---------|-------|
| Strong's Concordance | Greek & Hebrew lexicon | Public domain |
| BDB (Brown-Driver-Briggs) | Hebrew lexicon with morphology | Public domain |
| Thayer's Greek Lexicon | NT Greek lexicon | Public domain |
| OpenGNT | Greek NT with morphology & textual variants | Open dataset |
| TAHOT (OT Hebrew) | Hebrew morphology | Open dataset |

### Overview & Context

| Source | Content | Notes |
|--------|---------|-------|
| [bibleref.com](https://www.bibleref.com) | Verse notes, chapter summaries, pericope groupings | Scraped; partial Bible coverage |
| [Nave's Topical Bible](https://en.wikipedia.org/wiki/Nave%27s_Topical_Bible) | ~20,000 topics linked to verses | Public domain |

### History & Geography

| Source | Content | Notes |
|--------|---------|-------|
| Josephus (*Antiquities* + *Jewish War*) | Historical references keyed to verses | Public domain translation |

## Rebuilding the Database

The compiled database (`App/data/bible.db`) is included via Git LFS. To rebuild from source:

```bash
cd App
npm run build-db                # Rebuild from included raw data files
npm run fetch-catenabible-api   # Re-scrape catenabible.com (slow)
npm run fetch-ccel              # Re-fetch CCEL Catena Aurea
npm run fetch-all               # Fetch all + rebuild
```

To re-scrape bibleref.com overview data:
```bash
npm run scrape-bibleref-test    # Genesis only (~25 min, for testing)
npm run scrape-bibleref         # Full Bible (~8–9 hours)
npm run scrape-bibleref-resume  # Resume interrupted scrape
```

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
