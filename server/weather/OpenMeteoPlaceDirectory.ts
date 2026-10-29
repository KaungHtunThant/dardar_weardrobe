import type { PlaceDirectory } from '#shared/contracts/PlaceFinder'
import type { WeatherCallOptions } from '#shared/contracts/WeatherProvider'
import { PlaceSchema, type Place } from '#shared/models/weather'
import { getJson, type WebServiceOptions } from './http'

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const RESULTS = 6

interface Result {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
  timezone?: string
}

/** City search with Open-Meteo's geocoding API (GeoNames data, biggest places first). */
export class OpenMeteoPlaceDirectory implements PlaceDirectory {
  constructor(private readonly options: WebServiceOptions = {}) {}

  async search(query: string, call: WeatherCallOptions = {}): Promise<Place[]> {
    call.signal?.throwIfAborted()
    const name = query.trim()
    if (name.length < 2) return []
    const url = new URL(SEARCH_URL)
    url.search = new URLSearchParams({ name, count: String(RESULTS), language: 'en', format: 'json' }).toString()
    const { body } = await getJson(url, this.options, call)
    const results = (body as { results?: Result[] }).results ?? []
    return results.flatMap((r) => {
      const place = PlaceSchema.safeParse({
        name: r.name,
        region: r.admin1 ?? null,
        country: r.country ?? null,
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone ?? null,
      })
      return place.success ? [place.data] : []
    })
  }
}
