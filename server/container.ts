import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
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

export interface ContainerOptions {
  databasePath: string
  imagesDir: string
  /** Demo data written into an empty database (and restored by reset). */
  seed?: { items: readonly Item[]; styleMatches: readonly StyleMatch[] }
  /** Enables POST /api/dev/reset (e2e tests only). */
  allowReset?: boolean
  advisor?: () => StyleAdvisor | Promise<StyleAdvisor>
  processor?: ImageProcessor
  clock?: Clock
}

/** Composition root: the only place that knows the concrete server classes. */
export async function createContainer(options: ContainerOptions) {
  const database = openDatabase(options.databasePath)
  const itemRepo = new SqliteItemRepository(database.db)
  const lookRepo = new SqliteStyleMatchRepository(database.db)
  const images = new FsImageStore(options.imagesDir)
  const clock = options.clock ?? systemClock
  const offline = new RuleBasedStyleAdvisor()

  async function seed() {
    return options.seed ? seedIfEmpty(itemRepo, lookRepo, options.seed) : false
  }
  await seed()

  return {
    items: new ItemService(itemRepo, clock),
    photos: new PhotoService(images, options.processor ?? new PassThroughImageProcessor()),
    looks: new StyleMatchService(lookRepo),
    styling: new StylingService(itemRepo, lookRepo, options.advisor ?? (() => offline), clock),
    images,
    allowReset: options.allowReset ?? false,
    async reset() {
      database.clear()
      return seed()
    },
    close: database.close,
  }
}

export type Container = Awaited<ReturnType<typeof createContainer>>
