import type { Item } from '../models/item'

export interface ItemRepository {
  findAll(): Promise<Item[]>
  findById(id: string): Promise<Item | null>
  insert(item: Item): Promise<Item>
  update(item: Item): Promise<Item>
  /** Returns whether something was deleted. */
  delete(id: string): Promise<boolean>
}
