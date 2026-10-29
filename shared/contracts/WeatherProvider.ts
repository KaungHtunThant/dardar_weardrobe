import type { DayWeather, Place } from '../models/weather'

export interface WeatherCallOptions {
  /** Aborting cancels the request and rejects with an AbortError. */
  signal?: AbortSignal
}

/** A source of daily forecasts (Open-Meteo, the offline demo, …). */
export interface WeatherProvider {
  /** The forecast for a YYYY-MM-DD date at the place; null when the date is outside what it can forecast. */
  forecast(place: Place, date: string, options?: WeatherCallOptions): Promise<DayWeather | null>
}
