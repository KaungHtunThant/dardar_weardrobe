import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { SecretStore } from '#shared/contracts/SecretStore'

/** Dev fallback: a file only the current user can read (0600). The packaged app uses the OS keychain. */
export class FileSecretStore implements SecretStore {
  async storage() {
    return 'private-file' as const
  }

  constructor(private readonly path: string) {}

  async getApiKey() {
    try {
      return (JSON.parse(readFileSync(this.path, 'utf8')) as { anthropicApiKey?: string }).anthropicApiKey ?? null
    } catch {
      return null
    }
  }

  async setApiKey(key: string | null) {
    if (key === null) {
      rmSync(this.path, { force: true })
      return
    }
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify({ anthropicApiKey: key }), { mode: 0o600 })
    chmodSync(this.path, 0o600)
  }
}
