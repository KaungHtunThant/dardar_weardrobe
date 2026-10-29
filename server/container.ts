import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { PlaceDirectory, PlaceLocator } from '#shared/contracts/PlaceFinder'
import type { WeatherProvider } from '#shared/contracts/WeatherProvider'
import type { SecretStore } from '#shared/contracts/SecretStore'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { RuleBasedGapAdvisor } from '#shared/advisors/RuleBasedGapAdvisor'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { DemoPlaceDirectory, DemoPlaceLocator, DemoWeatherProvider } from '#shared/weather/DemoWeather'
import type { AdvisorMode } from '#shared/models/settings'
import { ClaudeApiGapAdvisor } from './ai/ClaudeApiGapAdvisor'
import { ClaudeApiGarmentAnalyst } from './ai/ClaudeApiGarmentAnalyst'
import { ClaudeApiStyleAdvisor } from './ai/ClaudeApiStyleAdvisor'
import { ClaudeApiTagger } from './ai/ClaudeApiTagger'
import { ClaudeCliGapAdvisor } from './ai/ClaudeCliGapAdvisor'
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
import { analysisPreview } from './infrastructure/analysisPreview'
import { GarmentStudioProcessor } from './infrastructure/GarmentStudioProcessor'
import { PassThroughImageProcessor } from './infrastructure/PassThroughImageProcessor'
import { SegformerClothesSegmenter } from './infrastructure/SegformerClothesSegmenter'
import { WorkerImglyImageProcessor } from './infrastructure/WorkerImglyImageProcessor'
import { SqliteGapReportRepository } from './repositories/SqliteGapReportRepository'
import { SqliteItemRepository } from './repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from './repositories/SqliteStyleMatchRepository'
import { SqliteUploadRepository } from './repositories/SqliteUploadRepository'
import { systemClock, type Clock } from './services/clock'
import { seedIfEmpty } from './services/demoSeed'
import { GapService } from './services/GapService'
import { GarmentPipeline } from './services/GarmentPipeline'
import { ItemService } from './services/ItemService'
import { PhotoService } from './services/PhotoService'
import { StyleMatchService } from './services/StyleMatchService'
import { StylingService } from './services/StylingService'
import { TaggingService } from './services/TaggingService'
import { TodayService } from './services/TodayService'
import { UploadService } from './services/UploadService'
import { WeatherService } from './services/WeatherService'
import { FileSecretStore } from './settings/FileSecretStore'
import { SettingsService, type AdvisorFactory, type AnalystFactory, type GapAdvisorFactory, type TaggerFactory } from './settings/SettingsService'
import { SettingsStore } from './settings/SettingsStore'
import { CachedWeatherProvider } from './weather/CachedWeatherProvider'
import { GeoJsPlaceLocator } from './weather/GeoJsPlaceLocator'
import { OpenMeteoPlaceDirectory } from './weather/OpenMeteoPlaceDirectory'
import { OpenMeteoWeather } from './weather/OpenMeteoWeather'

export interface ContainerOptions {
  databasePath: string
  imagesDir: string
  /** Demo data written into an empty database (and restored by reset). */
  seed?: { items: readonly Item[]; styleMatches: readonly StyleMatch[] }
  /** Enables POST /api/dev/reset (e2e tests only). */
  allowReset?: boolean
  /** Folder for settings.json / secrets.json (defaults to the database's folder). */
  dataDir?: string
  /** Cuts garments out of photos; tests leave it out (pass-through), the app uses the garment studio. */
  imaging?: 'pass-through' | 'studio'
  clock?: Clock
  /** Spawns the Claude CLI; tests pass a fake. */
  runner?: ProcessRunner
  secrets?: SecretStore
  advisors?: AdvisorFactory
  taggers?: TaggerFactory
  analysts?: AnalystFactory
  gapAdvisors?: GapAdvisorFactory
  defaultAdvisor?: 'auto' | AdvisorMode
  envApiKey?: () => string | null
  /** Forecasts and city search: Open-Meteo in the app; the offline demo in tests and e2e (the default). */
  weather?: 'demo' | 'open-meteo'
  /** Overrides for single weather services (tests). */
  forecasts?: WeatherProvider
  places?: PlaceDirectory
  locator?: PlaceLocator
}

/** Real AI per mode, every Claude call running as the stylist agent; one SDK client per API key. */
function aiFactories(
  runner: ProcessRunner,
  agent: StylistAgent,
  offlineGaps: RuleBasedGapAdvisor,
): { advisors: AdvisorFactory; taggers: TaggerFactory; analysts: AnalystFactory; gapAdvisors: GapAdvisorFactory } {
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
    gapAdvisors: {
      offline: () => offlineGaps,
      cli: (s) => new ClaudeCliGapAdvisor({ runner, model: s.model, agent }),
      api: (s, apiKey) => new ClaudeApiGapAdvisor({ messages: messages(apiKey), model: s.model, effort: s.effort, agent }),
    },
  }
}

/** Open-Meteo (forecasts cached) and GeoJS in the app; network-free stand-ins otherwise. */
function weatherServices(options: ContainerOptions, clock: Clock) {
  const live = options.weather === 'open-meteo'
  return {
    provider: options.forecasts ?? (live ? new CachedWeatherProvider(new OpenMeteoWeather()) : new DemoWeatherProvider(() => clock.now())),
    places: options.places ?? (live ? new OpenMeteoPlaceDirectory() : new DemoPlaceDirectory()),
    locator: options.locator ?? (live ? new GeoJsPlaceLocator() : new DemoPlaceLocator()),
  }
}

/** The garment studio (local models) in the app; the photo unchanged in tests. */
function imageProcessor(imaging: ContainerOptions['imaging']): ImageProcessor {
  if (imaging !== 'studio') return new PassThroughImageProcessor()
  // The background remover runs in a worker thread so the API keeps answering while photos are prepared.
  return new GarmentStudioProcessor({ matte: new WorkerImglyImageProcessor(), segmenter: new SegformerClothesSegmenter() })
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
  // One offline gap finder: what "Offline" resolves to and the fallback, so reports say who wrote them.
  const offlineGaps = new RuleBasedGapAdvisor()
  const ai = aiFactories(runner, agent, offlineGaps)
  const settings = new SettingsService({
    store: settingsStore,
    agent,
    secrets: options.secrets ?? new FileSecretStore(join(dataDir, 'secrets.json')),
    runner,
    advisors: options.advisors ?? ai.advisors,
    taggers: options.taggers ?? ai.taggers,
    analysts: options.analysts ?? ai.analysts,
    gapAdvisors: options.gapAdvisors ?? ai.gapAdvisors,
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

  const pipeline = new GarmentPipeline({
    images,
    processor: imageProcessor(options.imaging),
    analyst: () => settings.resolveAnalyst(),
    preview: options.imaging === 'studio' ? analysisPreview : undefined,
  })

  const weather = new WeatherService({ location: () => settings.location(), clock, ...weatherServices(options, clock) })
  const items = new ItemService(itemRepo, lookRepo, images, clock)
  const uploads = new UploadService({ uploads: new SqliteUploadRepository(database.db), images, pipeline, items, clock })
  // Photos still waiting when the app last closed are prepared now.
  await uploads.resume()

  return {
    items,
    photos: new PhotoService(images, pipeline),
    uploads,
    looks: new StyleMatchService(lookRepo),
    styling: new StylingService(itemRepo, lookRepo, () => settings.resolveAdvisor(), clock, weather),
    settings,
    tagging: new TaggingService(images, () => settings.resolveTagger()),
    today: new TodayService(itemRepo, lookRepo, () => settings.resolveAdvisor(), new RuleBasedStyleAdvisor(), clock, weather),
    gaps: new GapService({
      items: itemRepo,
      reports: new SqliteGapReportRepository(database.db),
      advisor: () => settings.resolveGapAdvisor(),
      fallback: offlineGaps,
      weather,
      clock,
    }),
    weather,
    images,
    allowReset: options.allowReset ?? false,
    /** The user's "start fresh": every item, look and photo goes; settings and the API key stay. */
    async clearWardrobe() {
      await uploads.stopAll()
      database.clear()
      await images.clear()
      writeFileSync(clearedMarker, new Date().toISOString())
    },
    /** Test-only: back to the demo seed with default settings. */
    async reset() {
      await uploads.stopAll()
      database.clear()
      settingsStore.clear()
      rmSync(clearedMarker, { force: true })
      return seed()
    },
    async close() {
      await uploads.stopAll()
      database.close()
    },
  }
}

export type Container = Awaited<ReturnType<typeof createContainer>>
