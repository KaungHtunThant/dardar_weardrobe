import { z } from 'zod'

/** Where the user lives: the weather Dardar dresses them for comes from here. */
export const PlaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  /** State, province or county, when known. */
  region: z.string().trim().max(100).nullable().default(null),
  country: z.string().trim().max(100).nullable().default(null),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** IANA zone, e.g. "Europe/London". */
  timezone: z.string().trim().max(64).nullable().default(null),
})
export type Place = z.infer<typeof PlaceSchema>
export type PlaceInput = z.input<typeof PlaceSchema>

export const WEATHER_CONDITIONS = ['clear', 'partly-cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'storm'] as const
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number]

const celsius = z.number().min(-90).max(60)

/** One day's forecast for a place, in °C and km/h. */
export const DayWeatherSchema = z.object({
  date: z.iso.date(),
  /** The place it is for, as shown to the user ("London, United Kingdom"). */
  place: z.string().trim().min(1).max(200),
  condition: z.enum(WEATHER_CONDITIONS),
  /** e.g. "Light rain". */
  summary: z.string().trim().min(1).max(60),
  tempMin: celsius,
  tempMax: celsius,
  feelsLikeMin: celsius,
  feelsLikeMax: celsius,
  /** The highest chance of rain or snow during the day, 0–100. */
  precipitationChance: z.number().int().min(0).max(100),
  windMax: z.number().min(0).max(500),
})
export type DayWeather = z.infer<typeof DayWeatherSchema>
