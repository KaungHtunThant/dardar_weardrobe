import { getRouterParam, readBody, type H3Event } from 'h3'
import { z } from 'zod'
import type { StyleMatchService } from '../services/StyleMatchService'
import type { StylingService } from '../services/StylingService'
import { parseOrThrow } from '../services/validation'

const FavouriteSchema = z.object({ isFavourite: z.boolean() })

export class LookController {
  constructor(
    private readonly looks: StyleMatchService,
    private readonly styling: StylingService,
  ) {}

  list() {
    return this.looks.list()
  }

  async setFavourite(event: H3Event) {
    const { isFavourite } = parseOrThrow(FavouriteSchema, await readBody(event))
    return this.looks.setFavourite(getRouterParam(event, 'id') ?? '', isFavourite)
  }

  async generate(event: H3Event) {
    return this.styling.generate(await readBody(event))
  }
}
