import { z } from 'zod'
import type { ImageStore } from '#shared/contracts/ImageStore'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import { NotFoundError } from '#shared/errors'
import { ItemDetailsSchema, type Item } from '#shared/models/item'
import { withoutItem } from '#shared/utils/looks'
import type { Clock } from './clock'
import { parseOrThrow } from './validation'

const PhotoSchema = z.object({ originalImage: z.string().min(1), cleanImage: z.string().min(1) })
const CreateItemSchema = ItemDetailsSchema.extend(PhotoSchema.shape)

export class ItemService {
  constructor(
    private readonly items: ItemRepository,
    private readonly looks: StyleMatchRepository,
    private readonly images: ImageStore,
    private readonly clock: Clock,
  ) {}

  list() {
    return this.items.findAll()
  }

  async create(input: unknown): Promise<Item> {
    const data = parseOrThrow(CreateItemSchema, input)
    return this.items.insert({
      ...data,
      id: `item-${this.clock.newId()}`,
      isFavourite: false,
      createdAt: this.clock.now().toISOString(),
    })
  }

  private async existing(id: string) {
    const item = await this.items.findById(id)
    if (!item) throw new NotFoundError(`Piece not found: ${id}`)
    return item
  }

  /** Replaces the details; photos, id, favourite and creation date stay. */
  async update(id: string, input: unknown): Promise<Item> {
    const item = await this.existing(id)
    const details = parseOrThrow(ItemDetailsSchema, input)
    const { originalImage, cleanImage, isFavourite, createdAt } = item
    return this.items.update({ ...details, id, originalImage, cleanImage, isFavourite, createdAt })
  }

  /** Swaps in a newly processed photo and deletes the old stored files. */
  async replacePhoto(id: string, input: unknown): Promise<Item> {
    const item = await this.existing(id)
    const photo = parseOrThrow(PhotoSchema, input)
    const updated = await this.items.update({ ...item, ...photo })
    await this.forgetImages(item, [photo.originalImage, photo.cleanImage])
    return updated
  }

  /** Deletes the piece, removes it from every look (deleting looks left empty) and deletes its photos. */
  async delete(id: string) {
    const item = await this.existing(id)
    for (const look of await this.looks.findAll()) {
      const next = withoutItem(look, id)
      if (next === null) await this.looks.delete(look.id)
      else if (next !== look) await this.looks.update(next)
    }
    await this.items.delete(id)
    await this.forgetImages(item)
  }

  private async forgetImages(item: Item, keep: string[] = []) {
    for (const ref of new Set([item.originalImage, item.cleanImage]))
      if (!keep.includes(ref)) await this.images.delete(ref)
  }
}
