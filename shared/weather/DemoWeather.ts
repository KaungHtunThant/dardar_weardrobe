import type { PlaceDirectory, PlaceLocator } from '../contracts/PlaceFinder'
import type { WeatherCallOptions, WeatherProvider } from '../contracts/WeatherProvider'
import { PlaceSchema, type DayWeather, type Place, type WeatherCondition } from '../models/weather'
import { localIsoDate } from '../utils/date'
import { placeLabel } from '../utils/weather'

/**
 * Offline stand-ins for the weather and city services: deterministic and network-free.
 * The prototype gateway, the e2e server and tests use them; the app uses Open-Meteo.
 */

export const DEMO_PLACES: readonly Place[] = [
  { name: 'Paris', region: 'Île-de-France', country: 'France', latitude: 48.8534, longitude: 2.3488, timezone: 'Europe/Paris' },
  { name: 'London', region: 'England', country: 'United Kingdom', latitude: 51.5085, longitude: -0.1257, timezone: 'Europe/London' },
  { name: 'Milan', region: 'Lombardy', country: 'Italy', latitude: 45.4643, longitude: 9.1895, timezone: 'Europe/Rome' },
  { name: 'Copenhagen', region: 'Capital Region', country: 'Denmark', latitude: 55.6759, longitude: 12.5655, timezone: 'Europe/Copenhagen' },
  { name: 'New York', region: 'New York', country: 'United States', latitude: 40.7143, longitude: -74.006, timezone: 'America/New_York' },
  { name: 'Los Angeles', region: 'California', country: 'United States', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles' },
  { name: 'Tokyo', region: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.6917, timezone: 'Asia/Tokyo' },
  { name: 'Seoul', region: 'Seoul', country: 'South Korea', latitude: 37.566, longitude: 126.9784, timezone: 'Asia/Seoul' },
  { name: 'Singapore', region: null, country: 'Singapore', latitude: 1.2897, longitude: 103.8501, timezone: 'Asia/Singapore' },
  { name: 'Bangkok', region: 'Bangkok', country: 'Thailand', latitude: 13.7539, longitude: 100.5014, timezone: 'Asia/Bangkok' },
  { name: 'Yangon', region: 'Yangon', country: 'Myanmar', latitude: 16.8053, longitude: 96.1561, timezone: 'Asia/Yangon' },
  { name: 'Ho Chi Minh City', region: 'Ho Chi Minh', country: 'Vietnam', latitude: 10.8231, longitude: 106.6297, timezone: 'Asia/Ho_Chi_Minh' },
  { name: 'Sydney', region: 'New South Wales', country: 'Australia', latitude: -33.8679, longitude: 151.2073, timezone: 'Australia/Sydney' },
]

/** Forecasts reach this many days ahead (as Open-Meteo's do). */
export const FORECAST_DAYS = 16

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
const one = (n: number) => Math.round(n * 10) / 10

const SKIES: [WeatherCondition, string][] = [
  ['clear', 'Clear sky'],
  ['partly-cloudy', 'Partly cloudy'],
  ['partly-cloudy', 'Partly cloudy'],
  ['cloudy', 'Overcast'],
  ['drizzle', 'Light drizzle'],
  ['rain', 'Light rain'],
]

export class DemoWeatherProvider implements WeatherProvider {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async forecast(place: Place, date: string, { signal }: WeatherCallOptions = {}): Promise<DayWeather | null> {
    signal?.throwIfAborted()
    const ahead = days(localIsoDate(this.now()), date)
    if (ahead < -1 || ahead >= FORECAST_DAYS) return null

    // Warmer near the equator; a seasonal swing that peaks in July up north and in January down south.
    const month = Number(date.slice(5, 7))
    const swing = Math.cos(((month - 7) / 12) * 2 * Math.PI) * Math.min(12, Math.abs(place.latitude) * 0.25) * Math.sign(place.latitude || 1)
    const h = hash(`${place.name}:${date}`)
    const tempMax = one(30 - Math.abs(place.latitude) * 0.3 + swing + ((h % 5) - 2))
    const tempMin = one(tempMax - 5 - (h % 4))
    let [condition, summary] = SKIES[h % SKIES.length]!
    if (condition === 'rain' && tempMax < 2) [condition, summary] = ['snow', 'Light snow']
    const wet = condition === 'drizzle' || condition === 'rain' || condition === 'snow'
    return {
      date,
      place: placeLabel(place),
      condition,
      summary,
      tempMin,
      tempMax,
      feelsLikeMin: one(tempMin - 2),
      feelsLikeMax: one(tempMax - 1),
      precipitationChance: wet ? 70 + (h % 25) : h % 30,
      windMax: 5 + (h % 25),
    }
  }
}

export class DemoPlaceDirectory implements PlaceDirectory {
  async search(query: string, { signal }: WeatherCallOptions = {}): Promise<Place[]> {
    signal?.throwIfAborted()
    const q = fold(query)
    if (!q) return []
    return DEMO_PLACES.filter((p) => fold(p.name).includes(q)).slice(0, 5).map((p) => ({ ...p }))
  }
}

export class DemoPlaceLocator implements PlaceLocator {
  constructor(private readonly here: Place | null = DEMO_PLACES[0]!) {}

  async locate({ signal }: WeatherCallOptions = {}): Promise<Place | null> {
    signal?.throwIfAborted()
    return this.here ? PlaceSchema.parse(this.here) : null
  }
}
