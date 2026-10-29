# Bible App

A catena-style Bible study desktop app (Electron) built around KJV scripture and Church Fathers commentary. Click any verse to see patristic commentary sorted chronologically by era. Optional AI scholar powered by a local Ollama model — no data leaves your machine.

## ⬇️ Download

[![Download the latest release](https://img.shields.io/github/v/release/Solendor-S/Bible-App?label=Download&style=for-the-badge)](https://github.com/Solendor-S/Bible-App/releases/latest)

Grab the installer for your platform from the **[latest release](https://github.com/Solendor-S/Bible-App/releases/latest)** — Windows `.exe` or macOS `.dmg`. Everything (including the database) is bundled; no other tools required. See [Install](#install) for the first-launch security prompts. The app updates itself automatically after that.

## Features

**Reading**
- **19 translations + ESV** — KJV, KJV+ / I_KJV+ (Strong's), ASV, WEB, BSB, ESV (free Crossway key), SBLGNT, TAGNT, TR / TR+, TAHOT, WLC / WLC+, Dead Sea Scrolls, LXX / LXX+, Brenton and Apostolic Bible English LXX
- **Parallel column and split view** — a second translation beside the text, or a second passage side by side
- **Apocrypha and 22 early church texts** — Deuterocanon, broader and Ethiopian canons; Didache, 1–2 Clement, Ignatius, Polycarp, Barnabas, Diognetus, Justin, Tertullian, Irenaeus' *Against Heresies* — with their scripture references
- **Reading aids** — red letter, reading mode (prose), focus mode, OT quotations in capitals, psalm headings, KJV / BSB / Brenton footnotes, OT cross-reference markers, book introductions
- **Strong's everywhere** — click a tag for the entry, every occurrence, its English renderings, or a full word study

**Study panel** (drag tabs to reorder)
- **Church Fathers** — 60,000+ hand-picked New Advent citations (55 fathers) plus an 80,000-entry legacy archive; consensus by tradition, corpus search, browse by father with an influence network
- **Words** — interlinear Greek/Hebrew/LXX from six sources, Strong's, Thayer's/BDB, morphology, scripture index
- **Aquinas** — Catena Aurea on the Gospels, the Summa Theologica and Contra Gentiles, a Thomistic metaphysics primer
- **Doctrine** — how 13 doctrines developed, the fathers grouped by era
- **Cross-Refs, Overview, Historical** (Josephus, extra-biblical sources, textual variants), **Topics** (Nave's)
- **Church History** — councils, heresies, schisms, creeds, persecutions, canon formation, a unified timeline
- **Map** — biblical journeys, where the fathers lived, and the letters they sent
- **Library** — reading plans (templates or custom, streaks, calendar), bookmarks, highlights, notes in notebooks, reading history

**Also** — full search (exact / fuzzy / phrase / all words, Greek and Hebrew script, Strong's numbers, scopes, per-book breakdown), three themes, font and spacing settings, a first-run tour, the optional **AI Scholar** (local Ollama or Gemini), and automatic updates.

## Install

Download the installer for your platform from the
**[latest release](https://github.com/Solendor-S/Bible-App/releases/latest)**. The database
and everything else is bundled — no Node, Git, or other tools required.

### Windows

Run **`bible-app-x.y.z-setup.exe`**. Because the installer isn't code-signed yet, Windows
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
| [New Advent](https://www.newadvent.org/fathers/) | 60,376 | Citations parsed from tagged scripture links, 55 fathers |
| Legacy archive (catenabible.com, CCEL, HCF, e-Catena) | 80,404 | Wider range, less tightly matched to each verse |
| Catena Aurea (Parker/Newman 1841) | 70,085 | Aquinas's compilation on the Gospels |
| Summa Theologica (1920) / Contra Gentiles (Rickaby 1905) | 4,082 articles | Public domain translations |

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

The compiled database (`App/data/bible.db`, Git LFS) is built from the Android app's
(Patristica) databases — its bundled core plus every downloadable pack — with Nave's added:

```bash
cd App
npm run import-android   # reads C:/Projects/BibleAndroidApp/Patristica read-only; self-checks row counts
```

The older desktop scrape pipeline (`npm run build-db`, `fetch-*`, `scrape-*`) still exists but
produces the previous, smaller dataset — prefer `import-android`.

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
- **better-sqlite3** — read-only `bible.db` plus a per-user `user.db` (bookmarks, notes, plans, settings)
- **Ollama** (local) for AI inference
