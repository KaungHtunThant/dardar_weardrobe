import { dirname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { SecretStore } from '#shared/contracts/SecretStore'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import type { AdvisorMode } from '#shared/models/settings'
import { ClaudeApiStyleAdvisor } from './ai/ClaudeApiStyleAdvisor'
import { ClaudeCliStyleAdvisor } from './ai/ClaudeCliStyleAdvisor'
import { runProcess, type ProcessRunner } from './ai/process'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
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
import { FileSecretStore } from './settings/FileSecretStore'
import { SettingsService, type AdvisorFactory } from './settings/SettingsService'
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
  defaultAdvisor?: 'auto' | AdvisorMode
  envApiKey?: () => string | null
}

/** Real advisors per mode; one SDK client per API key. */
function advisorFactory(runner: ProcessRunner): AdvisorFactory {
  const offline = new RuleBasedStyleAdvisor()
  const clients = new Map<string, Anthropic>()
  return {
    offline: () => offline,
    cli: (s) => new ClaudeCliStyleAdvisor({ runner, model: s.model }),
    api: (s, apiKey) => {
      if (!clients.has(apiKey)) clients.set(apiKey, new Anthropic({ apiKey }))
      return new ClaudeApiStyleAdvisor({ messages: clients.get(apiKey)!.beta.messages, model: s.model, effort: s.effort })
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
  const settings = new SettingsService({
    store: settingsStore,
    secrets: options.secrets ?? new FileSecretStore(join(dataDir, 'secrets.json')),
    runner,
    advisors: options.advisors ?? advisorFactory(runner),
    envApiKey: options.envApiKey ?? (() => process.env.ANTHROPIC_API_KEY || null),
    defaultAdvisor: options.defaultAdvisor ?? 'auto',
  })

  async function seed() {
    return options.seed ? seedIfEmpty(itemRepo, lookRepo, options.seed) : false
  }
  await seed()

  return {
    items: new ItemService(itemRepo, clock),
    photos: new PhotoService(images, options.processor ?? new PassThroughImageProcessor()),
    looks: new StyleMatchService(lookRepo),
    styling: new StylingService(itemRepo, lookRepo, () => settings.resolveAdvisor(), clock),
    settings,
    images,
    allowReset: options.allowReset ?? false,
    async reset() {
      database.clear()
      settingsStore.clear()
      return seed()
    },
    close: database.close,
  }
}

export type Container = Awaited<ReturnType<typeof createContainer>>
