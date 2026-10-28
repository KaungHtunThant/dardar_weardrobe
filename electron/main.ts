import { app, BrowserWindow, utilityProcess, shell } from 'electron'
import { createServer } from 'node:net'
import { join } from 'node:path'

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'
const DEV_URL = process.env.DARDAR_URL ?? 'http://localhost:3000'

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    })
  })
}

/** In production the built Nitro server runs in a utility process bound to localhost. */
async function startNitro(): Promise<string> {
  const port = await freePort()
  const entry = join(app.getAppPath(), '.output', 'server', 'index.mjs')
  const child = utilityProcess.fork(entry, [], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATA_DIR: app.getPath('userData'),
    },
    stdio: 'inherit',
  })
  app.on('before-quit', () => child.kill())
  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url)
      return url
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  throw new Error('Nitro server did not start')
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#FBF8F5',
    title: 'Dardar Wardrobe',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  await win.loadURL(isDev ? DEV_URL : await startNitro())
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
