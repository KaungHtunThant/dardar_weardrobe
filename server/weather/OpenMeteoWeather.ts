import type { WeatherCallOptions, WeatherProvider } from '#shared/contracts/WeatherProvider'
import { DayWeatherSchema, type DayWeather, type Place, type WeatherCondition } from '#shared/models/weather'
import { placeLabel } from '#shared/utils/weather'
import { getJson, type WebServiceOptions } from './http'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_probability_max',
  'wind_speed_10m_max',
]

/** WMO weather interpretation codes, as Open-Meteo documents them. */
const WMO: Record<number, [WeatherCondition, string]> = {
  0: ['clear', 'Clear sky'],
  1: ['partly-cloudy', 'Mainly clear'],
  2: ['partly-cloudy', 'Partly cloudy'],
  3: ['cloudy', 'Overcast'],
  45: ['fog', 'Fog'],
  48: ['fog', 'Freezing fog'],
  51: ['drizzle', 'Light drizzle'],
  53: ['drizzle', 'Drizzle'],
  55: ['drizzle', 'Heavy drizzle'],
  56: ['drizzle', 'Freezing drizzle'],
  57: ['drizzle', 'Freezing drizzle'],
  61: ['rain', 'Light rain'],
  63: ['rain', 'Rain'],
  65: ['rain', 'Heavy rain'],
  66: ['rain', 'Freezing rain'],
  67: ['rain', 'Freezing rain'],
  71: ['snow', 'Light snow'],
  73: ['snow', 'Snow'],
  75: ['snow', 'Heavy snow'],
  77: ['snow', 'Snow grains'],
  80: ['rain', 'Light showers'],
  81: ['rain', 'Showers'],
  82: ['rain', 'Heavy showers'],
  85: ['snow', 'Snow showers'],
  86: ['snow', 'Heavy snow showers'],
  95: ['storm', 'Thunderstorm'],
  96: ['storm', 'Thunderstorm with hail'],
  99: ['storm', 'Thunderstorm with hail'],
}

interface Answer {
  reason?: string
  daily?: Record<string, (number | string | null)[]>
}

/** Daily forecasts from Open-Meteo (free, no key; non-commercial use). */
export class OpenMeteoWeather implements WeatherProvider {
  constructor(private readonly options: WebServiceOptions = {}) {}

  async forecast(place: Place, date: string, call: WeatherCallOptions = {}): Promise<DayWeather | null> {
    const url = new URL(FORECAST_URL)
    url.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      daily: DAILY.join(','),
      timezone: place.timezone ?? 'auto',
      start_date: date,
      end_date: date,
    }).toString()
    const { status, body } = await getJson(url, this.options, call, (s) => s === 400)
    const answer = body as Answer
    // The API refuses days outside its window (about three months back to two weeks ahead).
    if (status === 400) {
      if (/out of allowed range/i.test(answer.reason ?? '')) return null
      throw new Error(`Open-Meteo refused the request: ${answer.reason ?? 'unknown reason'}`)
    }
    const d = answer.daily
    const at = (key: string) => d?.[key]?.[0]
    if (!d || at('time') !== date) return null
    const num = (key: string) => {
      const v = at(key)
      if (typeof v !== 'number') throw new Error(`Open-Meteo sent no ${key}`)
      return v
    }
    const [condition, summary] = WMO[num('weather_code')] ?? ['cloudy', 'Cloudy']
    const rain = at('precipitation_probability_max')
    return DayWeatherSchema.parse({
      date,
      place: placeLabel(place),
      condition,
      summary,
      tempMin: num('temperature_2m_min'),
      tempMax: num('temperature_2m_max'),
      feelsLikeMin: num('apparent_temperature_min'),
      feelsLikeMax: num('apparent_temperature_max'),
      precipitationChance: typeof rain === 'number' ? Math.round(rain) : 0,
      windMax: num('wind_speed_10m_max'),
    })
  }
}
