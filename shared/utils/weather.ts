import type { Season } from '../models/item'
import type { DayWeather, Place, WeatherCondition } from '../models/weather'

export type WeatherFeel = 'cold' | 'cool' | 'mild' | 'warm' | 'hot'

/** "London, United Kingdom" */
export function placeLabel(place: Pick<Place, 'name' | 'country'>): string {
  return place.country ? `${place.name}, ${place.country}` : place.name
}

/** How the day feels, from the feels-like high (what you dress for when you leave the house). */
export function feelOf(weather: DayWeather): WeatherFeel {
  const t = weather.feelsLikeMax
  if (t <= 8) return 'cold'
  if (t <= 15) return 'cool'
  if (t <= 21) return 'mild'
  if (t <= 27) return 'warm'
  return 'hot'
}

const WET: readonly WeatherCondition[] = ['drizzle', 'rain', 'snow', 'storm']

export function isWet(weather: DayWeather): boolean {
  return WET.includes(weather.condition) || weather.precipitationChance >= 50
}

const FEEL_SEASONS: Record<WeatherFeel, Season[]> = {
  cold: ['winter'],
  cool: ['autumn', 'spring'],
  mild: ['spring', 'autumn'],
  warm: ['summer', 'spring'],
  hot: ['summer'],
}

/** The garment seasons that suit the day. */
export function seasonsForWeather(weather: DayWeather): Season[] {
  return [...FEEL_SEASONS[feelOf(weather)]]
}

const range = (min: number, max: number) => (Math.round(min) === Math.round(max) ? `${Math.round(max)}` : `${Math.round(min)}–${Math.round(max)}`)

/** "Light rain · 8–14°" */
export function weatherLine(weather: DayWeather): string {
  return `${weather.summary} · ${range(weather.tempMin, weather.tempMax)}°`
}

/** The forecast as the stylist reads it. */
export function weatherBrief(weather: DayWeather): string {
  return [
    weather.summary.toLowerCase(),
    `${range(weather.tempMin, weather.tempMax)} °C (feels like ${range(weather.feelsLikeMin, weather.feelsLikeMax)} °C)`,
    `${weather.precipitationChance}% chance of rain`,
    `wind up to ${Math.round(weather.windMax)} km/h`,
  ].join(', ')
}

const ICONS: Record<WeatherCondition, string> = {
  clear: 'lucide:sun',
  'partly-cloudy': 'lucide:cloud-sun',
  cloudy: 'lucide:cloud',
  fog: 'lucide:cloud-fog',
  drizzle: 'lucide:cloud-drizzle',
  rain: 'lucide:cloud-rain',
  snow: 'lucide:snowflake',
  storm: 'lucide:cloud-lightning',
}

export function weatherIcon(condition: WeatherCondition): string {
  return ICONS[condition]
}
