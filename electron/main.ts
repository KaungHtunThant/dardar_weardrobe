import { app, BrowserWindow, safeStorage, shell, utilityProcess, type UtilityProcess } from 'electron'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
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

interface SecretRequest {
  type: 'secret:get' | 'secret:set'
  id: number
  value?: string | null
}

const secretFile = () => join(app.getPath('userData'), 'anthropic-key.bin')

/** The server asks for the API key over the utility-process port; it is encrypted with the OS keychain. */
function answerSecretRequest(child: UtilityProcess, msg: SecretRequest) {
  if (msg?.type !== 'secret:get' && msg?.type !== 'secret:set') return
  try {
    let value: string | null = null
    if (msg.type === 'secret:set') {
      if (msg.value) writeFileSync(secretFile(), safeStorage.encryptString(msg.value), { mode: 0o600 })
      else rmSync(secretFile(), { force: true })
      value = msg.value ?? null
    } else {
      try {
        value = safeStorage.decryptString(readFileSync(secretFile()))
      } catch {
        value = null
      }
    }
    child.postMessage({ type: 'secret:result', id: msg.id, value })
  } catch (e) {
    child.postMessage({ type: 'secret:result', id: msg.id, value: null, error: (e as Error).message })
  }
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
      NUXT_DATA_DIR: app.getPath('userData'),
      NUXT_DEMO_SEED: 'false',
      NUXT_ALLOW_RESET: 'false',
    },
    stdio: 'inherit',
  })
  child.on('message', (msg: SecretRequest) => answerSecretRequest(child, msg))
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
