import { readBody, type H3Event } from 'h3'
import type { ItemService } from '../services/ItemService'

export class ItemController {
  constructor(private readonly items: ItemService) {}

  list() {
    return this.items.list()
  }

  async create(event: H3Event) {
    return this.items.create(await readBody(event))
  }
}
