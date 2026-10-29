import type { Place } from '../models/weather'
import type { WeatherCallOptions } from './WeatherProvider'

/** Finds cities by name, for the user to pick where they live. */
export interface PlaceDirectory {
  /** The best matches, most likely first; empty for a blank or unknown name. */
  search(query: string, options?: WeatherCallOptions): Promise<Place[]>
}

/** Guesses where this computer is (roughly: the city), for the first-launch suggestion. */
export interface PlaceLocator {
  /** Null when it can't tell. */
  locate(options?: WeatherCallOptions): Promise<Place | null>
}
