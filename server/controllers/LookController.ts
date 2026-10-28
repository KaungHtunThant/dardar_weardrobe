import { getQuery, getRouterParam, readBody, type H3Event } from 'h3'
import { z } from 'zod'
import type { StyleMatchService } from '../services/StyleMatchService'
import type { StylingService } from '../services/StylingService'
import type { TodayService } from '../services/TodayService'
import { parseOrThrow } from '../services/validation'

const FavouriteSchema = z.object({ isFavourite: z.boolean() })
const TodaySchema = z.object({ date: z.iso.date() })

export class LookController {
  constructor(
    private readonly looks: StyleMatchService,
    private readonly styling: StylingService,
    private readonly todayLooks: TodayService,
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

  /** Wrapped in an object so "no look yet" is a plain JSON null. */
  async today(event: H3Event) {
    const { date } = parseOrThrow(TodaySchema, getQuery(event))
    return { look: await this.todayLooks.today(date) }
  }
}
