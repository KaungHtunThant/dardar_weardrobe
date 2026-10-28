import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { SecretStore } from '#shared/contracts/SecretStore'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import type { AdvisorMode } from '#shared/models/settings'
import { ClaudeApiGarmentAnalyst } from './ai/ClaudeApiGarmentAnalyst'
import { ClaudeApiStyleAdvisor } from './ai/ClaudeApiStyleAdvisor'
import { ClaudeApiTagger } from './ai/ClaudeApiTagger'
import { ClaudeCliGarmentAnalyst } from './ai/ClaudeCliGarmentAnalyst'
import { ClaudeCliStyleAdvisor } from './ai/ClaudeCliStyleAdvisor'
import { ClaudeCliTagger } from './ai/ClaudeCliTagger'
import { OfflineGarmentAnalyst } from './ai/OfflineGarmentAnalyst'
import { runProcess, type ProcessRunner } from './ai/process'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { LocalStylistAgent } from './agent/LocalStylistAgent'
import { openDatabase } from './database/connection'
import { FsImageStore } from './infrastructure/FsImageStore'
import { PassThroughImageProcessor } from './infrastructure/PassThroughImageProcessor'
import { SqliteItemRepository } from './repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from './repositories/SqliteStyleMatchRepository'
import { systemClock, type Clock } from './services/clock'
import { seedIfEmpty } from './services/demoSeed'
import { ItemService } from './services/ItemService'
import { PhotoService } from './services/PhotoService'
import { StyleMatchService } from './services/StyleMatchService'
import { StylingService } from './services/StylingService'
import { TaggingService } from './services/TaggingService'
import { TodayService } from './services/TodayService'
import { FileSecretStore } from './settings/FileSecretStore'
import { SettingsService, type AdvisorFactory, type AnalystFactory, type TaggerFactory } from './settings/SettingsService'
import { SettingsStore } from './settings/SettingsStore'

export interface ContainerOptions {
  databasePath: string
  imagesDir: string
  /** Demo data written into an empty database (and restored by reset). */
  seed?: { items: readonly Item[]; styleMatches: readonly StyleMatch[] }
  /** Enables POST /api/dev/reset (e2e tests only). */
  allowReset?: boolean
  /** Folder for settings.json / secrets.json (defaults to the database's folder). */
  dataDir?: string
  processor?: ImageProcessor
  clock?: Clock
  /** Spawns the Claude CLI; tests pass a fake. */
  runner?: ProcessRunner
  secrets?: SecretStore
  advisors?: AdvisorFactory
  taggers?: TaggerFactory
  analysts?: AnalystFactory
  defaultAdvisor?: 'auto' | AdvisorMode
  envApiKey?: () => string | null
}

/** Real AI per mode, every Claude call running as the stylist agent; one SDK client per API key. */
function aiFactories(runner: ProcessRunner, agent: StylistAgent): { advisors: AdvisorFactory; taggers: TaggerFactory; analysts: AnalystFactory } {
  const offline = new RuleBasedStyleAdvisor()
  const clients = new Map<string, Anthropic>()
  const messages = (apiKey: string) => {
    if (!clients.has(apiKey)) clients.set(apiKey, new Anthropic({ apiKey }))
    return clients.get(apiKey)!.beta.messages
  }
  return {
    advisors: {
      offline: () => offline,
      cli: (s) => new ClaudeCliStyleAdvisor({ runner, model: s.model, agent }),
      api: (s, apiKey) => new ClaudeApiStyleAdvisor({ messages: messages(apiKey), model: s.model, effort: s.effort, agent }),
    },
    taggers: {
      offline: () => ({ suggestDetails: async () => ({}) }),
      cli: (s) => new ClaudeCliTagger({ runner, model: s.model, agent }),
      api: (s, apiKey) => new ClaudeApiTagger({ messages: messages(apiKey), model: s.model, agent }),
    },
    analysts: {
      offline: () => new OfflineGarmentAnalyst(),
      cli: (s) => new ClaudeCliGarmentAnalyst({ runner, model: s.model, agent }),
      api: (s, apiKey) => new ClaudeApiGarmentAnalyst({ messages: messages(apiKey), model: s.model, agent }),
    },
  }
}

/** Composition root: the only place that knows the concrete server classes. */
export async function createContainer(options: ContainerOptions) {
  const database = openDatabase(options.databasePath)
  const itemRepo = new SqliteItemRepository(database.db)
  const lookRepo = new SqliteStyleMatchRepository(database.db)
  const images = new FsImageStore(options.imagesDir)
  const clock = options.clock ?? systemClock
  const dataDir = options.dataDir ?? (options.databasePath === ':memory:' ? options.imagesDir : dirname(options.databasePath))
  const runner = options.runner ?? runProcess
  const settingsStore = new SettingsStore(join(dataDir, 'settings.json'))
  const agent = new LocalStylistAgent(join(dataDir, 'agent'), clock)
  const ai = aiFactories(runner, agent)
  const settings = new SettingsService({
    store: settingsStore,
    agent,
    secrets: options.secrets ?? new FileSecretStore(join(dataDir, 'secrets.json')),
    runner,
    advisors: options.advisors ?? ai.advisors,
    taggers: options.taggers ?? ai.taggers,
    analysts: options.analysts ?? ai.analysts,
    envApiKey: options.envApiKey ?? (() => process.env.ANTHROPIC_API_KEY || null),
    defaultAdvisor: options.defaultAdvisor ?? 'auto',
  })
  // First launch on this device: set up the stylist agent and keep the stylist picked for the user.
  await settings.setUp()

  // After the user clears their wardrobe, demo data must not come back on the next start.
  const clearedMarker = join(dataDir, 'wardrobe-cleared')
  async function seed() {
    return options.seed && !existsSync(clearedMarker) ? seedIfEmpty(itemRepo, lookRepo, options.seed) : false
  }
  await seed()

  return {
    items: new ItemService(itemRepo, lookRepo, images, clock),
    photos: new PhotoService(images, options.processor ?? new PassThroughImageProcessor()),
    looks: new StyleMatchService(lookRepo),
    styling: new StylingService(itemRepo, lookRepo, () => settings.resolveAdvisor(), clock),
    settings,
    tagging: new TaggingService(images, () => settings.resolveTagger()),
    today: new TodayService(itemRepo, lookRepo, () => settings.resolveAdvisor(), new RuleBasedStyleAdvisor(), clock),
    images,
    allowReset: options.allowReset ?? false,
    /** The user's "start fresh": every item, look and photo goes; settings and the API key stay. */
    async clearWardrobe() {
      database.clear()
      await images.clear()
      writeFileSync(clearedMarker, new Date().toISOString())
    },
    /** Test-only: back to the demo seed with default settings. */
    async reset() {
      database.clear()
      settingsStore.clear()
      rmSync(clearedMarker, { force: true })
      return seed()
    },
    close: database.close,
  }
}

export type Container = Awaited<ReturnType<typeof createContainer>>
