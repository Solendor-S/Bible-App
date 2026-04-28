import { app, BrowserWindow, ipcMain } from 'electron'
import { join, dirname } from 'path'
import {
  existsSync, readFileSync, rmSync, mkdirSync,
  createWriteStream, copyFileSync, readdirSync,
  openSync, readSync, closeSync
} from 'fs'
import { homedir, tmpdir } from 'os'
import { spawn } from 'child_process'
import https from 'https'
import http from 'http'

const REPO = 'Solendor-S/Bible-App'
const INSTALL_ROOT = join(homedir(), 'BibleApp')
const APP_DIR = join(INSTALL_ROOT, 'App')
const APP_PACKAGE_JSON = join(APP_DIR, 'package.json')

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 500,
    height: 540,
    resizable: false,
    maximizable: false,
    title: 'Bible App Updater',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.setMenuBarVisibility(false)

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    win.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})

function getCurrentVersion(): string {
  try {
    if (existsSync(APP_PACKAGE_JSON)) {
      const pkg = JSON.parse(readFileSync(APP_PACKAGE_JSON, 'utf-8'))
      return pkg.version ?? '0.0.0'
    }
  } catch {}
  return '0.0.0'
}

function fetchLatestRelease(): Promise<{ tag: string; notes: string; url: string; zipball: string }> {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname: 'api.github.com', path: `/repos/${REPO}/releases/latest`, headers: { 'User-Agent': 'BibleAppUpdater/1.0' } },
      (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.message === 'Not Found' || !json.tag_name) {
              reject(new Error('No releases found on GitHub.'))
              return
            }
            resolve({
              tag: json.tag_name as string,
              notes: (json.body as string) ?? '',
              url: (json.html_url as string) ?? '',
              zipball: (json.zipball_url as string) ?? '',
            })
          } catch {
            reject(new Error('Failed to parse GitHub response.'))
          }
        })
      }
    ).on('error', reject)
  })
}

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return aMaj > bMaj
  if (aMin !== bMin) return aMin > bMin
  return aPat > bPat
}

// Stream a URL to a file, following redirects (up to 10)
function httpsDownload(
  url: string,
  destPath: string,
  onProgress?: (received: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, hops = 0) => {
      if (hops > 10) { reject(new Error('Too many redirects')); return }
      const lib = u.startsWith('http://') ? http : https
      lib.get(u, { headers: { 'User-Agent': 'BibleAppUpdater/1.0' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          res.resume()
          follow(res.headers.location!, hops + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const total = parseInt(res.headers['content-length'] ?? '0', 10)
        let received = 0
        mkdirSync(dirname(destPath), { recursive: true })
        const file = createWriteStream(destPath)
        res.on('data', (chunk: Buffer) => {
          received += chunk.length
          onProgress?.(received, total)
        })
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
        file.on('error', reject)
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// POST JSON to an HTTPS endpoint (used for LFS batch API)
function httpsPostJson(hostname: string, path: string, body: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: {
        'User-Agent': 'BibleAppUpdater/1.0',
        'Content-Type': 'application/vnd.git-lfs+json',
        'Accept': 'application/vnd.git-lfs+json',
        'Content-Length': Buffer.byteLength(payload),
      }
    }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// Extract a zip archive to destDir using the platform's built-in tools
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(destDir, { recursive: true })
    // Windows 10+ ships bsdtar which supports zip; macOS has unzip
    const [cmd, args] = process.platform === 'win32'
      ? ['tar' as string, ['-xf', zipPath, '-C', destDir] as string[]]
      : ['unzip', ['-q', zipPath, '-d', destDir]]
    const proc = spawn(cmd, args, { shell: false })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Extraction failed (code ${code})`))
    })
    proc.on('error', reject)
  })
}

// Check if a file is a Git LFS pointer — reads only the first 256 bytes
function isLfsPointer(filePath: string): { oid: string; size: number } | null {
  try {
    const fd = openSync(filePath, 'r')
    const buf = Buffer.alloc(256)
    const n = readSync(fd, buf, 0, 256, 0)
    closeSync(fd)
    const content = buf.slice(0, n).toString('utf-8')
    if (!content.startsWith('version https://git-lfs.github.com/spec/v1')) return null
    const oidMatch = content.match(/oid sha256:([a-f0-9]{64})/)
    const sizeMatch = content.match(/size (\d+)/)
    if (!oidMatch || !sizeMatch) return null
    return { oid: oidMatch[1], size: parseInt(sizeMatch[1], 10) }
  } catch { return null }
}

// Fetch a real LFS file via the GitHub LFS batch API and stream it to destPath
async function downloadLfsObject(
  oid: string,
  size: number,
  destPath: string,
  onProgress?: (received: number, total: number) => void
): Promise<void> {
  const raw = await httpsPostJson('github.com', `/${REPO}.git/info/lfs/objects/batch`, {
    operation: 'download',
    transfers: ['basic'],
    objects: [{ oid, size }],
  })
  const json = JSON.parse(raw)
  const href: string | undefined = json.objects?.[0]?.actions?.download?.href
  if (!href) throw new Error(`LFS API returned no download URL for ${oid.slice(0, 8)}…`)
  await httpsDownload(href, destPath, onProgress)
}

// Recursively copy srcDir → destDir, resolving LFS pointers along the way
async function copyExtracted(
  srcDir: string,
  destDir: string,
  send: (line: string, type?: string) => void
): Promise<void> {
  mkdirSync(destDir, { recursive: true })
  const entries = readdirSync(srcDir, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      await copyExtracted(srcPath, destPath, send)
    } else {
      const lfs = isLfsPointer(srcPath)
      if (lfs) {
        const mb = (lfs.size / 1024 / 1024).toFixed(1)
        send(`  Downloading ${entry.name} (${mb} MB via LFS)...\n`, 'info')
        let lastPct = -1
        await downloadLfsObject(lfs.oid, lfs.size, destPath, (received, total) => {
          if (total > 0) {
            const pct = Math.floor(received / total * 100)
            if (pct >= lastPct + 10) {
              lastPct = pct
              send(`  ${entry.name}: ${pct}%\n`)
            }
          }
        })
        send(`  ${entry.name} done.\n`)
      } else {
        mkdirSync(dirname(destPath), { recursive: true })
        copyFileSync(srcPath, destPath)
      }
    }
  }
}

ipcMain.handle('update:getInfo', async () => {
  const current = getCurrentVersion()
  try {
    const { tag, notes, url } = await fetchLatestRelease()
    const latest = tag.replace(/^v/, '')
    return {
      current,
      latest,
      tag,
      notes,
      url,
      hasUpdate: semverGt(latest, current),
      installFound: existsSync(APP_DIR),
    }
  } catch (err: any) {
    return {
      current,
      latest: null,
      tag: null,
      notes: '',
      url: '',
      hasUpdate: false,
      installFound: existsSync(APP_DIR),
      error: err.message ?? 'Network error',
    }
  }
})

ipcMain.handle('update:getPlatform', () => process.platform)

ipcMain.handle('update:apply', async () => {
  const send = (line: string, type = 'output') =>
    win?.webContents.send('update:progress', { line, type })

  const tmpBase = join(tmpdir(), 'bibleapp-update')
  const zipPath = join(tmpBase, 'update.zip')
  const extractDir = join(tmpBase, 'extracted')

  try {
    if (!existsSync(INSTALL_ROOT)) {
      return { success: false, error: `Install directory not found: ${INSTALL_ROOT}` }
    }

    // 1. Fetch release metadata
    send('Fetching latest release info...\n', 'info')
    const { tag, zipball } = await fetchLatestRelease()
    send(`Release ${tag} found.\n`)

    // 2. Wipe any leftover temp from a previous attempt
    rmSync(tmpBase, { recursive: true, force: true })
    mkdirSync(extractDir, { recursive: true })

    // 3. Delete node_modules BEFORE touching anything (eliminates Windows file locks)
    const nodeModules = join(APP_DIR, 'node_modules')
    if (existsSync(nodeModules)) {
      send('\nClearing node_modules...\n', 'info')
      rmSync(nodeModules, { recursive: true, force: true })
      send('node_modules cleared.\n')
    }

    // 4. Download zipball
    send('\nDownloading update...\n', 'info')
    let lastMb = 0
    await httpsDownload(zipball, zipPath, (received, total) => {
      const mb = received / 1024 / 1024
      if (mb - lastMb >= 1) {
        lastMb = Math.floor(mb)
        const totalStr = total > 0 ? ` / ${(total / 1024 / 1024).toFixed(1)} MB` : ''
        send(`  ${mb.toFixed(1)} MB${totalStr}\n`)
      }
    })
    send('Download complete.\n')

    // 5. Extract zip
    send('\nExtracting archive...\n', 'info')
    await extractZip(zipPath, extractDir)

    // GitHub names the root folder "Owner-Repo-{sha}/" — find it dynamically
    const topLevel = readdirSync(extractDir, { withFileTypes: true })
    const rootEntry = topLevel.find(e => e.isDirectory())
    if (!rootEntry) throw new Error('Could not find extracted root folder.')
    const srcRoot = join(extractDir, rootEntry.name)
    send(`Extracted ${rootEntry.name}.\n`)

    // 6. Copy files into INSTALL_ROOT, resolving LFS pointers along the way
    send('\nCopying files...\n', 'info')
    await copyExtracted(srcRoot, INSTALL_ROOT, send)
    send('Files copied.\n')

    // 7. Install updated dependencies
    send('\nInstalling dependencies...\n', 'info')
    await new Promise<void>((resolve, reject) => {
      const npm = spawn('npm', ['install', '--no-progress'], {
        cwd: APP_DIR,
        shell: true,
        env: { ...process.env },
      })
      npm.stdout.on('data', (d: Buffer) => send(d.toString()))
      npm.stderr.on('data', (d: Buffer) => send(d.toString()))
      npm.on('close', code => code === 0 ? resolve() : reject(new Error(`npm install failed (code ${code})`)))
    })

    // 8. Clean up temp files
    rmSync(tmpBase, { recursive: true, force: true })

    send('\nUpdate complete!\n', 'success')
    return { success: true }

  } catch (err: any) {
    try { rmSync(tmpBase, { recursive: true, force: true }) } catch {}
    return { success: false, error: err.message ?? 'Unknown error' }
  }
})

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string
