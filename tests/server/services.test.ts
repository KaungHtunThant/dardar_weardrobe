import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ImageProcessor } from '#shared/contracts/ImageProcessor'
import { NotFoundError, ValidationError } from '#shared/errors'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { openDatabase } from '../../server/database/connection'
import { FsImageStore } from '../../server/infrastructure/FsImageStore'
import { PassThroughImageProcessor } from '../../server/infrastructure/PassThroughImageProcessor'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { ItemService } from '../../server/services/ItemService'
import { PhotoService } from '../../server/services/PhotoService'
import { GarmentPipeline } from '../../server/services/GarmentPipeline'
import { OfflineGarmentAnalyst } from '../../server/ai/OfflineGarmentAnalyst'
import { StyleMatchService } from '../../server/services/StyleMatchService'
import { StylingService } from '../../server/services/StylingService'
import type { StyleAdvisor, StyleProgress } from '#shared/contracts/StyleAdvisor'
import { seedIfEmpty } from '../../server/services/demoSeed'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const clock = { now: () => new Date('2026-10-28T12:00:00.000Z'), newId: () => 'fixed' }

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function repos() {
  const { db } = openDatabase(':memory:')
  return { items: new SqliteItemRepository(db), looks: new SqliteStyleMatchRepository(db) }
}

describe('FsImageStore', () => {
  it('saves images and reads them back by reference', async () => {
    const store = new FsImageStore(dir)
    const ref = await store.save(PNG, 'image/png')
    expect(ref).toMatch(/^\/api\/images\/[a-f0-9-]+\.png$/)
    expect(await store.read(ref)).toEqual({ bytes: PNG, mimeType: 'image/png' })
  })

  it('refuses ids that could escape the image folder', async () => {
    const store = new FsImageStore(dir)
    expect(await store.read('../../etc/passwd')).toBeNull()
    expect(await store.read('/api/images/nope.png')).toBeNull()
  })
})

describe('ItemService', () => {
  it('creates a validated item with id and timestamp', async () => {
    const { items } = repos()
    const service = new ItemService(items, repos().looks, new FsImageStore(dir), clock)
    const item = await service.create({ name: ' Beret ', category: 'accessories', originalImage: 'a', cleanImage: 'b' })
    expect(item).toMatchObject({ id: 'item-fixed', name: 'Beret', isFavourite: false, createdAt: '2026-10-28T12:00:00.000Z' })
    expect(await service.list()).toEqual([item])
  })

  it('rejects invalid details with a ValidationError', async () => {
    const service = new ItemService(repos().items, repos().looks, new FsImageStore(dir), clock)
    await expect(service.create({ name: '', category: 'tops', originalImage: 'a', cleanImage: 'b' })).rejects.toBeInstanceOf(ValidationError)
    await expect(service.create({ name: 'X', category: 'tops' })).rejects.toBeInstanceOf(ValidationError)
  })
})

function photoService(processor: ImageProcessor = new PassThroughImageProcessor()) {
  const images = new FsImageStore(dir)
  return new PhotoService(images, new GarmentPipeline({ images, processor, analyst: async () => new OfflineGarmentAnalyst(), log: () => {} }))
}

describe('PhotoService', () => {
  it('stores the original and the background-removed image', async () => {
    const service = photoService()
    const photo = await service.process(PNG, 'image/png')
    expect(photo.originalImage).not.toBe(photo.cleanImage)
    expect(photo.backgroundRemoved).toBe(true)
  })

  it('keeps the original when background removal fails', async () => {
    const failing: ImageProcessor = { removeBackground: async () => Promise.reject(new Error('model missing')) }
    const photo = await photoService(failing).process(PNG, 'image/png')
    expect(photo.cleanImage).toBe(photo.originalImage)
    expect(photo.backgroundRemoved).toBe(false)
  })

  it('rejects files that are not images, or empty', async () => {
    const service = photoService()
    await expect(service.process(PNG, 'text/plain')).rejects.toBeInstanceOf(ValidationError)
    await expect(service.process(new Uint8Array(), 'image/png')).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('StyleMatchService', () => {
  it('lists looks and toggles favourites', async () => {
    const { looks } = repos()
    for (const look of seedStyleMatches) await looks.insert(look)
    const service = new StyleMatchService(looks)
    const target = seedStyleMatches.find((l) => !l.isFavourite)!
    expect((await service.setFavourite(target.id, true)).isFavourite).toBe(true)
    expect((await service.list()).find((l) => l.id === target.id)!.isFavourite).toBe(true)
    await expect(service.setFavourite('nope', true)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('StylingService', () => {
  async function setup() {
    const r = repos()
    for (const item of seedItems) await r.items.insert(item)
    return { ...r, service: new StylingService(r.items, r.looks, () => new RuleBasedStyleAdvisor(), clock) }
  }

  it('completes, rates and saves a look', async () => {
    const { service, looks } = await setup()
    const look = await service.generate({ pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes'], prompt: 'coffee' })
    expect(look).toMatchObject({ id: 'look-fixed', prompt: 'coffee' })
    expect(look.rating?.score).toBeGreaterThanOrEqual(1)
    expect(await looks.findById('look-fixed')).toEqual(look)
  })

  it('reports reading first, then the stylist\'s own progress', async () => {
    const r = await setup()
    const advisor: StyleAdvisor = {
      suggestLook(req, options) {
        options?.onProgress?.({ stage: 'picking', aiItemIds: [] })
        return new RuleBasedStyleAdvisor().suggestLook(req)
      },
    }
    const service = new StylingService(r.items, r.looks, () => advisor, clock)
    const progress: StyleProgress[] = []
    await service.generate({ pinnedItemIds: ['item-linen-tee'], fillCategories: ['shoes'] }, { onProgress: (p) => progress.push(p) })
    expect(progress).toEqual([
      { stage: 'reading', aiItemIds: [] },
      { stage: 'picking', aiItemIds: [] },
    ])
  })

  it('saves nothing when cancelled, even if the stylist answers anyway', async () => {
    const r = await setup()
    const controller = new AbortController()
    const stubborn: StyleAdvisor = {
      suggestLook(req) {
        controller.abort()
        return new RuleBasedStyleAdvisor().suggestLook(req)
      },
    }
    const service = new StylingService(r.items, r.looks, () => stubborn, clock)
    await expect(service.generate({ fillCategories: ['tops'] }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    expect(await r.looks.findAll()).toHaveLength(0)
  })

  it('rejects empty requests and unknown pieces', async () => {
    const { service } = await setup()
    await expect(service.generate({ pinnedItemIds: [], fillCategories: [] })).rejects.toBeInstanceOf(ValidationError)
    await expect(service.generate({ pinnedItemIds: ['item-ghost'] })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('seedIfEmpty', () => {
  it('seeds an empty wardrobe once', async () => {
    const { items, looks } = repos()
    const seed = { items: seedItems, styleMatches: seedStyleMatches }
    expect(await seedIfEmpty(items, looks, seed)).toBe(true)
    expect(await seedIfEmpty(items, looks, seed)).toBe(false)
    expect(await items.findAll()).toHaveLength(seedItems.length)
  })
})

describe('StylingService with nothing to style', () => {
  it('rejects instead of saving an empty look', async () => {
    const r = repos()
    const service = new StylingService(r.items, r.looks, () => new RuleBasedStyleAdvisor(), clock)
    await expect(service.generate({ fillCategories: ['tops'] })).rejects.toThrow(/nothing to style/i)
    expect(await r.looks.findAll()).toHaveLength(0)
  })
})

describe('FsImageStore.clear', () => {
  it('removes every stored image', async () => {
    const store = new FsImageStore(dir)
    const ref = await store.save(PNG, 'image/png')
    await store.clear()
    expect(await store.read(ref)).toBeNull()
    expect(await store.read(await store.save(PNG, 'image/png'))).not.toBeNull()
  })
})

describe('clearWardrobe across restarts', () => {
  it('keeps the wardrobe empty when the app starts again', async () => {
    const { createContainer } = await import('../../server/container')
    const options = {
      databasePath: join(dir, 'dardar.db'),
      imagesDir: join(dir, 'images'),
      seed: { items: seedItems, styleMatches: seedStyleMatches },
      runner: async () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
      envApiKey: () => null,
      defaultAdvisor: 'offline' as const,
    }
    const first = await createContainer(options)
    expect(await first.items.list()).toHaveLength(seedItems.length)
    await first.clearWardrobe()
    first.close()
    const second = await createContainer(options)
    expect(await second.items.list()).toEqual([])
    second.close()
  })
})
