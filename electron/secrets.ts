/** Messages the server (utility process) sends about the API key, and the main process's replies. */
export interface SecretRequest {
  type: string
  id: number
  value?: string | null
}

export interface SecretReply {
  type: 'secret:result'
  id: number
  value: string | null
  /** `unavailable` when there is no OS keychain to encrypt with; otherwise a message. */
  error?: string
}

/** The OS keychain (Electron safeStorage) and the file holding the encrypted key, injectable for tests. */
export interface SecretDeps {
  available(): Promise<boolean>
  encrypt(text: string): Promise<Buffer>
  decrypt(data: Buffer): Promise<string>
  read(): Buffer | null
  write(data: Buffer): void
  remove(): void
}

/**
 * Answers the server's key requests in the main process. The key is only ever written encrypted
 * by the OS keychain; without one (e.g. Linux with no keyring) storing it is refused.
 */
export function createSecretHandler(deps: SecretDeps) {
  return async (msg: SecretRequest): Promise<SecretReply | null> => {
    const reply = (value: string | null, error?: string): SecretReply => ({ type: 'secret:result', id: msg.id, value, ...(error ? { error } : {}) })
    try {
      switch (msg.type) {
        case 'secret:status':
          return reply((await deps.available()) ? 'keychain' : 'unavailable')
        case 'secret:get': {
          const data = deps.read()
          if (!data) return reply(null)
          try {
            return reply(await deps.decrypt(data))
          } catch {
            return reply(null)
          }
        }
        case 'secret:set':
          if (!msg.value) {
            deps.remove()
            return reply(null)
          }
          if (!(await deps.available())) return reply(null, 'unavailable')
          deps.write(await deps.encrypt(msg.value))
          return reply(msg.value)
        default:
          return null
      }
    } catch (e) {
      return reply(null, (e as Error).message)
    }
  }
}
