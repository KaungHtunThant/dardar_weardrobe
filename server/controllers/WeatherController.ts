import { getQuery, type H3Event } from 'h3'
import { z } from 'zod'
import type { WeatherService } from '../services/WeatherService'
import { parseOrThrow } from '../services/validation'

const DaySchema = z.object({ date: z.iso.date() })
const SearchSchema = z.object({ q: z.string().max(100).default('') })

export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  /** The forecast for a day where the user lives; wrapped so "no weather" is a plain JSON null. */
  async day(event: H3Event) {
    const { date } = parseOrThrow(DaySchema, getQuery(event))
    return { weather: await this.weather.forDay(date) }
  }

  searchPlaces(event: H3Event) {
    const { q } = parseOrThrow(SearchSchema, getQuery(event))
    return this.weather.searchPlaces(q)
  }

  async here() {
    return { place: await this.weather.locate() }
  }
}
