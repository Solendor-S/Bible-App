# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary sorted chronologically by era. Optional AI scholar powered by a local Ollama model — no data leaves your machine.

## ⬇️ Download

[![Download the latest release](https://img.shields.io/github/v/release/Solendor-S/Bible-App?label=Download&style=for-the-badge)](https://github.com/Solendor-S/Bible-App/releases/latest)

Grab the installer for your OS from the **[latest release](https://github.com/Solendor-S/Bible-App/releases/latest)** — Windows `.exe` or macOS `.dmg`. Everything (including the database) is bundled; no other tools required. See [Install](#install) for the first-launch security prompts. The app updates itself automatically after that.

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

## Install

Download the installer for your platform from the
**[latest release](https://github.com/Solendor-S/Bible-App/releases/latest)**. The database
and everything else is bundled — no Node, Git, or other tools required.

### Windows

Run **`Bible Study Setup x.y.z.exe`**. Because the installer isn't code-signed yet, Windows
SmartScreen may warn — click **More info → Run anyway**. During install you'll get an optional
checkbox to install the AI Scholar (Ollama); it's **off by default** — leave it unchecked to
skip (you can install it later from inside the app).

### macOS

Open the **`.dmg`** and drag **Bible Study** into Applications. The app isn't notarized yet, so
the first launch is blocked by Gatekeeper — **right-click the app → Open → Open** (only needed
once).

## Updating

The app checks for updates on launch and downloads them in the background. When one is ready, a
toast appears — click **Restart & Update** to install it.

### Upgrading from an older version

Earlier versions ran from a source folder (`~/BibleApp`) instead of an installer, so they can't
update themselves to this version. **Download the installer above and run it once** — after that,
updates are automatic. Your data carries over automatically (highlights, bookmarks, notes, and
chats are kept separately and shared between versions — nothing to export or import). Once the new
version is working, you can delete the old `~/BibleApp` folder and any old desktop shortcuts.

## Run from source (developers)

```bash
git lfs install          # database ships via Git LFS
git clone https://github.com/Solendor-S/Bible-App.git
cd Bible-App/App
npm install
npm run dev              # electron-vite dev server
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
| Parallel translations | ASV, WEB | Public domain |

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

Built with [electron-vite](https://electron-vite.org) (bundling) +
[electron-builder](https://www.electron.build) (installers).

```bash
cd App
npm run build:win   # NSIS .exe installer (Windows)
npm run build:mac   # .dmg (macOS — run on a Mac)
npm run package     # unpacked app dir only, no installer
```

Installers are written to `App/dist-installer/`. Auto-update is wired to GitHub Releases via
`electron-builder.yml`; publishing a release is a manual step (`electron-builder --publish`).

## Tech Stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **sql.js** (SQLite compiled to WebAssembly) for the database
- **Ollama** (local) for AI inference
