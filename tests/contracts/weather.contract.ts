import { describe, expect, it } from 'vitest'
import type { PlaceDirectory, PlaceLocator } from '#shared/contracts/PlaceFinder'
import type { WeatherProvider } from '#shared/contracts/WeatherProvider'
import { DayWeatherSchema, PlaceSchema, type Place } from '#shared/models/weather'

/** "Today" for every implementation under test; each is built with a clock or fake service pinned to it. */
export const CONTRACT_TODAY = '2026-10-30'

const london: Place = { name: 'London', region: 'England', country: 'United Kingdom', latitude: 51.5085, longitude: -0.1257, timezone: 'Europe/London' }

const aborted = () => {
  const c = new AbortController()
  c.abort()
  return c.signal
}

/** Behaviour every WeatherProvider shares (Liskov). */
export function weatherProviderContract(name: string, make: () => WeatherProvider) {
  describe(`WeatherProvider contract: ${name}`, () => {
    it("forecasts today's weather for a place, labelled with that place", async () => {
      const weather = await make().forecast(london, CONTRACT_TODAY)
      expect(weather).not.toBeNull()
      expect(() => DayWeatherSchema.parse(weather)).not.toThrow()
      expect(weather!.date).toBe(CONTRACT_TODAY)
      expect(weather!.place).toBe('London, United Kingdom')
      expect(weather!.tempMin).toBeLessThanOrEqual(weather!.tempMax)
      expect(weather!.feelsLikeMin).toBeLessThanOrEqual(weather!.feelsLikeMax)
    })

    it('has nothing for a day far beyond the forecast', async () => {
      expect(await make().forecast(london, '2099-01-01')).toBeNull()
    })

    it('stops when cancelled', async () => {
      await expect(make().forecast(london, CONTRACT_TODAY, { signal: aborted() })).rejects.toMatchObject({ name: 'AbortError' })
    })
  })
}

/** Behaviour every PlaceDirectory shares. */
export function placeDirectoryContract(name: string, make: () => PlaceDirectory) {
  describe(`PlaceDirectory contract: ${name}`, () => {
    it('finds a city by name, with coordinates', async () => {
      const places = await make().search('London')
      expect(places.length).toBeGreaterThan(0)
      for (const p of places) expect(() => PlaceSchema.parse(p)).not.toThrow()
      expect(places[0]).toMatchObject({ name: 'London', country: 'United Kingdom' })
    })

    it('finds nothing for a blank or unknown name', async () => {
      expect(await make().search('   ')).toEqual([])
      expect(await make().search('zzqxw')).toEqual([])
    })

    it('stops when cancelled', async () => {
      await expect(make().search('London', { signal: aborted() })).rejects.toMatchObject({ name: 'AbortError' })
    })
  })
}

/** Behaviour every PlaceLocator shares. */
export function placeLocatorContract(name: string, make: () => PlaceLocator) {
  describe(`PlaceLocator contract: ${name}`, () => {
    it('guesses a valid place', async () => {
      const place = await make().locate()
      expect(place).not.toBeNull()
      expect(() => PlaceSchema.parse(place)).not.toThrow()
    })

    it('stops when cancelled', async () => {
      await expect(make().locate({ signal: aborted() })).rejects.toMatchObject({ name: 'AbortError' })
    })
  })
}
