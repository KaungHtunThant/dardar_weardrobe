import type { ImageStore } from '#shared/contracts/ImageStore'
import type { UploadRepository } from '#shared/contracts/UploadRepository'
import { NotFoundError, ValidationError } from '#shared/errors'
import { CategoryIdSchema } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { Upload } from '#shared/models/upload'
import type { Clock } from './clock'
import type { GarmentPipeline } from './GarmentPipeline'
import type { ItemService } from './ItemService'
import { validatePhoto } from './PhotoService'

export interface UploadServiceOptions {
  uploads: UploadRepository
  images: ImageStore
  pipeline: GarmentPipeline
  items: ItemService
  clock: Clock
  log?: (message: string, error?: unknown) => void
}

export interface NewPhoto {
  bytes: Uint8Array
  mimeType: string
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * The upload queue: photos are saved straight away and prepared in the background, one at a time
 * (the local models are CPU-heavy), so the user can carry on. The queue lives in the database, so
 * photos still waiting when the app closes are prepared on the next start.
 */
export class UploadService {
  private running: Promise<void> | null = null
  private current: { id: string; controller: AbortController } | null = null
  private halted = false

  constructor(private readonly o: UploadServiceOptions) {}

  private log(text: string, error?: unknown) {
    ;(this.o.log ?? ((m, e) => console.warn(`[dardar] ${m}`, e ?? '')))(text, error)
  }

  list() {
    return this.o.uploads.findAll()
  }

  /** Saves the photos and queues them; returns at once. */
  async enqueue(photos: readonly NewPhoto[], { categoryHint }: { categoryHint?: unknown } = {}): Promise<Upload[]> {
    if (!photos.length) throw new ValidationError('Please choose a photo to upload.')
    for (const p of photos) validatePhoto(p.bytes, p.mimeType)
    const hint = CategoryIdSchema.safeParse(categoryHint)
    const queued: Upload[] = []
    for (const p of photos) {
      const upload: Upload = {
        id: `upload-${this.o.clock.newId()}`,
        originalImage: await this.o.images.save(p.bytes, p.mimeType),
        cleanImage: null,
        state: 'queued',
        stage: null,
        categoryHint: hint.success ? hint.data : null,
        suggestion: null,
        backgroundRemoved: false,
        error: null,
        createdAt: this.o.clock.now().toISOString(),
      }
      queued.push(await this.o.uploads.insert(upload))
    }
    this.kick()
    return queued
  }

  private async existing(id: string) {
    const upload = await this.o.uploads.findById(id)
    if (!upload) throw new NotFoundError(`Photo not found: ${id}`)
    return upload
  }

  /** Queues a photo that couldn't be prepared again. */
  async retry(id: string): Promise<Upload> {
    const upload = await this.existing(id)
    if (upload.state !== 'failed') throw new ValidationError("Only a photo that couldn't be prepared can be tried again.")
    const queued = await this.o.uploads.update({ ...upload, state: 'queued', stage: null, error: null })
    this.kick()
    return queued
  }

  /** Forgets a photo and its images; stops it if it is being prepared right now. */
  async discard(id: string): Promise<void> {
    const upload = await this.existing(id)
    if (this.current?.id === id) this.current.controller.abort()
    await this.o.uploads.delete(id)
    await this.o.images.delete(upload.originalImage)
    if (upload.cleanImage && upload.cleanImage !== upload.originalImage) await this.o.images.delete(upload.cleanImage)
  }

  /** Turns a ready photo into a piece with the user's details; its images now belong to the piece. */
  async save(id: string, details: unknown): Promise<Item> {
    const upload = await this.existing(id)
    if (upload.state !== 'ready' || !upload.cleanImage) throw new ValidationError('This photo is still being prepared.')
    const item = await this.o.items.create({ ...(details as object), originalImage: upload.originalImage, cleanImage: upload.cleanImage })
    await this.o.uploads.delete(id)
    return item
  }

  /** On start: photos interrupted mid-way go back in the queue, and the queue runs. */
  async resume(): Promise<void> {
    for (const u of await this.o.uploads.findAll()) if (u.state === 'processing') await this.o.uploads.update({ ...u, state: 'queued', stage: null })
    this.kick()
  }

  /** Stops the photo being prepared and the queue (before everything is deleted). */
  async stopAll(): Promise<void> {
    this.halted = true
    this.current?.controller.abort()
    await this.idle()
    this.halted = false
  }

  /** Resolves once nothing is being prepared. */
  async idle(): Promise<void> {
    while (this.running) await this.running
  }

  private kick() {
    if (this.running || this.halted) return
    this.running = this.work()
      .catch((e) => this.log('the upload queue stopped:', e))
      .finally(() => {
        this.running = null
      })
  }

  private async work() {
    while (!this.halted) {
      const next = (await this.o.uploads.findAll()).find((u) => u.state === 'queued')
      if (!next) return
      await this.process(next)
    }
  }

  private async process(upload: Upload) {
    const controller = new AbortController()
    this.current = { id: upload.id, controller }
    let row: Upload = { ...upload, state: 'processing', stage: null, error: null }
    // Progress writes go one after another, so a late stage update never overwrites the result.
    let writes: Promise<unknown> = this.o.uploads.update(row)
    const write = (next: Upload) => (writes = writes.then(() => this.o.uploads.update((row = next))))
    try {
      const out = await this.o.pipeline.prepare(upload.originalImage, {
        signal: controller.signal,
        categoryHint: upload.categoryHint ?? undefined,
        onStage: (stage) => void write({ ...row, stage }),
      })
      await writes
      if (!(await this.o.uploads.findById(upload.id))) {
        // Discarded at the last moment: don't leave its cut-out behind.
        if (out.cleanImage !== upload.originalImage) await this.o.images.delete(out.cleanImage)
        return
      }
      await write({ ...row, state: 'ready', stage: null, cleanImage: out.cleanImage, backgroundRemoved: out.backgroundRemoved, suggestion: out.suggestion })
    } catch (e) {
      await writes.catch(() => {})
      if (isAbort(e)) return
      this.log(`preparing ${upload.id} failed:`, e)
      if (await this.o.uploads.findById(upload.id)) await write({ ...row, state: 'failed', stage: null, error: message(e) })
    } finally {
      this.current = null
    }
  }
}
