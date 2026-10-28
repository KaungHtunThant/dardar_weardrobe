import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from '#shared/errors'
import type { Upload } from '#shared/models/upload'
import { openDatabase } from '../../server/database/connection'
import { FsImageStore } from '../../server/infrastructure/FsImageStore'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { SqliteUploadRepository } from '../../server/repositories/SqliteUploadRepository'
import type { GarmentPipeline, PipelineStage, PreparedGarment } from '../../server/services/GarmentPipeline'
import { ItemService } from '../../server/services/ItemService'
import { UploadService } from '../../server/services/UploadService'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const photo = { bytes: PNG, mimeType: 'image/png' }

let dir: string
let n = 0
const clock = { now: () => new Date(Date.UTC(2026, 9, 29, 10, 0, n)), newId: () => `id${++n}` }

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-uploads-'))
  n = 0
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** A pipeline the test drives by hand: each call waits until the test finishes or fails it. */
function manualPipeline(images: FsImageStore) {
  const calls: { ref: string; stage: (s: PipelineStage) => void; signal?: AbortSignal; finish: (p?: Partial<PreparedGarment>) => Promise<void>; fail: (e: Error) => void }[] = []
  const waiters: (() => void)[] = []
  const pipeline = {
    prepare(ref: string, { signal, onStage }: { signal?: AbortSignal; onStage?: (s: PipelineStage) => void; categoryHint?: unknown } = {}) {
      return new Promise<PreparedGarment>((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason))
        calls.push({
          ref,
          signal,
          stage: (s) => onStage?.(s),
          finish: async (p = {}) => resolve({ cleanImage: await images.save(PNG, 'image/png'), backgroundRemoved: true, suggestion: { name: 'Red Tee', category: 'tops' }, ...p }),
          fail: reject,
        })
        waiters.splice(0).forEach((w) => w())
      })
    },
  } as unknown as GarmentPipeline
  /** Resolves when the n-th call (1-based) has started. */
  const started = (count: number) => new Promise<void>((resolve) => {
    const check = () => (calls.length >= count ? resolve() : waiters.push(check))
    check()
  })
  return { pipeline, calls, started }
}

function setup(db = openDatabase(':memory:').db) {
  const images = new FsImageStore(join(dir, 'images'))
  const repo = new SqliteUploadRepository(db)
  const items = new ItemService(new SqliteItemRepository(db), new SqliteStyleMatchRepository(db), images, clock)
  const manual = manualPipeline(images)
  const service = new UploadService({ uploads: repo, images, pipeline: manual.pipeline, items, clock, log: () => {} })
  return { db, images, repo, items, service, ...manual }
}

const states = async (s: UploadService) => (await s.list()).map((u) => u.state)

describe('UploadService', () => {
  it('saves the photos and returns at once, then prepares them one at a time', async () => {
    const { service, calls, started } = setup()
    const queued = await service.enqueue([photo, photo])
    expect(queued.map((u) => u.state)).toEqual(['queued', 'queued'])
    expect(queued[0]!.originalImage).toMatch(/^\/api\/images\/.+\.png$/)

    await started(1)
    expect(await states(service)).toEqual(['processing', 'queued'])
    calls[0]!.stage('isolating')
    await new Promise((r) => setTimeout(r, 5))
    expect((await service.list())[0]!.stage).toBe('isolating')

    await calls[0]!.finish()
    await started(2)
    expect(await states(service)).toEqual(['ready', 'processing'])
    expect((await service.list())[0]).toMatchObject({ stage: null, backgroundRemoved: true, suggestion: { name: 'Red Tee', category: 'tops' } })
    await calls[1]!.finish()
    await service.idle()
    expect(await states(service)).toEqual(['ready', 'ready'])
  })

  it('remembers the closet the photos were added from', async () => {
    const { service } = setup()
    const [u] = await service.enqueue([photo], { categoryHint: 'shoes' })
    expect(u!.categoryHint).toBe('shoes')
  })

  it('refuses anything that is not a photo, before saving any of the batch', async () => {
    const { service } = setup()
    await expect(service.enqueue([photo, { bytes: PNG, mimeType: 'text/plain' }])).rejects.toBeInstanceOf(ValidationError)
    await expect(service.enqueue([])).rejects.toBeInstanceOf(ValidationError)
    expect(await service.list()).toEqual([])
  })

  it('marks a photo that could not be prepared as failed, and can try again', async () => {
    const { service, calls, started } = setup()
    const [u] = await service.enqueue([photo])
    await started(1)
    calls[0]!.fail(new Error('Upload a photo first.'))
    await service.idle()
    expect((await service.list())[0]).toMatchObject({ state: 'failed', error: 'Upload a photo first.' })

    expect((await service.retry(u!.id)).state).toBe('queued')
    await started(2)
    await calls[1]!.finish()
    await service.idle()
    expect(await states(service)).toEqual(['ready'])
    await expect(service.retry(u!.id)).rejects.toBeInstanceOf(ValidationError)
  })

  it('discards a waiting photo with its image', async () => {
    const { service, started, images } = setup()
    const [, second] = await service.enqueue([photo, photo])
    await started(1)
    await service.discard(second!.id)
    expect((await service.list()).map((u) => u.id)).not.toContain(second!.id)
    expect(await images.read(second!.originalImage)).toBeNull()
  })

  it('stops a photo that is being prepared when it is discarded, and moves on', async () => {
    const { service, calls, started } = setup()
    const [first] = await service.enqueue([photo, photo])
    await started(1)
    await service.discard(first!.id)
    expect(calls[0]!.signal!.aborted).toBe(true)
    await started(2)
    expect(await states(service)).toEqual(['processing'])
  })

  it('picks up where it left off after a restart', async () => {
    const first = setup()
    await first.service.enqueue([photo, photo])
    await first.started(1)
    // The app quits mid-way: a fresh service on the same database resumes both.
    const second = setup(first.db)
    await second.service.resume()
    await second.started(1)
    await second.calls[0]!.finish()
    await second.started(2)
    await second.calls[1]!.finish()
    await second.service.idle()
    expect(await states(second.service)).toEqual(['ready', 'ready'])
  })

  it('saves a ready photo as a piece, keeping its images', async () => {
    const { service, calls, started, items, images } = setup()
    const [u] = await service.enqueue([photo])
    await started(1)
    await calls[0]!.finish()
    await service.idle()
    const ready = (await service.list())[0] as Upload

    const item = await service.save(u!.id, { name: 'Red Tee', category: 'tops', colors: ['red'] })
    expect(item).toMatchObject({ name: 'Red Tee', originalImage: ready.originalImage, cleanImage: ready.cleanImage })
    expect(await items.list()).toHaveLength(1)
    expect(await service.list()).toEqual([])
    expect(await images.read(ready.cleanImage!)).not.toBeNull()
  })

  it('only saves photos that are ready, with valid details', async () => {
    const { service, calls, started } = setup()
    const [u] = await service.enqueue([photo])
    await started(1)
    await expect(service.save(u!.id, { name: 'X', category: 'tops' })).rejects.toBeInstanceOf(ValidationError)
    await calls[0]!.finish()
    await service.idle()
    await expect(service.save(u!.id, { name: '', category: 'tops' })).rejects.toBeInstanceOf(ValidationError)
    await expect(service.save('nope', { name: 'X', category: 'tops' })).rejects.toThrow(/not found/i)
  })

  it('stops everything and forgets the queue when the wardrobe is cleared', async () => {
    const { service, calls, started } = setup()
    await service.enqueue([photo, photo])
    await started(1)
    await service.stopAll()
    expect(calls[0]!.signal!.aborted).toBe(true)
    expect(readdirSync(join(dir, 'images')).length).toBeGreaterThan(0) // images are cleared by the caller
  })
})
