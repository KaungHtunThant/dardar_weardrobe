import { createEventStream, getQuery, getRouterParam, readBody, type H3Event } from 'h3'
import { z } from 'zod'
import type { StyleMatchService } from '../services/StyleMatchService'
import type { StylingService } from '../services/StylingService'
import type { TodayService } from '../services/TodayService'
import { parseOrThrow } from '../services/validation'
import { toHttpError } from '../http/errors'

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

  async delete(event: H3Event) {
    await this.looks.delete(getRouterParam(event, 'id') ?? '')
    return { deleted: true }
  }

  async setFavourite(event: H3Event) {
    const { isFavourite } = parseOrThrow(FavouriteSchema, await readBody(event))
    return this.looks.setFavourite(getRouterParam(event, 'id') ?? '', isFavourite)
  }

  async generate(event: H3Event) {
    return this.styling.generate(await readBody(event))
  }

  /**
   * Same as generate, as server-sent events: `progress` while the stylist works, then `done` with the
   * saved look or `error` ({ statusCode, message }). Closing the connection cancels the stylist.
   */
  async generateStream(event: H3Event) {
    const body = await readBody(event)
    const stream = createEventStream(event)
    const controller = new AbortController()
    event.node.res.once('close', () => controller.abort())
    const send = (name: string, data: unknown) => stream.push({ event: name, data: JSON.stringify(data) })

    void (async () => {
      try {
        const look = await this.styling.generate(body, { signal: controller.signal, onProgress: (p) => void send('progress', p) })
        await send('done', look)
      } catch (e) {
        if (!controller.signal.aborted) {
          const error = toHttpError(e)
          await send('error', { statusCode: error.statusCode, message: error.message })
        }
      } finally {
        await stream.close()
      }
    })()
    return stream.send()
  }

  /** Wrapped in an object so "no look yet" is a plain JSON null. */
  async today(event: H3Event) {
    const { date } = parseOrThrow(TodaySchema, getQuery(event))
    return { look: await this.todayLooks.today(date) }
  }
}
