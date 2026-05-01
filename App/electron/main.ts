import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { join, sep as pathSep } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, readdirSync, unlinkSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { spawn } from 'child_process'
import https from 'https'
import http from 'http'
import initSqlJs, { Database } from 'sql.js'
import { HISTORICAL_CREATE_SQL, HISTORICAL_MIGRATE_SQL, HISTORICAL_SOURCES, HISTORICAL_REFS } from './historicalData'
import { APOCRYPHA_CREATE_SQL, APOCRYPHA_BOOKS, APOCRYPHA_VERSES } from './apocryphaData'
import { NAVES_CREATE_SQL, NAVES_TOPICS, NAVES_REFS } from './navesData'

let db: Database | null = null

function getCurrentVersion(): string {
  try {
    const pkgPath = app.isPackaged
      ? join(process.resourcesPath, 'package.json')
      : join(__dirname, '../../package.json')
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version ?? '0.0.0'
  } catch { return '0.0.0' }
}

// Seed DB lives in the repo (updated by git). Never read directly by the app.
function getDbSeedPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'bible.db')
  return join(__dirname, '../../data/bible.db')
}

// Working DB lives in userData — outside the git repo, never touched by git.
function getDbPath(): string {
  return join(app.getPath('userData'), 'bible.db')
}

function getDbVersionPath(): string {
  return join(app.getPath('userData'), '.db-version')
}

function getPreloadPath(): string {
  return join(__dirname, 'preload.js')
}

async function openDb(): Promise<Database> {
  if (db) return db

  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (app.isPackaged) return join(process.resourcesPath, file)
      return join(__dirname, '../../node_modules/sql.js/dist', file)
    }
  })
  const userDbPath = getDbPath()
  const seedPath = getDbSeedPath()
  const versionPath = getDbVersionPath()
  const currentVersion = getCurrentVersion()

  // Copy seed → userData if missing or app version has changed (new commentary data)
  const installedVersion = existsSync(versionPath) ? readFileSync(versionPath, 'utf-8').trim() : ''
  if (existsSync(seedPath) && (!existsSync(userDbPath) || installedVersion !== currentVersion)) {
    mkdirSync(app.getPath('userData'), { recursive: true })
    copyFileSync(seedPath, userDbPath)
    writeFileSync(versionPath, currentVersion)
  }

  if (!existsSync(userDbPath)) {
    db = new SQL.Database()
    db.run(`
      CREATE TABLE IF NOT EXISTS bible_verses (id INTEGER PRIMARY KEY, book TEXT, book_order INTEGER, chapter INTEGER, verse INTEGER, text TEXT);
      CREATE TABLE IF NOT EXISTS commentary (id INTEGER PRIMARY KEY, book TEXT, chapter INTEGER, verse INTEGER, father_name TEXT, father_era TEXT, father_era_order INTEGER DEFAULT 0, excerpt TEXT, full_text TEXT, source TEXT);
      CREATE TABLE IF NOT EXISTS cross_refs (id INTEGER PRIMARY KEY, from_book TEXT, from_chapter INTEGER, from_verse INTEGER, to_book TEXT, to_chapter INTEGER, to_verse INTEGER, weight REAL DEFAULT 1.0);
    `)
    return db
  }

  const fileBuffer = readFileSync(userDbPath)
  db = new SQL.Database(fileBuffer)

  // Migrate: add historical_sources and historical_refs if not present
  const hasHistorical = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='historical_sources'")
  if (!hasHistorical.length || !hasHistorical[0].values.length) {
    db.run(HISTORICAL_CREATE_SQL)
    const srcStmt = db.prepare(`
      INSERT OR IGNORE INTO historical_sources
        (source_key, title, category, author, date_desc, location, description, significance, citation, testament, sort_year)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const s of HISTORICAL_SOURCES) {
      srcStmt.run([s.source_key, s.title, s.category, s.author, s.date_desc, s.location, s.description, s.significance, s.citation, s.testament, s.sort_year])
    }
    srcStmt.free()
    const refStmt = db.prepare(`
      INSERT INTO historical_refs (bible_book, bible_chapter, bible_verse, source_key)
      VALUES (?, ?, ?, ?)
    `)
    for (const r of HISTORICAL_REFS) {
      refStmt.run([r.bible_book, r.bible_chapter, r.bible_verse, r.source_key])
    }
    refStmt.free()
    const data = db.export()
    writeFileSync(userDbPath, Buffer.from(data))
  } else {
    // Add testament/sort_year columns if upgrading from initial schema (no testament column)
    const cols = db.exec("PRAGMA table_info(historical_sources)")
    const colNames = cols.length ? (cols[0].values as string[][]).map(r => r[1]) : []
    if (!colNames.includes('testament')) {
      for (const sql of HISTORICAL_MIGRATE_SQL.split(';').map(s => s.trim()).filter(Boolean)) {
        try { db.run(sql) } catch { /* column may already exist */ }
      }
      // Backfill testament and sort_year for existing rows
      const upStmt = db.prepare('UPDATE historical_sources SET testament = ?, sort_year = ? WHERE source_key = ?')
      for (const s of HISTORICAL_SOURCES) {
        upStmt.run([s.testament, s.sort_year, s.source_key])
      }
      upStmt.free()
      const data = db.export()
      writeFileSync(userDbPath, Buffer.from(data))
    }
  }

  // Migrate: add apocrypha tables and seed full verse data
  const hasApocrypha = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='apocrypha_books'")
  const apocryphaTableMissing = !hasApocrypha.length || !hasApocrypha[0].values.length
  const apocryphaVerseCount = apocryphaTableMissing ? 0
    : (db.exec('SELECT COUNT(*) FROM apocrypha_verses')[0]?.values[0][0] as number ?? 0)

  if (apocryphaTableMissing || apocryphaVerseCount < 1000) {
    if (apocryphaTableMissing) db.run(APOCRYPHA_CREATE_SQL)
    // Upsert book metadata
    const bkStmt = db.prepare(`INSERT OR REPLACE INTO apocrypha_books (book, book_order, group_label, chapter_count) VALUES (?, ?, ?, ?)`)
    for (const b of APOCRYPHA_BOOKS) {
      bkStmt.run([b.book, b.book_order, b.group_label, b.chapter_count])
    }
    bkStmt.free()
    // Replace all verses
    if (!apocryphaTableMissing) db.run('DELETE FROM apocrypha_verses')
    const vStmt = db.prepare(`INSERT INTO apocrypha_verses (book, book_order, chapter, verse, text) VALUES (?, ?, ?, ?, ?)`)
    for (const v of APOCRYPHA_VERSES) {
      const bookOrder = APOCRYPHA_BOOKS.find(b => b.book === v.book)?.book_order ?? 99
      vStmt.run([v.book, bookOrder, v.chapter, v.verse, v.text])
    }
    vStmt.free()
    const data = db.export()
    writeFileSync(userDbPath, Buffer.from(data))
  }

  // Migrate: create bible_translations table if missing
  const hasTrans = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='bible_translations'")
  if (!hasTrans.length || !hasTrans[0].values.length) {
    db.run(`
      CREATE TABLE IF NOT EXISTS bible_translations (
        translation TEXT NOT NULL,
        book        TEXT NOT NULL,
        chapter     INTEGER NOT NULL,
        verse       INTEGER NOT NULL,
        text        TEXT NOT NULL,
        PRIMARY KEY (translation, book, chapter, verse)
      )
    `)
    db.run(`CREATE INDEX IF NOT EXISTS idx_btrans_bcv ON bible_translations(translation, book, chapter, verse)`)
    const data = db.export()
    writeFileSync(userDbPath, Buffer.from(data))
  }

  // Migrate: seed Nave's Topical Bible if not present or empty
  const hasNaves = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='naves_topics'")
  const navesEmpty = !hasNaves.length || !hasNaves[0].values.length ||
    !(db.exec("SELECT COUNT(*) FROM naves_topics")[0]?.values[0][0])
  if (navesEmpty) {
    db.run(NAVES_CREATE_SQL)
    const topicStmt = db.prepare('INSERT OR IGNORE INTO naves_topics (id, name) VALUES (?, ?)')
    for (const [id, name] of NAVES_TOPICS) topicStmt.run([id, name])
    topicStmt.free()
    const refStmt = db.prepare('INSERT INTO naves_refs (topic_id, book, chapter, verse) VALUES (?, ?, ?, ?)')
    for (const [topicId, book, ch, v] of NAVES_REFS) refStmt.run([topicId, book, ch, v])
    refStmt.free()
    const data = db.export()
    writeFileSync(userDbPath, Buffer.from(data))
  } else {
    // Ensure idx_naves_refs_topic_id exists for DBs seeded before it was added
    db.run('CREATE INDEX IF NOT EXISTS idx_naves_refs_topic_id ON naves_refs(topic_id)')
  }

  return db
}

function rows(database: Database, sql: string, params: any[] = []): any[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function createSplash(): BrowserWindow {
  const iconPath = join(__dirname, '../../../resources/icon.png')
  let iconSrc = ''
  try { iconSrc = `data:image/png;base64,${readFileSync(iconPath).toString('base64')}` } catch {}

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;
         height:100vh;background:#1a1a1a;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;
         user-select:none;-webkit-app-region:drag}
    img{width:72px;height:72px;border-radius:14px;margin-bottom:18px;box-shadow:0 4px 20px rgba(0,0,0,0.5)}
    h1{font-size:17px;font-weight:600;margin-bottom:5px;letter-spacing:0.01em}
    p{font-size:11px;color:#6b7280;margin-bottom:28px}
    .dots{display:flex;gap:7px}
    .dot{width:6px;height:6px;border-radius:50%;background:#4b5563;animation:pulse 1.4s ease-in-out infinite}
    .dot:nth-child(2){animation-delay:0.2s}.dot:nth-child(3){animation-delay:0.4s}
    @keyframes pulse{0%,100%{opacity:0.25;transform:scale(0.75)}50%{opacity:1;transform:scale(1)}}
  </style></head><body>
    ${iconSrc ? `<img src="${iconSrc}" />` : ''}
    <h1>Bible Study</h1>
    <p>Church Fathers · Commentary · History</p>
    <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  </body></html>`

  const splash = new BrowserWindow({
    width: 380,
    height: 240,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: '#1a1a1a',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  return splash
}

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a1a',
    icon: join(__dirname, isMac ? '../../../resources/icon.png' : '../../../resources/icon.ico'),
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? {} : {
      titleBarOverlay: {
        color: '#1e1e1e',
        symbolColor: '#9ca3af',
        height: 36
      }
    }),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

ipcMain.handle('bible:getBooks', async () => {
  const database = await openDb()
  return rows(database, 'SELECT DISTINCT book, book_order FROM bible_verses ORDER BY book_order')
})

ipcMain.handle('bible:getChapters', async (_e, book: string) => {
  const database = await openDb()
  return rows(database, 'SELECT DISTINCT chapter FROM bible_verses WHERE book = ? ORDER BY chapter', [book])
    .map(r => r.chapter)
})

ipcMain.handle('bible:getVerses', async (_e, book: string, chapter: number) => {
  const database = await openDb()
  return rows(database, 'SELECT verse, text FROM bible_verses WHERE book = ? AND chapter = ? ORDER BY verse', [book, chapter])
})

ipcMain.handle('bible:getCrossRefs', async (_e, book: string, chapter: number, verse: number, translation = 'KJV') => {
  const database = await openDb()
  return rows(database, `
    SELECT cr.to_book, cr.to_chapter, cr.to_verse,
      COALESCE(bt.text, bv.text) as text
    FROM cross_refs cr
    LEFT JOIN bible_translations bt ON bt.translation = ? AND bt.book = cr.to_book AND bt.chapter = cr.to_chapter AND bt.verse = cr.to_verse
    LEFT JOIN bible_verses bv ON bv.book = cr.to_book AND bv.chapter = cr.to_chapter AND bv.verse = cr.to_verse
    WHERE cr.from_book = ? AND cr.from_chapter = ? AND cr.from_verse = ?
    ORDER BY cr.weight DESC LIMIT 8
  `, [translation, book, chapter, verse])
})

ipcMain.handle('bible:getGreekWords', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `SELECT position, greek, translit, strongs, gloss FROM greek_words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY position`, [book, chapter, verse])
})

ipcMain.handle('bible:getHebrewWords', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `SELECT position, hebrew, translit, strongs, gloss FROM hebrew_words WHERE book = ? AND chapter = ? AND verse = ? ORDER BY position`, [book, chapter, verse])
})

ipcMain.handle('bible:getStrongsEntry', async (_e, type: string, num: string) => {
  const database = await openDb()
  const table = type === 'hebrew' ? 'strongs_hebrew' : 'strongs_greek'
  // TAGNT/TAHOT use zero-padded numbers with optional letter suffixes (e.g. "G0910", "G2941G", "H0430G", "H1254A")
  // OpenScriptures dictionary keys have no padding and no suffix (e.g. "G910", "G2941", "H430", "H1254")
  // Try exact match first, then normalize by stripping padding and suffix
  let r = rows(database, `SELECT number, lemma, translit, pronunciation, definition, kjv_usage FROM ${table} WHERE number = ?`, [num])
  if (r.length === 0) {
    const prefix = type === 'greek' ? 'G' : 'H'
    const m = num.match(new RegExp(`^${prefix}0*(\\d+)`))
    if (m) {
      const normalized = `${prefix}${parseInt(m[1])}`
      r = rows(database, `SELECT number, lemma, translit, pronunciation, definition, kjv_usage FROM ${table} WHERE number = ?`, [normalized])
    }
  }
  return r[0] ?? null
})

ipcMain.handle('bible:getCrossRefsFull', async (_e, book: string, chapter: number, verse: number, translation = 'KJV') => {
  const database = await openDb()
  return rows(database, `
    SELECT cr.to_book, cr.to_chapter, cr.to_verse,
      COALESCE(bt.text, bv.text) as text
    FROM cross_refs cr
    LEFT JOIN bible_translations bt ON bt.translation = ? AND bt.book = cr.to_book AND bt.chapter = cr.to_chapter AND bt.verse = cr.to_verse
    LEFT JOIN bible_verses bv ON bv.book = cr.to_book AND bv.chapter = cr.to_chapter AND bv.verse = cr.to_verse
    WHERE cr.from_book = ? AND cr.from_chapter = ? AND cr.from_verse = ?
    ORDER BY cr.weight DESC LIMIT 50
  `, [translation, book, chapter, verse])
})

ipcMain.handle('commentary:getForVerse', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `
    SELECT id, father_name, father_era, excerpt, full_text, source, source_url
    FROM commentary WHERE book = ? AND chapter = ? AND verse = ? ORDER BY father_era_order
  `, [book, chapter, verse])
})

ipcMain.handle('josephus:getForVerse', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `
    SELECT j.work, j.book, j.chapter, j.section, j.text, j.ref, jr.note
    FROM josephus_refs jr
    JOIN josephus j ON j.work = jr.jos_work AND j.book = jr.jos_book
                    AND j.chapter = jr.jos_chapter AND j.section = jr.jos_section
    WHERE jr.bible_book = ? AND jr.bible_chapter = ? AND jr.bible_verse = ?
  `, [book, chapter, verse])
})

ipcMain.handle('historical:getForVerse', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `
    SELECT hs.id, hs.source_key, hs.title, hs.category, hs.author,
           hs.date_desc, hs.location, hs.description, hs.significance, hs.citation,
           hs.testament, hs.sort_year
    FROM historical_refs hr
    JOIN historical_sources hs ON hs.source_key = hr.source_key
    WHERE hr.bible_book = ? AND hr.bible_chapter = ? AND hr.bible_verse = ?
    ORDER BY hs.sort_year
  `, [book, chapter, verse])
})

ipcMain.handle('historical:getAll', async () => {
  const database = await openDb()
  return rows(database, `
    SELECT id, source_key, title, category, author, date_desc, location,
           description, significance, citation, testament, sort_year
    FROM historical_sources
    ORDER BY sort_year
  `)
})

ipcMain.handle('apocrypha:getBooks', async () => {
  const database = await openDb()
  return rows(database, 'SELECT id, book, book_order, group_label, chapter_count FROM apocrypha_books ORDER BY book_order')
})

ipcMain.handle('apocrypha:getChapters', async (_e, book: string) => {
  const database = await openDb()
  const result = rows(database, 'SELECT DISTINCT chapter FROM apocrypha_verses WHERE book = ? ORDER BY chapter', [book])
  if (result.length === 0) {
    // Book metadata exists but no verse text yet — return chapter numbers from book metadata
    const meta = rows(database, 'SELECT chapter_count FROM apocrypha_books WHERE book = ?', [book])
    if (meta.length > 0) {
      return Array.from({ length: meta[0].chapter_count }, (_, i) => i + 1)
    }
    return []
  }
  return result.map((r: any) => r.chapter)
})

ipcMain.handle('apocrypha:getVerses', async (_e, book: string, chapter: number) => {
  const database = await openDb()
  return rows(database, 'SELECT verse, text FROM apocrypha_verses WHERE book = ? AND chapter = ? ORDER BY verse', [book, chapter])
})

ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))

ipcMain.handle('search:query', async (_e, params: { query: string; tab?: string; book?: string; father?: string; offset?: number; limit?: number; translation?: string }) => {
  const database = await openDb()
  const { query, tab = 'all', book = '', father = '', offset = 0, limit = 20, translation = 'KJV' } = params

  const words = query.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { verses: [], commentary: [], totalVerses: 0, totalCommentary: 0 }

  let verses: any[] = []
  let totalVerses = 0
  let commentary: any[] = []
  let totalCommentary = 0

  if (tab !== 'commentary') {
    const wordClauses = words.map(() => 'text LIKE ?').join(' AND ')
    const wordArgs = words.map(w => `%${w}%`)
    const bookClause = book ? ' AND book = ?' : ''
    if (translation === 'KJV') {
      const baseArgs = [...wordArgs, ...(book ? [book] : [])]
      totalVerses = (rows(database, `SELECT COUNT(*) as n FROM bible_verses WHERE ${wordClauses}${bookClause}`, baseArgs)[0]?.n ?? 0) as number
      verses = rows(database, `SELECT book, chapter, verse, text FROM bible_verses WHERE ${wordClauses}${bookClause} LIMIT ${limit} OFFSET ${offset}`, baseArgs)
    } else {
      const baseArgs = [translation, ...wordArgs, ...(book ? [book] : [])]
      totalVerses = (rows(database, `SELECT COUNT(*) as n FROM bible_translations WHERE translation = ? AND ${wordClauses}${bookClause}`, baseArgs)[0]?.n ?? 0) as number
      verses = rows(database, `SELECT book, chapter, verse, text FROM bible_translations WHERE translation = ? AND ${wordClauses}${bookClause} LIMIT ${limit} OFFSET ${offset}`, baseArgs)
    }
  }

  if (tab !== 'scripture') {
    const wordClauses = words.map(() => '(full_text LIKE ? OR excerpt LIKE ?)').join(' AND ')
    const wordArgs = words.flatMap(w => [`%${w}%`, `%${w}%`])
    const bookClause = book ? ' AND book = ?' : ''
    const fatherClause = father ? ' AND father_name = ?' : ''
    const filterArgs: any[] = [...(book ? [book] : []), ...(father ? [father] : [])]
    const baseArgs = [...wordArgs, ...filterArgs]
    totalCommentary = (rows(database, `SELECT COUNT(*) as n FROM commentary WHERE ${wordClauses}${bookClause}${fatherClause}`, baseArgs)[0]?.n ?? 0) as number
    commentary = rows(database, `SELECT book, chapter, verse, father_name, excerpt as text FROM commentary WHERE ${wordClauses}${bookClause}${fatherClause} LIMIT ${limit} OFFSET ${offset}`, baseArgs)
  }

  return { verses, commentary, totalVerses, totalCommentary }
})

ipcMain.handle('concordance:search', async (_e, word: string, translation = 'KJV') => {
  const database = await openDb()
  const clean = word.trim().replace(/[^a-zA-Z'-]/g, '')
  if (!clean) return { total: 0, results: [] }
  const re = new RegExp(`\\b${clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  if (translation === 'KJV') {
    const candidates = rows(database,
      `SELECT book, chapter, verse, text FROM bible_verses WHERE LOWER(text) LIKE LOWER(?)`,
      [`%${clean}%`]
    )
    const matched = candidates.filter((r: any) => re.test(r.text))
    return { total: matched.length, results: matched }
  } else {
    const candidates = rows(database,
      `SELECT book, chapter, verse, text FROM bible_translations WHERE translation = ? AND LOWER(text) LIKE LOWER(?)`,
      [translation, `%${clean}%`]
    )
    const matched = candidates.filter((r: any) => re.test(r.text))
    return { total: matched.length, results: matched }
  }
})

ipcMain.handle('search:getFathers', async () => {
  const database = await openDb()
  return rows(database,
    `SELECT DISTINCT father_name FROM commentary
     WHERE LENGTH(father_name) < 70 AND father_name NOT LIKE '%[%'
     ORDER BY father_name`
  ).map((r: any) => r.father_name as string)
})

// ── Chat session persistence ──────────────────

function sessionsDir(): string {
  const dir = join(app.getPath('userData'), 'chat-sessions')
  mkdirSync(dir, { recursive: true })
  return dir
}

ipcMain.handle('chat:getSessions', () => {
  const dir = sessionsDir()
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) }
      catch { return null }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
})

ipcMain.handle('chat:saveSession', (_e, session: any) => {
  writeFileSync(join(sessionsDir(), `${session.id}.json`), JSON.stringify(session))
})

ipcMain.handle('chat:loadSession', (_e, id: string) => {
  const p = join(sessionsDir(), `${id}.json`)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) }
  catch { return null }
})

ipcMain.handle('chat:deleteSession', (_e, id: string) => {
  const p = join(sessionsDir(), `${id}.json`)
  if (existsSync(p)) unlinkSync(p)
})

// ── Notes persistence ──────────────────────────
function notebooksPath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'notebooks.json')
}

function notesDir(): string {
  const dir = join(app.getPath('userData'), 'notes')
  mkdirSync(dir, { recursive: true })
  return dir
}

ipcMain.handle('notes:getNotebooks', () => {
  const p = notebooksPath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
})

ipcMain.handle('notes:saveNotebook', (_e, notebook: any) => {
  const p = notebooksPath()
  const list: any[] = existsSync(p) ? (() => { try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] } })() : []
  const idx = list.findIndex((n: any) => n.id === notebook.id)
  if (idx >= 0) { list[idx] = notebook } else { list.push(notebook) }
  writeFileSync(p, JSON.stringify(list))
})

ipcMain.handle('notes:deleteNotebook', (_e, id: string) => {
  const p = notebooksPath()
  if (!existsSync(p)) return
  try {
    const list = JSON.parse(readFileSync(p, 'utf-8')).filter((n: any) => n.id !== id)
    writeFileSync(p, JSON.stringify(list))
  } catch {}
  // also delete all notes in this notebook
  const dir = notesDir()
  try {
    readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => {
        try {
          const note = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
          if (note.notebookId === id) unlinkSync(join(dir, f))
        } catch {}
      })
  } catch {}
})

ipcMain.handle('notes:getNotes', (_e, notebookId: string) => {
  const dir = notesDir()
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) } catch { return null } })
    .filter((n: any) => n && n.notebookId === notebookId)
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
})

ipcMain.handle('notes:saveNote', (_e, note: any) => {
  writeFileSync(join(notesDir(), `${note.id}.json`), JSON.stringify(note))
})

ipcMain.handle('notes:deleteNote', (_e, id: string) => {
  const p = join(notesDir(), `${id}.json`)
  if (existsSync(p)) unlinkSync(p)
})

// ── Bookmarks persistence ──────────────────────
interface BookmarkRecord {
  id: string
  book: string
  chapter: number
  verse: number
  verseText: string
  createdAt: number
}

function bookmarksPath(): string {
  return join(app.getPath('userData'), 'bookmarks.json')
}

function loadBookmarks(): BookmarkRecord[] {
  const p = bookmarksPath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

ipcMain.handle('bookmarks:getAll', () =>
  loadBookmarks().sort((a, b) => b.createdAt - a.createdAt)
)

ipcMain.handle('bookmarks:add', (_e, bm: BookmarkRecord) => {
  const data = loadBookmarks()
  if (data.some(b => b.book === bm.book && b.chapter === bm.chapter && b.verse === bm.verse)) return
  data.push(bm)
  writeFileSync(bookmarksPath(), JSON.stringify(data))
})

ipcMain.handle('bookmarks:remove', (_e, book: string, chapter: number, verse: number) => {
  const data = loadBookmarks().filter(
    b => !(b.book === book && b.chapter === chapter && b.verse === verse)
  )
  writeFileSync(bookmarksPath(), JSON.stringify(data))
})

// ── Highlights persistence ─────────────────────
function highlightsPath(): string {
  return join(app.getPath('userData'), 'highlights.json')
}

function loadHighlights(): Record<string, string> {
  const p = highlightsPath()
  if (!existsSync(p)) return {}
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return {} }
}

ipcMain.handle('highlights:get', (_e, book: string, chapter: number) => {
  const data = loadHighlights()
  const prefix = `${book}|${chapter}|`
  return Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, color]) => ({ verse: parseInt(k.split('|')[2], 10), color }))
})

ipcMain.handle('highlights:set', (_e, book: string, chapter: number, verse: number, color: string) => {
  const data = loadHighlights()
  data[`${book}|${chapter}|${verse}`] = color
  writeFileSync(highlightsPath(), JSON.stringify(data))
})

ipcMain.handle('highlights:clear', (_e, book: string, chapter: number, verse: number) => {
  const data = loadHighlights()
  delete data[`${book}|${chapter}|${verse}`]
  writeFileSync(highlightsPath(), JSON.stringify(data))
})

ipcMain.handle('highlights:getAll', async (_e, translation = 'KJV') => {
  const data = loadHighlights()
  const entries: Array<{ book: string; chapter: number; verse: number; color: string }> = []
  for (const [k, color] of Object.entries(data)) {
    if (!color) continue
    const [book, ch, v] = k.split('|')
    entries.push({ book, chapter: parseInt(ch, 10), verse: parseInt(v, 10), color })
  }
  if (!entries.length) return []

  const database = await openDb()
  const textMap = new Map<string, string>()
  const groups = new Map<string, { book: string; chapter: number; verses: number[] }>()
  for (const e of entries) {
    const key = `${e.book}|${e.chapter}`
    if (!groups.has(key)) groups.set(key, { book: e.book, chapter: e.chapter, verses: [] })
    groups.get(key)!.verses.push(e.verse)
  }
  for (const { book, chapter, verses } of groups.values()) {
    const ph = verses.map(() => '?').join(',')
    const chRows = rows(database,
      `SELECT bv.verse, COALESCE(bt.text, bv.text) AS text
       FROM bible_verses bv
       LEFT JOIN bible_translations bt
         ON bt.translation = ? AND bt.book = bv.book AND bt.chapter = bv.chapter AND bt.verse = bv.verse
       WHERE bv.book = ? AND bv.chapter = ? AND bv.verse IN (${ph})`,
      [translation, book, chapter, ...verses]
    )
    for (const row of chRows) textMap.set(`${book}|${chapter}|${row.verse}`, row.text)
  }

  return entries.map(e => ({ ...e, text: textMap.get(`${e.book}|${e.chapter}|${e.verse}`) ?? null }))
})

ipcMain.handle('commentary:search', async (_e, query: string) => {
  const database = await openDb()
  const term = `%${query.trim()}%`
  return rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE full_text LIKE ? OR excerpt LIKE ? LIMIT 5
  `, [term, term])
})

ipcMain.handle('commentary:searchByFather', async (_e, fatherName: string) => {
  const database = await openDb()
  const exact = fatherName.trim()
  const fuzzy = `%${exact}%`
  const exactRows = rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name = ? LIMIT 1
  `, [exact])
  if (exactRows.length > 0) return exactRows
  return rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name LIKE ? LIMIT 1
  `, [fuzzy])
})

ipcMain.handle('commentary:searchByFatherAndVerse', async (_e, fatherName: string, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  const exact = fatherName.trim()
  const fuzzy = `%${exact}%`
  // Try exact father + exact verse first
  const exactMatch = rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name = ? AND book = ? AND chapter = ? AND verse = ? LIMIT 1
  `, [exact, book, chapter, verse])
  if (exactMatch.length > 0) return exactMatch
  // Try fuzzy father name + exact verse
  const fuzzyFather = rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name LIKE ? AND book = ? AND chapter = ? AND verse = ? LIMIT 1
  `, [fuzzy, book, chapter, verse])
  if (fuzzyFather.length > 0) return fuzzyFather
  // Fall back to father-only (original behavior)
  const fatherOnly = rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name = ? LIMIT 1
  `, [exact])
  if (fatherOnly.length > 0) return fatherOnly
  return rows(database, `
    SELECT book, chapter, verse, father_name, father_era, excerpt, full_text, source, '' as source_url
    FROM commentary WHERE father_name LIKE ? LIMIT 1
  `, [fuzzy])
})

// ── Nave's Topical Bible ──────────────────────

ipcMain.handle('naves:getForVerse', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database,
    `SELECT DISTINCT t.id, t.name,
       (SELECT COUNT(*) FROM naves_refs r2 WHERE r2.topic_id = t.id) AS refCount
     FROM naves_topics t
     JOIN naves_refs r ON r.topic_id = t.id
     WHERE r.book = ? AND r.chapter = ? AND r.verse = ?
     ORDER BY t.name`,
    [book, chapter, verse]
  )
})

ipcMain.handle('naves:getTopicRefs', async (_e, topicId: number, translation = 'KJV') => {
  const database = await openDb()
  return rows(database,
    `WITH topic_verses AS (
       SELECT DISTINCT book, chapter, verse FROM naves_refs WHERE topic_id = ?
     ),
     cross_counts AS (
       SELECT r.book, r.chapter, r.verse, COUNT(DISTINCT r.topic_id) AS cross_count
       FROM naves_refs r
       INNER JOIN topic_verses tv ON r.book = tv.book AND r.chapter = tv.chapter AND r.verse = tv.verse
       GROUP BY r.book, r.chapter, r.verse
     )
     SELECT tv.book, tv.chapter, tv.verse,
       COALESCE(bt.text, bv.text) AS text,
       cc.cross_count
     FROM topic_verses tv
     JOIN cross_counts cc ON cc.book = tv.book AND cc.chapter = tv.chapter AND cc.verse = tv.verse
     LEFT JOIN bible_translations bt ON bt.translation = ? AND bt.book = tv.book AND bt.chapter = tv.chapter AND bt.verse = tv.verse
     LEFT JOIN bible_verses bv ON bv.book = tv.book AND bv.chapter = tv.chapter AND bv.verse = tv.verse
     ORDER BY cc.cross_count DESC`,
    [topicId, translation]
  )
})

ipcMain.handle('naves:search', async (_e, query: string) => {
  const database = await openDb()
  return rows(database,
    `SELECT id, name FROM naves_topics WHERE name LIKE ? ORDER BY name LIMIT 80`,
    [`%${query.trim()}%`]
  )
})

// ── Bible Translations ────────────────────────
ipcMain.handle('translations:getList', async () => {
  const database = await openDb()
  const result = rows(database, 'SELECT DISTINCT translation FROM bible_translations ORDER BY translation')
  return result.map((r: any) => r.translation as string)
})

ipcMain.handle('translations:getVerses', async (_e, translation: string, book: string, chapter: number) => {
  const database = await openDb()
  return rows(database,
    'SELECT verse, text FROM bible_translations WHERE translation = ? AND book = ? AND chapter = ? ORDER BY verse',
    [translation, book, chapter]
  )
})

// ── Ollama lifecycle ──────────────────────────

let ollamaStartedByUs = false

function isOllamaRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:11434/', (res) => {
      res.resume()
      resolve(res.statusCode !== undefined)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
  })
}

function findOllamaExe(): string | null {
  if (process.platform === 'darwin') {
    const macPaths = [
      '/usr/local/bin/ollama',
      '/opt/homebrew/bin/ollama',
      join(homedir(), '.ollama', 'ollama'),
    ]
    for (const p of macPaths) {
      if (existsSync(p)) return p
    }
    try {
      const { execFileSync } = require('child_process')
      const result = execFileSync('which', ['ollama'], { encoding: 'utf-8' })
      const line = (result as string).trim()
      if (line && existsSync(line)) return line
    } catch {}
    return null
  }
  // Windows: check known install locations first (full path = no shell needed)
  const knownPaths = [
    join(homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
  ]
  for (const p of knownPaths) {
    if (existsSync(p)) return p
  }
  try {
    const { execFileSync } = require('child_process')
    const result = execFileSync('where', ['ollama'], { windowsHide: true, encoding: 'utf-8' } as any)
    const line = (result as string).trim().split(/\r?\n/)[0].trim()
    if (line && existsSync(line)) return line
  } catch {}
  return null
}

function waitForOllama(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    function poll() {
      isOllamaRunning().then((up) => {
        if (up) return resolve(true)
        if (Date.now() - start >= timeoutMs) return resolve(false)
        setTimeout(poll, 600)
      })
    }
    poll()
  })
}

ipcMain.handle('ollama:ensureRunning', async () => {
  if (await isOllamaRunning()) return { success: true, alreadyRunning: true }

  const exe = findOllamaExe()
  if (!exe) return { success: false, error: 'Ollama not found. Install it from https://ollama.com' }

  try {
    if (process.platform === 'darwin') {
      spawn(exe, ['serve'], { detached: true, stdio: 'ignore' }).unref()
    } else {
      // WScript.Shell.Run with window style 0 (SW_HIDE) is the most reliable
      // way to launch a hidden process on Windows — unaffected by execution policy
      const vbsPath = join(tmpdir(), 'ollama-start.vbs')
      const safePath = exe.replace(/"/g, '""')
      writeFileSync(vbsPath, `Set sh = CreateObject("WScript.Shell")\nsh.Run """${safePath}"" serve", 0, False\n`)
      spawn('wscript.exe', [vbsPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    }
  } catch (e: any) {
    return { success: false, error: `Failed to start Ollama: ${e.message}` }
  }

  const ready = await waitForOllama(20000)
  if (!ready) return { success: false, error: 'Ollama did not start within 20 seconds.' }
  ollamaStartedByUs = true
  return { success: true, alreadyRunning: false }
})

// ── Update check ─────────────────────────────

const REPO = 'Solendor-S/Bible-App'

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return aMaj > bMaj
  if (aMin !== bMin) return aMin > bMin
  return aPat > bPat
}

function fetchLatestTag(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname: 'api.github.com', path: `/repos/${REPO}/releases/latest`, headers: { 'User-Agent': 'BibleApp/1.0' } },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          try { resolve(JSON.parse(data).tag_name ?? '') }
          catch { reject(new Error('parse error')) }
        })
      }
    ).on('error', reject)
  })
}

async function checkForUpdateAndNotify(win: BrowserWindow): Promise<void> {
  try {
    const current = getCurrentVersion()
    const tag = await fetchLatestTag()
    const latest = tag.replace(/^v/, '')
    if (semverGt(latest, current)) {
      win.webContents.send('app:updateAvailable', { current, latest })
    }
  } catch {
    // silent — no network or no releases yet
  }
}

ipcMain.handle('app:getReleases', (): Promise<{ tag: string; name: string; date: string; body: string }[]> => {
  return new Promise((resolve) => {
    https.get(
      { hostname: 'api.github.com', path: `/repos/${REPO}/releases?per_page=20`, headers: { 'User-Agent': 'BibleApp/1.0' } },
      (res) => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          try {
            const releases = JSON.parse(data)
            resolve(releases.map((r: any) => ({
              tag: r.tag_name ?? '',
              name: r.name ?? r.tag_name ?? '',
              date: r.published_at ?? '',
              body: r.body ?? '',
            })))
          } catch { resolve([]) }
        })
      }
    ).on('error', () => resolve([]))
  })
})

ipcMain.handle('app:launchUpdater', () => {
  const outDir = join(homedir(), 'BibleApp', 'App', 'updater', 'out')

  if (process.platform === 'win32') {
    const exe = join(outDir, 'BibleAppUpdater-win32-x64', 'BibleAppUpdater.exe')
    if (existsSync(exe)) {
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
      return
    }
  } else if (process.platform === 'darwin') {
    for (const arch of ['arm64', 'x64']) {
      const appBundle = join(outDir, `BibleAppUpdater-darwin-${arch}`, 'BibleAppUpdater.app')
      if (existsSync(appBundle)) {
        spawn('open', [appBundle], { detached: true, stdio: 'ignore' }).unref()
        return
      }
    }
  }

  // Fallback: run via npm (binary not found — rebuilds from source)
  const updaterDir = join(homedir(), 'BibleApp', 'App', 'updater')
  spawn('npm', ['run', 'start'], { cwd: updaterDir, detached: true, stdio: 'ignore', shell: true }).unref()
})

app.whenReady().then(async () => {
  const splash = createSplash()
  await openDb()
  const win = createWindow()
  win.once('ready-to-show', () => {
    splash.close()
    win.show()
  })
  win.webContents.once('did-finish-load', () => {
    checkForUpdateAndNotify(win)
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  db?.close()
  if (ollamaStartedByUs) {
    try {
      const { execFileSync } = require('child_process')
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/F', '/IM', 'ollama.exe', '/T'], { windowsHide: true } as any)
      } else {
        execFileSync('pkill', ['-f', 'ollama serve'])
      }
    } catch {}
  }
  if (process.platform !== 'darwin') app.quit()
})
