import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { join, sep as pathSep } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync, readdirSync, unlinkSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { spawn } from 'child_process'
import https from 'https'
import http from 'http'
import initSqlJs, { Database } from 'sql.js'

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

  const SQL = await initSqlJs()
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

function createWindow(): BrowserWindow {
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
  // Check known install locations first (full path = no shell needed)
  const knownPaths = [
    join(homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
  ]
  for (const p of knownPaths) {
    if (existsSync(p)) return p
  }
  // Fall back to resolving via PATH using 'where' (synchronous, hidden)
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
    // WScript.Shell.Run with window style 0 (SW_HIDE) is the most reliable
    // way to launch a hidden process on Windows — unaffected by execution policy
    const vbsPath = join(tmpdir(), 'ollama-start.vbs')
    const safePath = exe.replace(/"/g, '""')
    writeFileSync(vbsPath, `Set sh = CreateObject("WScript.Shell")\nsh.Run """${safePath}"" serve", 0, False\n`)
    spawn('wscript.exe', [vbsPath], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
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

ipcMain.handle('app:launchUpdater', () => {
  const updaterExe = join(homedir(), 'BibleApp', 'App', 'updater', 'out', 'BibleAppUpdater-win32-x64', 'BibleAppUpdater.exe')
  if (existsSync(updaterExe)) {
    spawn(updaterExe, [], { detached: true, stdio: 'ignore' }).unref()
  } else {
    // Dev fallback: run via npm in the updater directory
    const updaterDir = join(__dirname, '../../../updater')
    spawn('npm', ['run', 'start'], { cwd: updaterDir, detached: true, stdio: 'ignore', shell: true }).unref()
  }
})

app.whenReady().then(async () => {
  await openDb()
  const win = createWindow()
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
      execFileSync('taskkill', ['/F', '/IM', 'ollama.exe', '/T'], { windowsHide: true } as any)
    } catch {}
  }
  if (process.platform !== 'darwin') app.quit()
})
