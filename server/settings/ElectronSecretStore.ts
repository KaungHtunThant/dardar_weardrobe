import type { KeyStorage, SecretStore } from '#shared/contracts/SecretStore'
import { ValidationError } from '#shared/errors'

/** Electron's utility-process port (`process.parentPort`). */
export interface ParentPort {
  on(event: 'message', listener: (e: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

interface SecretResult {
  type: 'secret:result'
  id: number
  value: string | null
  error?: string
}

/**
 * Packaged app: the Nitro server runs in an Electron utility process and asks the main process,
 * which encrypts the key with `safeStorage` (OS keychain). The key never touches disk in plain text;
 * without a keychain it isn't stored at all.
 */
export class ElectronSecretStore implements SecretStore {
  private nextId = 1
  private readonly pending = new Map<number, (r: SecretResult) => void>()

  constructor(private readonly port: ParentPort) {
    port.on('message', ({ data }) => {
      const msg = data as SecretResult
      if (msg?.type === 'secret:result') this.pending.get(msg.id)?.(msg)
    })
  }

  private request(type: 'secret:status' | 'secret:get' | 'secret:set', value?: string | null): Promise<string | null> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('The app did not answer the key request.'))
      }, 5000)
      this.pending.set(id, (r) => {
        clearTimeout(timer)
        this.pending.delete(id)
        if (r.error === 'unavailable')
          reject(
            new ValidationError(
              "This computer has no system keychain (such as GNOME Keyring or KWallet), so the key can't be stored safely. Set the ANTHROPIC_API_KEY environment variable before starting the app instead.",
            ),
          )
        else if (r.error) reject(new Error(r.error))
        else resolve(r.value)
      })
      this.port.postMessage({ type, id, value })
    })
  }

  async storage(): Promise<KeyStorage> {
    return (await this.request('secret:status')) === 'keychain' ? 'keychain' : 'unavailable'
  }

  getApiKey() {
    return this.request('secret:get')
  }

  async setApiKey(key: string | null) {
    await this.request('secret:set', key)
  }
}
