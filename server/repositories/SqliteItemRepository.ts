import { eq } from 'drizzle-orm'
import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { Item } from '#shared/models/item'
import type { Db } from '../database/connection'
import { items } from '../database/schema'

type Row = typeof items.$inferSelect

/** Optional columns come back as null; the domain model leaves them out instead. */
function toItem({ brand, size, notes, ...rest }: Row): Item {
  return {
    ...rest,
    ...(brand != null ? { brand } : {}),
    ...(size != null ? { size } : {}),
    ...(notes != null ? { notes } : {}),
  }
}

export class SqliteItemRepository implements ItemRepository {
  constructor(private readonly db: Db) {}

  async findAll() {
    return (await this.db.select().from(items)).map(toItem)
  }

  async findById(id: string) {
    const row = await this.db.select().from(items).where(eq(items.id, id)).get()
    return row ? toItem(row) : null
  }

  async insert(item: Item) {
    await this.db.insert(items).values({ brand: null, size: null, notes: null, ...item })
    return item
  }

  async update(item: Item) {
    const { id, ...rest } = item
    await this.db.update(items).set({ brand: null, size: null, notes: null, ...rest }).where(eq(items.id, id))
    return item
  }

  async delete(id: string) {
    const existed = (await this.findById(id)) !== null
    if (existed) await this.db.delete(items).where(eq(items.id, id))
    return existed
  }
}
