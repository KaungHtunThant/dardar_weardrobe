import { describe, expect, it, vi } from 'vitest'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { seedItems } from '#shared/fixtures/seed'
import { openDatabase } from '../../server/database/connection'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { TodayService, seasonOf } from '../../server/services/TodayService'

const clock = { now: () => new Date('2026-10-28T08:00:00.000Z'), newId: () => `n${Math.random().toString(36).slice(2, 8)}` }

async function setup(advisor: StyleAdvisor = new RuleBasedStyleAdvisor(), withItems = true) {
  const { db } = openDatabase(':memory:')
  const items = new SqliteItemRepository(db)
  const looks = new SqliteStyleMatchRepository(db)
  if (withItems) for (const i of seedItems) await items.insert(i)
  return { looks, service: new TodayService(items, looks, async () => advisor, new RuleBasedStyleAdvisor(), clock) }
}

describe('seasonOf', () => {
  it('maps a date to its (northern) season', () => {
    expect(seasonOf('2026-10-28')).toBe('autumn')
    expect(seasonOf('2026-01-10')).toBe('winter')
    expect(seasonOf('2026-07-01')).toBe('summer')
  })
})

describe('TodayService', () => {
  it("styles today's look once and returns the same one afterwards", async () => {
    const { service, looks } = await setup()
    const first = await service.today('2026-10-28')
    expect(first?.dailyPickDate).toBe('2026-10-28')
    expect(first?.prompt).toBeUndefined()
    expect((await service.today('2026-10-28'))!.id).toBe(first!.id)
    expect((await looks.findAll()).filter((l) => l.dailyPickDate === '2026-10-28')).toHaveLength(1)
  })

  it('does not style twice when asked twice at once', async () => {
    const advisor = new RuleBasedStyleAdvisor()
    const spy = vi.spyOn(advisor, 'suggestLook')
    const { service } = await setup(advisor)
    const [a, b] = await Promise.all([service.today('2026-10-28'), service.today('2026-10-28')])
    expect(a!.id).toBe(b!.id)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('layers outerwear in autumn and winter', async () => {
    const advisor = new RuleBasedStyleAdvisor()
    const spy = vi.spyOn(advisor, 'suggestLook')
    const { service } = await setup(advisor)
    await service.today('2026-10-28')
    expect(spy.mock.calls[0]![0].fillCategories).toContain('outerwear')
  })

  it('falls back to the offline stylist when the chosen one fails', async () => {
    const broken: StyleAdvisor = { suggestLook: async () => Promise.reject(new Error('CLI missing')) }
    const { service } = await setup(broken)
    expect(await service.today('2026-10-28')).not.toBeNull()
  })

  it('returns null for an empty wardrobe', async () => {
    const { service } = await setup(undefined, false)
    expect(await service.today('2026-10-28')).toBeNull()
  })
})
