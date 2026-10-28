import { app, BrowserWindow, safeStorage, shell, utilityProcess } from 'electron'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { serverEntry } from './paths'
import { createSecretHandler, type SecretRequest } from './secrets'

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

const secretFile = () => join(app.getPath('userData'), 'anthropic-key.bin')

/** The API key is encrypted by the OS keychain (safeStorage) and only stored that way. */
const handleSecret = createSecretHandler({
  available: () => safeStorage.isAsyncEncryptionAvailable(),
  encrypt: (text) => safeStorage.encryptStringAsync(text),
  decrypt: async (data) => (await safeStorage.decryptStringAsync(data)).result,
  read: () => {
    try {
      return readFileSync(secretFile())
    } catch {
      return null
    }
  },
  write: (data) => writeFileSync(secretFile(), data, { mode: 0o600 }),
  remove: () => rmSync(secretFile(), { force: true }),
})

/** In production the built Nitro server runs in a utility process bound to localhost. */
async function startNitro(): Promise<string> {
  const port = await freePort()
  const entry = serverEntry({ isPackaged: app.isPackaged, appPath: app.getAppPath(), resourcesPath: process.resourcesPath })
  const child = utilityProcess.fork(entry, [], {
    cwd: dirname(entry),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NUXT_DATA_DIR: app.getPath('userData'),
      NUXT_DEMO_SEED: 'false',
      NUXT_ALLOW_RESET: 'false',
    },
    stdio: 'inherit',
  })
  child.on('message', (msg: SecretRequest) => void handleSecret(msg).then((reply) => reply && child.postMessage(reply)))
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
