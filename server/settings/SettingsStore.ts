import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Settings } from '#shared/models/settings'

/** Persists the user's choices as JSON (no secrets in here). */
export class SettingsStore {
  constructor(private readonly path: string) {}

  load(): Partial<Settings> | null {
    try {
      return JSON.parse(readFileSync(this.path, 'utf8')) as Partial<Settings>
    } catch {
      return null
    }
  }

  clear() {
    rmSync(this.path, { force: true })
  }

  save(settings: Settings) {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(settings, null, 2))
  }
}
