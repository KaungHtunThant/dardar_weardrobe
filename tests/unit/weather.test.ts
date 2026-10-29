import { describe, expect, it } from 'vitest'
import { DayWeatherSchema, PlaceSchema, type DayWeather } from '#shared/models/weather'
import { SettingsSchema } from '#shared/models/settings'
import { StyleMatchSchema } from '#shared/models/styleMatch'
import { StyleRequestSchema } from '#shared/models/styleRequest'
import { feelOf, isWet, placeLabel, seasonsForWeather, weatherBrief, weatherIcon, weatherLine } from '#shared/utils/weather'

const london = { name: 'London', region: 'England', country: 'United Kingdom', latitude: 51.5, longitude: -0.12, timezone: 'Europe/London' }

const day = (over: Partial<DayWeather> = {}): DayWeather => ({
  date: '2026-10-30',
  place: 'London, United Kingdom',
  condition: 'rain',
  summary: 'Light rain',
  tempMin: 8,
  tempMax: 14,
  feelsLikeMin: 6,
  feelsLikeMax: 12,
  precipitationChance: 80,
  windMax: 25,
  ...over,
})

describe('Place', () => {
  it('accepts a place with coordinates and fills the optional parts', () => {
    expect(PlaceSchema.parse({ name: 'Paris', latitude: 48.85, longitude: 2.35 })).toEqual({
      name: 'Paris',
      region: null,
      country: null,
      latitude: 48.85,
      longitude: 2.35,
      timezone: null,
    })
  })

  it('rejects impossible coordinates and empty names', () => {
    expect(() => PlaceSchema.parse({ ...london, latitude: 91 })).toThrow()
    expect(() => PlaceSchema.parse({ ...london, longitude: -181 })).toThrow()
    expect(() => PlaceSchema.parse({ ...london, name: '  ' })).toThrow()
  })

  it('is part of the settings, unset by default', () => {
    expect(SettingsSchema.parse({ advisor: 'offline' }).location).toBeNull()
    expect(SettingsSchema.parse({ advisor: 'offline', location: london }).location).toEqual(london)
  })
})

describe('DayWeather', () => {
  it('validates a forecast', () => {
    expect(DayWeatherSchema.parse(day())).toEqual(day())
    expect(() => DayWeatherSchema.parse(day({ precipitationChance: 120 }))).toThrow()
    expect(() => DayWeatherSchema.parse(day({ condition: 'tornado' as never }))).toThrow()
  })

  it('can be kept on a look, which stays valid without it', () => {
    const look = { id: 'l', title: 'Rainy Day', itemIds: ['a'], explanation: '', createdAt: '2026-10-30T08:00:00.000Z' }
    expect(StyleMatchSchema.parse(look).weather).toBeUndefined()
    expect(StyleMatchSchema.parse({ ...look, weather: day() }).weather).toEqual(day())
  })

  it('is asked for by the studio unless the user turns it off', () => {
    expect(StyleRequestSchema.parse({ fillCategories: ['tops'] }).dressForWeather).toBe(true)
    expect(StyleRequestSchema.parse({ fillCategories: ['tops'], dressForWeather: false }).dressForWeather).toBe(false)
  })
})

describe('weather utils', () => {
  it('labels a place by city and country', () => {
    expect(placeLabel(london)).toBe('London, United Kingdom')
    expect(placeLabel({ ...london, country: null })).toBe('London')
  })

  it('reads how the day feels from the feels-like high', () => {
    expect(feelOf(day({ feelsLikeMax: 3 }))).toBe('cold')
    expect(feelOf(day({ feelsLikeMax: 12 }))).toBe('cool')
    expect(feelOf(day({ feelsLikeMax: 19 }))).toBe('mild')
    expect(feelOf(day({ feelsLikeMax: 25 }))).toBe('warm')
    expect(feelOf(day({ feelsLikeMax: 31 }))).toBe('hot')
  })

  it('knows a wet day by its sky or its chance of rain', () => {
    expect(isWet(day())).toBe(true)
    expect(isWet(day({ condition: 'cloudy', precipitationChance: 60 }))).toBe(true)
    expect(isWet(day({ condition: 'clear', precipitationChance: 10 }))).toBe(false)
  })

  it('maps the feel of the day to the seasons that suit it', () => {
    expect(seasonsForWeather(day({ feelsLikeMax: 2 }))).toEqual(['winter'])
    expect(seasonsForWeather(day({ feelsLikeMax: 30 }))).toEqual(['summer'])
    expect(seasonsForWeather(day({ feelsLikeMax: 12 }))).toEqual(['autumn', 'spring'])
  })

  it('writes a short line for the UI and a full brief for the stylist', () => {
    expect(weatherLine(day())).toBe('Light rain · 8–14°')
    expect(weatherBrief(day())).toBe('light rain, 8–14 °C (feels like 6–12 °C), 80% chance of rain, wind up to 25 km/h')
  })

  it('has an icon for every sky', () => {
    expect(weatherIcon('clear')).toBe('lucide:sun')
    expect(weatherIcon('rain')).toBe('lucide:cloud-rain')
    expect(weatherIcon('snow')).toBe('lucide:snowflake')
  })
})
