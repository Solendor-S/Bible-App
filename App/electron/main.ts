import { app, BrowserWindow, ipcMain, shell } from 'electron'

import { join } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, renameSync } from 'fs'
import { homedir } from 'os'
import { spawn, execFileSync } from 'child_process'
import https from 'https'
import http from 'http'
import Database from 'better-sqlite3'
import { autoUpdater } from 'electron-updater'

// ── Databases ─────────────────────────────────────────────────────
// bible.db: bundled content, opened read-only straight from resources (never copied).
// user.db:  bookmarks, notes, highlights, history, plans, settings (Android schema + notebooks).

let bible: Database.Database | null = null
let user: Database.Database | null = null

// Test seam: run against a throwaway profile instead of the real one.
if (process.env.BIBLE_APP_USER_DATA) app.setPath('userData', process.env.BIBLE_APP_USER_DATA)

function getBibleDbPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'bible.db')
  return join(__dirname, '../../data/bible.db')
}

function getPreloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

// Repo `resources/` is shipped via electron-builder extraResources (→ resources/ under
// process.resourcesPath). In dev __dirname is out/main, three levels under the repo root.
function getResourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(__dirname, '../../../resources')
}

const USER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book TEXT NOT NULL, chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL, created_at INTEGER NOT NULL, position INTEGER,
    UNIQUE(book, chapter, verse));
  CREATE TABLE IF NOT EXISTS notebooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, notebook_id INTEGER NOT NULL DEFAULT 1,
    book TEXT NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    text TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL,
    UNIQUE(notebook_id, book, chapter, verse));
  CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book TEXT NOT NULL, chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL, color TEXT NOT NULL, created_at INTEGER NOT NULL,
    UNIQUE(book, chapter, verse));
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book TEXT NOT NULL, chapter INTEGER NOT NULL,
    visited_at INTEGER NOT NULL, UNIQUE(book, chapter));
  CREATE TABLE IF NOT EXISTS search_history (query TEXT PRIMARY KEY, ts INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reading_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS plan_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL, target_date TEXT NOT NULL,
    book TEXT NOT NULL, chapter INTEGER NOT NULL, completed_at INTEGER);
`

function readJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return fallback }
}

// One-time import of the pre-2.4 JSON stores. Returns the imported paths; the caller
// renames them *.migrated after the transaction commits (never deleted).
function migrateJsonUserData(db: Database.Database, dir: string): string[] {
  const imported: string[] = []
  const done = (p: string) => { imported.push(p) }

  const bmPath = join(dir, 'bookmarks.json')
  if (existsSync(bmPath)) {
    const ins = db.prepare('INSERT OR IGNORE INTO bookmarks (book, chapter, verse, created_at, position) VALUES (?, ?, ?, ?, ?)')
    readJson<any[]>(bmPath, [])
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((b, i) => ins.run(b.book, b.chapter, b.verse, b.createdAt ?? Date.now(), i))
    done(bmPath)
  }

  const hlPath = join(dir, 'highlights.json')
  if (existsSync(hlPath)) {
    const ins = db.prepare('INSERT OR IGNORE INTO highlights (book, chapter, verse, color, created_at) VALUES (?, ?, ?, ?, ?)')
    for (const [k, color] of Object.entries(readJson<Record<string, string>>(hlPath, {}))) {
      const [book, ch, v] = k.split('|')
      if (color) ins.run(book, +ch, +v, color === 'red' ? 'pink' : color, Date.now())
    }
    done(hlPath)
  }

  const nbPath = join(dir, 'notebooks.json')
  const notesDir = join(dir, 'notes')
  const idMap = new Map<string, number>()
  if (existsSync(nbPath)) {
    const ins = db.prepare('INSERT INTO notebooks (name, created_at) VALUES (?, ?)')
    for (const nb of readJson<any[]>(nbPath, [])) {
      idMap.set(nb.id, Number(ins.run(nb.name, nb.createdAt ?? Date.now()).lastInsertRowid))
    }
    done(nbPath)
  }
  if (existsSync(notesDir)) {
    const ins = db.prepare(`INSERT INTO notes (notebook_id, book, chapter, verse, text, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(notebook_id, book, chapter, verse) DO UPDATE SET text = text || char(10) || char(10) || excluded.text`)
    for (const f of readdirSync(notesDir).filter(f => f.endsWith('.json'))) {
      const n = readJson<any>(join(notesDir, f), null)
      if (n?.noteText) ins.run(idMap.get(n.notebookId) ?? 1, n.book, n.chapter, n.verse, n.noteText, n.updatedAt ?? n.createdAt ?? Date.now())
    }
    done(notesDir)
  }
  return imported
}

function openDbs(): void {
  bible = new Database(getBibleDbPath(), { readonly: true, fileMustExist: true })

  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  // Pre-2.4 builds copied the 450 MB seed DB into userData — it is only a cache, reclaim it.
  for (const f of ['bible.db', '.db-version']) {
    try { if (existsSync(join(dir, f))) unlinkSync(join(dir, f)) } catch {}
  }

  user = new Database(join(dir, 'user.db'))
  user.pragma('journal_mode = WAL')
  if (user.pragma('user_version', { simple: true }) === 0) {
    const imported = user.transaction(() => {
      user!.exec(USER_SCHEMA)
      if (!user!.prepare('SELECT 1 FROM notebooks').get()) {
        user!.prepare('INSERT INTO notebooks (id, name, created_at) VALUES (1, ?, ?)').run('Notes', Date.now())
      }
      const paths = migrateJsonUserData(user!, dir)
      user!.pragma('user_version = 1')
      return paths
    })()
    for (const p of imported) { try { renameSync(p, p + '.migrated') } catch {} }
  }
}

// ── SQL bridge ────────────────────────────────────────────────────
// The renderer's query layer (src/db/queries.ts, ported from the Android app) talks
// expo-sqlite's API; src/db/sqlite.ts maps that onto this one channel.
// bible.db is read-only at the driver level, so the renderer can only write user.db.

type SqlMethod = 'all' | 'get' | 'run' | 'exec'
ipcMain.handle('sql', (_e, which: 'bible' | 'user', method: SqlMethod, sql: string, params: unknown[] = []) => {
  const db = which === 'user' ? user! : bible!
  if (method === 'exec') { db.exec(sql); return null }
  const stmt = db.prepare(sql)
  if (method === 'run') {
    const r = stmt.run(...params)
    return { changes: r.changes, lastInsertRowId: Number(r.lastInsertRowid) }
  }
  return method === 'get' ? (stmt.get(...params) ?? null) : stmt.all(...params)
})

function createSplash(): BrowserWindow {
  const iconPath = join(getResourcesDir(), 'icon.png')
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
    icon: join(getResourcesDir(), isMac ? 'icon.png' : 'icon.ico'),
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

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))

// Title-bar overlay follows the app theme (set from the renderer's theme setting).
ipcMain.handle('app:setTitleBarColors', (e, color: string, symbolColor: string) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (win && process.platform !== 'darwin') {
    try { win.setTitleBarOverlay({ color, symbolColor }) } catch {}
  }
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
    .map(f => readJson<any>(join(dir, f), null))
    .filter(Boolean)
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
})

ipcMain.handle('chat:saveSession', (_e, session: any) => {
  writeFileSync(join(sessionsDir(), `${session.id}.json`), JSON.stringify(session))
})

ipcMain.handle('chat:loadSession', (_e, id: string) => {
  const p = join(sessionsDir(), `${id}.json`)
  return existsSync(p) ? readJson<any>(p, null) : null
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
      const line = execFileSync('which', ['ollama'], { encoding: 'utf-8' }).trim()
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
    const line = execFileSync('where', ['ollama'], { windowsHide: true, encoding: 'utf-8' }).trim().split(/\r?\n/)[0].trim()
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
    // windowsHide keeps the console window hidden on Windows; detached + unref lets it outlive us
    spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } catch (e: any) {
    return { success: false, error: `Failed to start Ollama: ${e.message}` }
  }

  const ready = await waitForOllama(20000)
  if (!ready) return { success: false, error: 'Ollama did not start within 20 seconds.' }
  ollamaStartedByUs = true
  return { success: true, alreadyRunning: false }
})

// ── Auto-update (electron-updater) ─────────────────────────────
// The update feed comes from electron-builder's `publish: github` config, baked
// into app-update.yml at build time. autoDownload fetches the new installer in the
// background; we surface the toast only once it's downloaded, so the toast's
// "Restart & Update" button can install immediately via quitAndInstall().

const REPO = 'Solendor-S/Bible-App'

function initAutoUpdater(win: BrowserWindow): void {
  if (!app.isPackaged) return  // updater is disabled in dev
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('app:updateAvailable', { current: app.getVersion(), latest: info.version })
  })
  autoUpdater.on('error', () => { /* silent — no network or no releases yet */ })
  autoUpdater.checkForUpdates().catch(() => {})
}

ipcMain.handle('app:getVersion', () => app.getVersion())

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
  // The new installer has already been downloaded in the background by
  // electron-updater; quit and install it now (app relaunches automatically).
  autoUpdater.quitAndInstall()
})

app.whenReady().then(() => {
  const splash = createSplash()
  openDbs()
  const win = createWindow()
  win.once('ready-to-show', () => {
    splash.close()
    win.show()
  })
  win.webContents.once('did-finish-load', () => {
    initAutoUpdater(win)
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  bible?.close()
  user?.close()
  if (ollamaStartedByUs) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/F', '/IM', 'ollama.exe', '/T'], { windowsHide: true })
      } else {
        execFileSync('pkill', ['-f', 'ollama serve'])
      }
    } catch {}
  }
  if (process.platform !== 'darwin') app.quit()
})
