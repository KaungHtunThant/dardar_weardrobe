import { describe, expect, it, vi } from 'vitest'
import type { GapAdvisor } from '#shared/contracts/GapAdvisor'
import { RuleBasedGapAdvisor } from '#shared/advisors/RuleBasedGapAdvisor'
import { seedItems } from '#shared/fixtures/seed'
import type { DayWeather } from '#shared/models/weather'
import { openDatabase } from '../../server/database/connection'
import { SqliteGapReportRepository } from '../../server/repositories/SqliteGapReportRepository'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { GapService } from '../../server/services/GapService'
import type { DailyWeather } from '../../server/services/WeatherService'

const clock = { now: () => new Date('2026-10-30T08:00:00.000Z'), newId: () => 'x' }

const osloPlace = { name: 'Oslo', region: null, country: 'Norway', latitude: 59.91, longitude: 10.75, timezone: 'Europe/Oslo' }
const oslo: DayWeather = {
  date: '2026-10-30',
  place: 'Oslo, Norway',
  condition: 'snow',
  summary: 'Light snow',
  tempMin: -6,
  tempMax: -1,
  feelsLikeMin: -10,
  feelsLikeMax: -4,
  precipitationChance: 80,
  windMax: 20,
}

async function setup(opts: { advisor?: GapAdvisor; withItems?: boolean; weather?: DailyWeather } = {}) {
  const { db } = openDatabase(':memory:')
  const items = new SqliteItemRepository(db)
  const reports = new SqliteGapReportRepository(db)
  if (opts.withItems !== false) for (const i of seedItems) await items.insert(i)
  const advisor = opts.advisor ?? new RuleBasedGapAdvisor()
  const spy = vi.spyOn(advisor, 'suggestGaps')
  const service = new GapService({ items, reports, advisor: async () => advisor, fallback: new RuleBasedGapAdvisor(), weather: opts.weather, clock })
  return { items, reports, spy, service }
}

describe('GapService', () => {
  it('writes the report once and keeps it while the wardrobe stays the same', async () => {
    const { service, spy, reports } = await setup()
    const report = await service.current()
    expect(report).toMatchObject({ by: 'claude', createdAt: '2026-10-30T08:00:00.000Z' })
    expect(report!.gaps.length).toBeGreaterThan(0)
    expect(await reports.current()).toEqual(report)
    expect(await service.current()).toEqual(report)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not ask twice when asked twice at once', async () => {
    const { service, spy } = await setup()
    await Promise.all([service.current(), service.current()])
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('asks again once pieces are added or removed', async () => {
    const { service, spy, items } = await setup()
    await service.current()
    await items.delete(seedItems[0]!.id)
    await service.current()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('asks again on request', async () => {
    const { service, spy } = await setup()
    await service.current()
    await service.refresh()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('falls back to the offline rules when the chosen stylist fails, and says so', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { service } = await setup({ advisor: { suggestGaps: async () => Promise.reject(new Error('CLI missing')) } })
    const report = await service.current()
    expect(report?.by).toBe('offline')
    expect(report!.gaps.length).toBeGreaterThan(0)
  })

  it('marks a report written by the offline rules (the user chose Offline) as offline', async () => {
    const { db } = openDatabase(':memory:')
    const items = new SqliteItemRepository(db)
    for (const i of seedItems) await items.insert(i)
    const offline = new RuleBasedGapAdvisor()
    const service = new GapService({ items, reports: new SqliteGapReportRepository(db), advisor: async () => offline, fallback: offline, clock })
    expect((await service.current())?.by).toBe('offline')
  })

  it('has nothing to say about an empty wardrobe', async () => {
    const { service, spy } = await setup({ withItems: false })
    expect(await service.current()).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it("tells the stylist about the climate where the user lives, and keeps the city on the report", async () => {
    const weather: DailyWeather = { forDay: async () => oslo, today: async () => oslo, place: async () => osloPlace }
    const { service, spy } = await setup({ weather })
    const report = await service.current()
    expect(spy.mock.calls[0]![0].weather?.place).toBe('Oslo, Norway')
    expect(report?.place).toBe('Oslo, Norway')
  })

  it('asks again once the user has moved to another city', async () => {
    let today: DayWeather | null = null
    const weather: DailyWeather = { forDay: async () => today, today: async () => today, place: async () => (today ? osloPlace : null) }
    const { service, spy } = await setup({ weather })
    expect((await service.current())?.place).toBeNull()
    await service.current()
    expect(spy).toHaveBeenCalledTimes(1)
    today = oslo
    expect((await service.current())?.place).toBe('Oslo, Norway')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
