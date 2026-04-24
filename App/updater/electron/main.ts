import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { spawn } from 'child_process'
import https from 'https'

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

function fetchLatestRelease(): Promise<{ tag: string; notes: string; url: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO}/releases/latest`,
      headers: { 'User-Agent': 'BibleAppUpdater/1.0' }
    }
    https.get(options, (res) => {
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
            url: (json.html_url as string) ?? ''
          })
        } catch {
          reject(new Error('Failed to parse GitHub response.'))
        }
      })
    }).on('error', (e) => reject(e))
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
      installFound: existsSync(APP_DIR)
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
      error: err.message ?? 'Network error'
    }
  }
})

ipcMain.handle('update:apply', async () => {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    if (!existsSync(INSTALL_ROOT)) {
      resolve({ success: false, error: `Install directory not found: ${INSTALL_ROOT}` })
      return
    }

    win?.webContents.send('update:progress', { line: 'Fetching latest release from GitHub...\n', type: 'info' })

    // Hard-reset to HEAD first to discard any local changes (e.g. npm-modified
    // package-lock.json). More reliable than `git checkout -- .` on Windows.
    const discard = spawn('git', ['reset', '--hard', 'HEAD'], {
      cwd: INSTALL_ROOT,
      shell: true,
      env: { ...process.env }
    })

    discard.on('close', () => {
    // Ignore exit code

    const fetch = spawn('git', ['fetch', 'origin', 'main'], {
      cwd: INSTALL_ROOT,
      shell: true,
      env: { ...process.env }
    })

    fetch.stdout.on('data', (data: Buffer) => {
      win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
    })
    fetch.stderr.on('data', (data: Buffer) => {
      win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
    })

    fetch.on('close', (fetchCode) => {
      if (fetchCode !== 0) {
        resolve({ success: false, error: `git fetch exited with code ${fetchCode}` })
        return
      }

      win?.webContents.send('update:progress', { line: 'Applying update...\n', type: 'info' })

      const reset = spawn('git', ['reset', '--hard', 'origin/main'], {
        cwd: INSTALL_ROOT,
        shell: true,
        env: { ...process.env }
      })

      reset.stdout.on('data', (data: Buffer) => {
        win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
      })
      reset.stderr.on('data', (data: Buffer) => {
        win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
      })

      reset.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `git reset exited with code ${code}` })
          return
        }

        win?.webContents.send('update:progress', { line: '\nInstalling updated dependencies...\n', type: 'info' })

        const npmInstall = spawn('npm', ['install'], {
          cwd: APP_DIR,
          shell: true,
          env: { ...process.env }
        })

        npmInstall.stdout.on('data', (data: Buffer) => {
          win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
        })
        npmInstall.stderr.on('data', (data: Buffer) => {
          win?.webContents.send('update:progress', { line: data.toString(), type: 'output' })
        })

        npmInstall.on('close', (npmCode) => {
          if (npmCode !== 0) {
            resolve({ success: false, error: `npm install exited with code ${npmCode}` })
            return
          }
          win?.webContents.send('update:progress', { line: '\nUpdate complete!\n', type: 'success' })
          resolve({ success: true })
        })
      })
    })
    }) // end discard.on('close')
  })
})

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string
