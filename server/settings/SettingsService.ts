import type { SecretStore } from '#shared/contracts/SecretStore'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import { ValidationError } from '#shared/errors'
import { DEFAULT_MODEL, SettingsSchema, SettingsUpdateSchema, type AdvisorMode, type Settings, type SettingsView } from '#shared/models/settings'
import { claudeCliVersion } from '../ai/claudeCli'
import type { ProcessRunner } from '../ai/process'
import { parseOrThrow } from '../services/validation'
import type { SettingsStore } from './SettingsStore'

/** How each mode's advisor is built (concrete classes are wired in the container). */
export interface AdvisorFactory {
  offline(): StyleAdvisor
  cli(settings: Settings): StyleAdvisor
  api(settings: Settings, apiKey: string): StyleAdvisor
}

export interface SettingsServiceOptions {
  store: SettingsStore
  secrets: SecretStore
  runner: ProcessRunner
  advisors: AdvisorFactory
  /** ANTHROPIC_API_KEY from the environment, which wins over a stored key. */
  envApiKey: () => string | null
  /** 'auto' picks CLI → API → Offline on first run; tests pin 'offline'. */
  defaultAdvisor: 'auto' | AdvisorMode
}

const CLI_CHECK_MS = 60_000

export class SettingsService {
  private cliCheck: { at: number; version: Promise<string | null> } | null = null

  constructor(private readonly o: SettingsServiceOptions) {}

  private cliVersion() {
    if (!this.cliCheck || Date.now() - this.cliCheck.at > CLI_CHECK_MS)
      this.cliCheck = { at: Date.now(), version: claudeCliVersion(this.o.runner) }
    return this.cliCheck.version
  }

  private async apiKey(): Promise<{ key: string; source: 'env' | 'stored' } | null> {
    const env = this.o.envApiKey()
    if (env) return { key: env, source: 'env' }
    const stored = await this.o.secrets.getApiKey()
    return stored ? { key: stored, source: 'stored' } : null
  }

  private async current(): Promise<Settings> {
    const saved = this.o.store.load()
    let advisor = saved?.advisor
    if (!advisor) {
      if (this.o.defaultAdvisor !== 'auto') advisor = this.o.defaultAdvisor
      else if (await this.cliVersion()) advisor = 'claude-cli'
      else if (await this.apiKey()) advisor = 'claude-api'
      else advisor = 'offline'
    }
    return SettingsSchema.parse({ model: DEFAULT_MODEL, ...saved, advisor })
  }

  async get(): Promise<SettingsView> {
    const [settings, key, version] = await Promise.all([this.current(), this.apiKey(), this.cliVersion()])
    return {
      ...settings,
      apiKey: { present: Boolean(key), source: key?.source ?? null, last4: key ? key.key.slice(-4) : null },
      cli: { available: Boolean(version), version },
      secureStorage: this.o.secrets.secure,
    }
  }

  async update(input: unknown): Promise<SettingsView> {
    const { apiKey, ...changes } = parseOrThrow(SettingsUpdateSchema, input)
    if (apiKey !== undefined) await this.o.secrets.setApiKey(apiKey)
    this.o.store.save(SettingsSchema.parse({ ...(await this.current()), ...changes }))
    return this.get()
  }

  /** The advisor for the next request, per the current settings. */
  async resolveAdvisor(): Promise<StyleAdvisor> {
    const settings = await this.current()
    if (settings.advisor === 'offline') return this.o.advisors.offline()
    if (settings.advisor === 'claude-cli') return this.o.advisors.cli(settings)
    const key = await this.apiKey()
    if (!key) throw new ValidationError('Add your Anthropic API key in Settings, or switch the stylist to Claude CLI or Offline.')
    return this.o.advisors.api(settings, key.key)
  }
}
