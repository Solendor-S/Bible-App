import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { join } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import initSqlJs, { Database } from 'sql.js'

let db: Database | null = null

function getDbPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bible.db')
  }
  // In dev, main.ts compiles to .vite/build/main.js → two dirs up is project root
  return join(__dirname, '../../data/bible.db')
}

function getPreloadPath(): string {
  return join(__dirname, 'preload.js')
}

async function openDb(): Promise<Database> {
  if (db) return db
  const SQL = await initSqlJs()
  const dbPath = getDbPath()
  if (!existsSync(dbPath)) {
    db = new SQL.Database()
    db.run(`
      CREATE TABLE IF NOT EXISTS bible_verses (id INTEGER PRIMARY KEY, book TEXT, book_order INTEGER, chapter INTEGER, verse INTEGER, text TEXT);
      CREATE TABLE IF NOT EXISTS commentary (id INTEGER PRIMARY KEY, book TEXT, chapter INTEGER, verse INTEGER, father_name TEXT, father_era TEXT, father_era_order INTEGER DEFAULT 0, excerpt TEXT, full_text TEXT, source TEXT);
      CREATE TABLE IF NOT EXISTS cross_refs (id INTEGER PRIMARY KEY, from_book TEXT, from_chapter INTEGER, from_verse INTEGER, to_book TEXT, to_chapter INTEGER, to_verse INTEGER, weight REAL DEFAULT 1.0);
    `)
    return db
  }
  const fileBuffer = readFileSync(dbPath)
  db = new SQL.Database(fileBuffer)
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

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    icon: join(__dirname, '../../../resources/icon.ico'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1e1e1e',
      symbolColor: '#9ca3af',
      height: 36
    },
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

ipcMain.handle('bible:getCrossRefs', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `
    SELECT cr.to_book, cr.to_chapter, cr.to_verse, bv.text
    FROM cross_refs cr
    JOIN bible_verses bv ON bv.book = cr.to_book AND bv.chapter = cr.to_chapter AND bv.verse = cr.to_verse
    WHERE cr.from_book = ? AND cr.from_chapter = ? AND cr.from_verse = ?
    ORDER BY cr.weight DESC LIMIT 8
  `, [book, chapter, verse])
})

ipcMain.handle('commentary:getForVerse', async (_e, book: string, chapter: number, verse: number) => {
  const database = await openDb()
  return rows(database, `
    SELECT id, father_name, father_era, excerpt, full_text, source, source_url
    FROM commentary WHERE book = ? AND chapter = ? AND verse = ? ORDER BY father_era_order
  `, [book, chapter, verse])
})

ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))

ipcMain.handle('search:query', async (_e, query: string) => {
  const database = await openDb()
  const term = `%${query.trim()}%`
  const verses = rows(database, `
    SELECT book, chapter, verse, text, 'scripture' as type
    FROM bible_verses WHERE text LIKE ? LIMIT 30
  `, [term])
  const commentary = rows(database, `
    SELECT book, chapter, verse, father_name, excerpt as text, 'commentary' as type
    FROM commentary WHERE full_text LIKE ? OR excerpt LIKE ? LIMIT 20
  `, [term, term])
  return { verses, commentary }
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

app.whenReady().then(async () => {
  await openDb()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  db?.close()
  if (process.platform !== 'darwin') app.quit()
})
