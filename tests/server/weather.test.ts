import { describe, expect, it, vi } from 'vitest'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import type { WeatherProvider } from '#shared/contracts/WeatherProvider'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { UnavailableError } from '#shared/errors'
import { seedItems } from '#shared/fixtures/seed'
import type { DayWeather, Place } from '#shared/models/weather'
import { DemoPlaceDirectory, DemoPlaceLocator } from '#shared/weather/DemoWeather'
import { openDatabase } from '../../server/database/connection'
import { buildStyleMessage, readStylePayload } from '../../server/ai/stylePrompt'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { StylingService } from '../../server/services/StylingService'
import { TodayService, seasonOf } from '../../server/services/TodayService'
import { WeatherService } from '../../server/services/WeatherService'

const clock = { now: () => new Date('2026-10-30T08:00:00'), newId: () => `n${Math.random().toString(36).slice(2, 8)}` }
const london: Place = { name: 'London', region: 'England', country: 'United Kingdom', latitude: 51.5, longitude: -0.12, timezone: 'Europe/London' }
const sydney: Place = { name: 'Sydney', region: null, country: 'Australia', latitude: -33.87, longitude: 151.21, timezone: 'Australia/Sydney' }

const forecast = (over: Partial<DayWeather> = {}): DayWeather => ({
  date: '2026-10-30',
  place: 'London, United Kingdom',
  condition: 'rain',
  summary: 'Light rain',
  tempMin: 4,
  tempMax: 9,
  feelsLikeMin: 1,
  feelsLikeMax: 6,
  precipitationChance: 85,
  windMax: 30,
  ...over,
})

function weatherService(opts: { place?: Place | null; provider?: WeatherProvider } = {}) {
  let place = opts.place === undefined ? london : opts.place
  const provider = opts.provider ?? { forecast: vi.fn(async (p: Place, date: string) => forecast({ date, place: `${p.name}, ${p.country}` })) }
  const service = new WeatherService({
    location: async () => place,
    provider,
    places: new DemoPlaceDirectory(),
    locator: new DemoPlaceLocator(),
    clock,
  })
  return { service, provider, move: (to: Place | null) => (place = to) }
}

async function repos() {
  const { db } = openDatabase(':memory:')
  const items = new SqliteItemRepository(db)
  const looks = new SqliteStyleMatchRepository(db)
  for (const i of seedItems) await items.insert(i)
  return { items, looks }
}

describe('WeatherService', () => {
  it("gives the forecast where the user lives, for today or another day", async () => {
    const { service } = weatherService()
    expect(await service.today()).toMatchObject({ date: '2026-10-30', place: 'London, United Kingdom' })
    expect((await service.forDay('2026-10-31'))?.date).toBe('2026-10-31')
  })

  it('has no weather until the user says where they live', async () => {
    const { service, provider } = weatherService({ place: null })
    expect(await service.today()).toBeNull()
    expect(provider.forecast).not.toHaveBeenCalled()
  })

  it('never lets a weather outage stop styling', async () => {
    const { service } = weatherService({ provider: { forecast: async () => Promise.reject(new Error('offline')) } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await service.today()).toBeNull()
  })

  it('still stops when the caller cancels', async () => {
    const { service } = weatherService({ provider: { forecast: async (_p, _d, o) => (o?.signal?.throwIfAborted(), forecast()) } })
    const c = new AbortController()
    c.abort()
    await expect(service.today({ signal: c.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('searches cities, and says so when the search is unreachable', async () => {
    const { service } = weatherService()
    expect((await service.searchPlaces('lond'))[0]?.name).toBe('London')
    const down = new WeatherService({
      location: async () => null,
      provider: { forecast: async () => null },
      places: { search: async () => Promise.reject(new Error('ENOTFOUND')) },
      locator: new DemoPlaceLocator(),
      clock,
    })
    await expect(down.searchPlaces('London')).rejects.toBeInstanceOf(UnavailableError)
  })

  it('guesses where the computer is, or says it cannot', async () => {
    expect((await weatherService().service.locate())?.name).toBe('Paris')
    const lost = new WeatherService({
      location: async () => null,
      provider: { forecast: async () => null },
      places: new DemoPlaceDirectory(),
      locator: { locate: async () => Promise.reject(new Error('offline')) },
      clock,
    })
    expect(await lost.locate()).toBeNull()
  })
})

describe('seasonOf', () => {
  it('turns the calendar around south of the equator', () => {
    expect(seasonOf('2026-10-30', sydney.latitude)).toBe('spring')
    expect(seasonOf('2026-01-10', sydney.latitude)).toBe('summer')
    expect(seasonOf('2026-10-30', london.latitude)).toBe('autumn')
  })
})

describe("TodayService with the weather", () => {
  async function setup(weather = weatherService(), advisor: StyleAdvisor = new RuleBasedStyleAdvisor()) {
    const r = await repos()
    const spy = vi.spyOn(advisor, 'suggestLook')
    const service = new TodayService(r.items, r.looks, async () => advisor, new RuleBasedStyleAdvisor(), clock, weather.service)
    return { ...r, ...weather, spy, today: service }
  }

  it("dresses for the day's forecast and keeps it on the look", async () => {
    const { today, spy } = await setup()
    const look = await today.today('2026-10-30')
    expect(spy.mock.calls[0]![0].weather).toMatchObject({ summary: 'Light rain', place: 'London, United Kingdom' })
    expect(look?.weather).toMatchObject({ date: '2026-10-30', summary: 'Light rain' })
  })

  it('layers outerwear on a cold or wet day, and leaves it off on a warm dry one', async () => {
    const cold = await setup()
    await cold.today.today('2026-10-30')
    expect(cold.spy.mock.calls[0]![0].fillCategories).toContain('outerwear')

    const warm = await setup(
      weatherService({ provider: { forecast: async (_p, date) => forecast({ date, condition: 'clear', summary: 'Clear sky', tempMax: 27, feelsLikeMax: 28, precipitationChance: 0 }) } }),
    )
    await warm.today.today('2026-10-30')
    expect(warm.spy.mock.calls[0]![0].fillCategories).not.toContain('outerwear')
  })

  it('styles today again when the user has moved to another city since', async () => {
    const weather = weatherService({ place: null })
    const { today, looks, spy } = await setup(weather)
    const before = await today.today('2026-10-30')
    expect(before?.weather).toBeUndefined()
    expect((await today.today('2026-10-30'))!.id).toBe(before!.id)

    weather.move(london)
    const after = await today.today('2026-10-30')
    expect(after!.id).not.toBe(before!.id)
    expect(after!.weather?.place).toBe('London, United Kingdom')
    expect(spy).toHaveBeenCalledTimes(2)
    // The old pick goes: there is one recommendation per day.
    expect((await looks.findAll()).filter((l) => l.dailyPickDate === '2026-10-30').map((l) => l.id)).toEqual([after!.id])
    expect((await today.today('2026-10-30'))!.id).toBe(after!.id)
  })

  it("keeps a pick the user loved, even after moving", async () => {
    const weather = weatherService({ place: null })
    const { today, looks } = await setup(weather)
    const loved = (await today.today('2026-10-30'))!
    await looks.update({ ...loved, isFavourite: true })
    weather.move(london)
    expect((await today.today('2026-10-30'))!.id).toBe(loved.id)
  })
})

describe('StylingService with the weather', () => {
  async function setup(weather = weatherService(), advisor: StyleAdvisor = new RuleBasedStyleAdvisor()) {
    const r = await repos()
    const spy = vi.spyOn(advisor, 'suggestLook')
    return { ...r, spy, service: new StylingService(r.items, r.looks, () => advisor, clock, weather.service) }
  }

  it("dresses for today's weather by default and keeps it on the look", async () => {
    const { service, spy } = await setup()
    const look = await service.generate({ fillCategories: ['tops', 'bottoms'] })
    expect(spy.mock.calls[0]![0].weather?.summary).toBe('Light rain')
    expect(look.weather).toMatchObject({ date: '2026-10-30', place: 'London, United Kingdom' })
  })

  it('ignores the weather when the user turns it off, or has no city', async () => {
    const off = await setup()
    const look = await off.service.generate({ fillCategories: ['tops'], dressForWeather: false })
    expect(off.spy.mock.calls[0]![0].weather).toBeUndefined()
    expect(look.weather).toBeUndefined()

    const nowhere = await setup(weatherService({ place: null }))
    expect((await nowhere.service.generate({ fillCategories: ['tops'] })).weather).toBeUndefined()
  })
})

describe('the stylist hears about the weather', () => {
  const request = { wardrobe: seedItems, pinnedItemIds: [], fillCategories: ['tops' as const] }

  it('as a sentence and in the payload', () => {
    const message = buildStyleMessage({ ...request, weather: forecast() })
    expect(message).toContain("Dress for today's weather in London, United Kingdom: light rain, 4–9 °C (feels like 1–6 °C), 85% chance of rain, wind up to 30 km/h.")
    expect(readStylePayload(message).weather).toEqual({ place: 'London, United Kingdom', forecast: 'light rain, 4–9 °C (feels like 1–6 °C), 85% chance of rain, wind up to 30 km/h' })
  })

  it('not at all when there is none', () => {
    const message = buildStyleMessage(request)
    expect(message).not.toContain("today's weather")
    expect(readStylePayload(message).weather).toBeNull()
  })
})

describe('the offline stylist and the weather', () => {
  const advisor = new RuleBasedStyleAdvisor()
  const byId = new Map(seedItems.map((i) => [i.id, i]))
  const coat = seedItems.find((i) => i.category === 'outerwear' && i.seasons.includes('winter'))!

  it('prefers pieces for the season the day feels like', async () => {
    const hot = forecast({ condition: 'clear', summary: 'Clear sky', tempMax: 32, feelsLikeMax: 33, precipitationChance: 0 })
    const look = await advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: [], fillCategories: ['tops', 'bottoms'], weather: hot })
    for (const id of look.aiItemIds) {
      const seasons = byId.get(id)!.seasons
      expect(seasons.length === 0 || seasons.includes('summer')).toBe(true)
    }
  })

  it('calls out a look with no outer layer on a cold, wet day, and suggests one', async () => {
    const top = seedItems.find((i) => i.category === 'tops')!
    const bottom = seedItems.find((i) => i.category === 'bottoms')!
    const look = await advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: [top.id, bottom.id], fillCategories: [], weather: forecast() })
    expect(look.rating.fails.join(' ')).toMatch(/no coat/i)
    expect(look.rating.fixes.some((f) => f.addItemId && byId.get(f.addItemId)!.category === 'outerwear')).toBe(true)
  })

  it('calls out a winter coat on a hot day', async () => {
    const hot = forecast({ condition: 'clear', summary: 'Clear sky', tempMax: 31, feelsLikeMax: 32, precipitationChance: 0 })
    const look = await advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: [coat.id], fillCategories: ['tops', 'bottoms', 'shoes'], weather: hot })
    expect(look.rating.fails.join(' ')).toContain(coat.name)
    expect(look.rating.fixes).toContainEqual(expect.objectContaining({ removeItemId: coat.id }))
  })

  it('says so when a look suits the weather', async () => {
    const look = await advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: [], fillCategories: ['tops', 'bottoms', 'outerwear', 'shoes'], weather: forecast() })
    expect(look.rating.works.join(' ')).toMatch(/light rain/i)
  })
})
