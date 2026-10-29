import type { PlaceDirectory, PlaceLocator } from '#shared/contracts/PlaceFinder'
import type { WeatherCallOptions, WeatherProvider } from '#shared/contracts/WeatherProvider'
import { UnavailableError } from '#shared/errors'
import type { DayWeather, Place } from '#shared/models/weather'
import { localIsoDate } from '#shared/utils/date'
import type { Clock } from './clock'

/** The weather where the user lives, as the styling services need it. */
export interface DailyWeather {
  /** Null without a city, or when the forecast can't be had; only cancelling throws. */
  forDay(date: string, options?: WeatherCallOptions): Promise<DayWeather | null>
  today(options?: WeatherCallOptions): Promise<DayWeather | null>
  /** The user's city (null until they say). */
  place(): Promise<Place | null>
}

export interface WeatherServiceOptions {
  /** The city saved in the settings. */
  location: () => Promise<Place | null>
  provider: WeatherProvider
  places: PlaceDirectory
  locator: PlaceLocator
  clock: Clock
}

const isAbort = (e: unknown) => (e as Error)?.name === 'AbortError'

/** Forecasts for the user's city, city search, and a first guess at where the user is. */
export class WeatherService implements DailyWeather {
  constructor(private readonly o: WeatherServiceOptions) {}

  place() {
    return this.o.location()
  }

  async forDay(date: string, options: WeatherCallOptions = {}): Promise<DayWeather | null> {
    const place = await this.o.location()
    if (!place) return null
    try {
      return await this.o.provider.forecast(place, date, options)
    } catch (e) {
      if (isAbort(e) && options.signal?.aborted) throw e
      // The weather makes looks better; it must never stop them.
      console.warn('[dardar] no forecast, styling without the weather:', e instanceof Error ? e.message : e)
      return null
    }
  }

  today(options: WeatherCallOptions = {}) {
    return this.forDay(localIsoDate(this.o.clock.now()), options)
  }

  async searchPlaces(query: string): Promise<Place[]> {
    try {
      return await this.o.places.search(query)
    } catch {
      throw new UnavailableError("Couldn't reach the city search. Check your internet connection and try again.")
    }
  }

  /** A suggestion only: null when the guess fails (offline, unknown address). */
  async locate(): Promise<Place | null> {
    try {
      return await this.o.locator.locate()
    } catch (e) {
      console.warn('[dardar] could not guess the location:', e instanceof Error ? e.message : e)
      return null
    }
  }
}
