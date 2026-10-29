import type { GapAdvisor } from '#shared/contracts/GapAdvisor'
import type { GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { GarmentTagger } from '#shared/contracts/GarmentTagger'
import type { SecretStore } from '#shared/contracts/SecretStore'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import type { StylistAgentInfo } from '#shared/models/agent'
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

export interface TaggerFactory {
  offline(): GarmentTagger
  cli(settings: Settings): GarmentTagger
  api(settings: Settings, apiKey: string): GarmentTagger
}

export interface AnalystFactory {
  offline(): GarmentAnalyst
  cli(settings: Settings): GarmentAnalyst
  api(settings: Settings, apiKey: string): GarmentAnalyst
}

export interface GapAdvisorFactory {
  offline(): GapAdvisor
  cli(settings: Settings): GapAdvisor
  api(settings: Settings, apiKey: string): GapAdvisor
}

/** The on-device stylist agent, as far as settings are concerned. */
export interface StylistAgentSetup {
  info(): StylistAgentInfo | null
  ensure(): StylistAgentInfo
  recreate(): StylistAgentInfo
}

export interface SettingsServiceOptions {
  store: SettingsStore
  /** The stylist agent every Claude call runs as; set up on first launch. */
  agent?: StylistAgentSetup
  secrets: SecretStore
  runner: ProcessRunner
  advisors: AdvisorFactory
  taggers?: TaggerFactory
  analysts?: AnalystFactory
  /** Who finds what the wardrobe is missing. */
  gapAdvisors?: GapAdvisorFactory
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

  /**
   * First launch (and every start after): makes sure the stylist agent exists and saves the
   * stylist picked automatically, so the choice no longer changes behind the user's back.
   */
  async setUp(): Promise<void> {
    this.o.agent?.ensure()
    if (!this.o.store.load()?.advisor) this.o.store.save(await this.current())
  }

  async recreateAgent(): Promise<SettingsView> {
    this.o.agent?.recreate()
    return this.get()
  }

  async get(): Promise<SettingsView> {
    const [settings, key, version] = await Promise.all([this.current(), this.apiKey(), this.cliVersion()])
    return {
      ...settings,
      agent: this.o.agent?.info() ?? null,
      apiKey: { present: Boolean(key), source: key?.source ?? null, last4: key ? key.key.slice(-4) : null },
      cli: { available: Boolean(version), version },
      keyStorage: await this.o.secrets.storage(),
    }
  }

  async update(input: unknown): Promise<SettingsView> {
    const { apiKey, ...changes } = parseOrThrow(SettingsUpdateSchema, input)
    if (apiKey !== undefined) await this.o.secrets.setApiKey(apiKey)
    this.o.store.save(SettingsSchema.parse({ ...(await this.current()), ...changes }))
    return this.get()
  }

  /** Where the user lives (null until they say). */
  async location() {
    return (await this.current()).location
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

  /** The garment tagger for add-item pre-fill; without a usable AI it suggests nothing. */
  async resolveTagger(): Promise<GarmentTagger> {
    const t = this.o.taggers
    return t ? this.pick(t) : { suggestDetails: async () => ({}) }
  }

  /** The analyst that finds the garment in a new upload; without a usable AI it finds nothing. */
  async resolveAnalyst(): Promise<GarmentAnalyst> {
    const a = this.o.analysts
    return a ? this.pick(a) : { analyze: async () => ({ focus: null, worn: false, details: {} }) }
  }

  /** Who finds what the wardrobe is missing; the offline rules when no AI can run. */
  async resolveGapAdvisor(): Promise<GapAdvisor> {
    const g = this.o.gapAdvisors
    return g ? this.pick(g) : { suggestGaps: async () => [] }
  }

  /** CLI or API per the settings; offline when that mode can't run (no API key). */
  private async pick<T>(f: { offline(): T; cli(s: Settings): T; api(s: Settings, key: string): T }): Promise<T> {
    const settings = await this.current()
    if (settings.advisor === 'claude-cli') return f.cli(settings)
    if (settings.advisor === 'claude-api') {
      const key = await this.apiKey()
      return key ? f.api(settings, key.key) : f.offline()
    }
    return f.offline()
  }
}
