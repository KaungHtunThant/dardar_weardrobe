import { z } from 'zod'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import { ItemDetailsSchema, type Item } from '#shared/models/item'
import type { Clock } from './clock'
import { parseOrThrow } from './validation'

const CreateItemSchema = ItemDetailsSchema.extend({
  originalImage: z.string().min(1),
  cleanImage: z.string().min(1),
})

export class ItemService {
  constructor(
    private readonly items: ItemRepository,
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
}
