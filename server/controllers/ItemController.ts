import { readBody, type H3Event } from 'h3'
import type { ItemService } from '../services/ItemService'
import type { TaggingService } from '../services/TaggingService'

export class ItemController {
  constructor(
    private readonly items: ItemService,
    private readonly tagging: TaggingService,
  ) {}

  list() {
    return this.items.list()
  }

  async create(event: H3Event) {
    return this.items.create(await readBody(event))
  }

  async suggest(event: H3Event) {
    return this.tagging.suggest(await readBody(event))
  }
}
