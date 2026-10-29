import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleAdvisor, StyleCallOptions } from '#shared/contracts/StyleAdvisor'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import { ValidationError } from '#shared/errors'
import type { StyleMatch } from '#shared/models/styleMatch'
import { StyleRequestSchema } from '#shared/models/styleRequest'
import { lookFromSuggestion } from '#shared/utils/looks'
import type { Clock } from './clock'
import { parseOrThrow } from './validation'
import type { DailyWeather } from './WeatherService'

/** Style Studio: completes the user's picks with the configured advisor, rates the look and saves it. */
export class StylingService {
  constructor(
    private readonly items: ItemRepository,
    private readonly looks: StyleMatchRepository,
    /** Resolved per request so a settings change takes effect immediately. */
    private readonly advisor: () => StyleAdvisor | Promise<StyleAdvisor>,
    private readonly clock: Clock,
    /** Today's forecast where the user lives. */
    private readonly weather?: DailyWeather,
  ) {}

  /** With `onProgress`, reports as the look takes shape; aborting `signal` stops the stylist and saves nothing. */
  async generate(input: unknown, { signal, onProgress }: StyleCallOptions = {}): Promise<StyleMatch> {
    const request = parseOrThrow(StyleRequestSchema, input)
    const wardrobe = await this.items.findAll()
    const known = new Set(wardrobe.map((i) => i.id))
    const unknown = request.pinnedItemIds.find((id) => !known.has(id))
    if (unknown) throw new ValidationError(`Unknown piece: ${unknown}`)

    onProgress?.({ stage: 'reading', aiItemIds: [] })
    const { dressForWeather, ...ask } = request
    const weather = dressForWeather ? await this.weather?.today({ signal }) : null
    const suggestion = await (await this.advisor()).suggestLook({ wardrobe, ...ask, ...(weather ? { weather } : {}) }, { signal, onProgress })
    signal?.throwIfAborted()
    const look = lookFromSuggestion(suggestion, { ...ask, weather }, `look-${this.clock.newId()}`, this.clock.now())
    return this.looks.insert(look)
  }
}
