import type { PlaceLocator } from '#shared/contracts/PlaceFinder'
import type { WeatherCallOptions } from '#shared/contracts/WeatherProvider'
import { PlaceSchema, type Place } from '#shared/models/weather'
import { getJson, type WebServiceOptions } from './http'

const GEO_URL = 'https://get.geojs.io/v1/ip/geo.json'

interface Answer {
  city?: string
  region?: string
  country?: string
  latitude?: string | number
  longitude?: string | number
  timezone?: string
}

/**
 * Guesses the city from this computer's public IP address with GeoJS (free, no key).
 * Only asked when the user sets the app up or taps "Use my location"; the answer is a suggestion.
 */
export class GeoJsPlaceLocator implements PlaceLocator {
  constructor(private readonly options: WebServiceOptions = {}) {}

  async locate(call: WeatherCallOptions = {}): Promise<Place | null> {
    const { body } = await getJson(new URL(GEO_URL), this.options, call)
    const a = body as Answer
    const place = PlaceSchema.safeParse({
      name: a.city,
      region: a.region || null,
      country: a.country || null,
      latitude: Number(a.latitude),
      longitude: Number(a.longitude),
      timezone: a.timezone || null,
    })
    return place.success ? place.data : null
  }
}
