import { describe, expect, it } from 'vitest'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { countByCategory, filterByCategory, sortNewestFirst } from '#shared/utils/wardrobe'
import { favouriteLooks, recentLooks, resolveLookItems, todaysPick } from '#shared/utils/looks'

const item = (id: string, category: Item['category'], createdAt: string): Item => ({
  id,
  name: id,
  category,
  originalImage: `/${id}.svg`,
  cleanImage: `/${id}.svg`,
  colors: [],
  seasons: [],
  occasions: [],
  isFavourite: false,
  createdAt,
})

const look = (id: string, createdAt: string, extra: Partial<StyleMatch> = {}): StyleMatch => ({
  id,
  title: id,
  itemIds: ['a'],
  explanation: '',
  isFavourite: false,
  createdAt,
  ...extra,
})

const items = [
  item('a', 'tops', '2026-10-01T00:00:00.000Z'),
  item('b', 'shoes', '2026-10-03T00:00:00.000Z'),
  item('c', 'tops', '2026-10-02T00:00:00.000Z'),
]

describe('wardrobe utils', () => {
  it('filters by category, "all" keeps everything', () => {
    expect(filterByCategory(items, 'tops').map((i) => i.id)).toEqual(['a', 'c'])
    expect(filterByCategory(items, 'all')).toHaveLength(3)
  })

  it('counts items per category including empty closets', () => {
    const counts = countByCategory(items)
    expect(counts.tops).toBe(2)
    expect(counts.shoes).toBe(1)
    expect(counts.dresses).toBe(0)
  })

  it('sorts newest first without mutating the input', () => {
    const copy = [...items]
    expect(sortNewestFirst(items).map((i) => i.id)).toEqual(['b', 'c', 'a'])
    expect(items).toEqual(copy)
  })
})

describe('look utils', () => {
  const looks = [
    look('old', '2026-10-01T00:00:00.000Z', { isFavourite: true }),
    look('mid', '2026-10-05T00:00:00.000Z'),
    look('new', '2026-10-09T00:00:00.000Z', { isFavourite: true }),
  ]

  it('returns recent looks newest first, limited', () => {
    expect(recentLooks(looks, 2).map((l) => l.id)).toEqual(['new', 'mid'])
  })

  it('returns favourite looks newest first', () => {
    expect(favouriteLooks(looks).map((l) => l.id)).toEqual(['new', 'old'])
  })

  it("prefers the look explicitly picked for today", () => {
    const picked = [...looks, look('picked', '2026-09-01T00:00:00.000Z', { dailyPickDate: '2026-10-28' })]
    expect(todaysPick(picked, '2026-10-28')?.id).toBe('picked')
  })

  it('falls back to a stable pick for the day', () => {
    const first = todaysPick(looks, '2026-10-28')
    expect(first).not.toBeNull()
    expect(todaysPick(looks, '2026-10-28')?.id).toBe(first?.id)
    const week = new Set(['22', '23', '24', '25', '26', '27', '28'].map((d) => todaysPick(looks, `2026-10-${d}`)?.id))
    expect(week.size).toBeGreaterThan(1)
  })

  it('returns null when there are no looks', () => {
    expect(todaysPick([], '2026-10-28')).toBeNull()
  })

  it('resolves look items in order and skips deleted ones', () => {
    const l = look('x', '2026-10-01T00:00:00.000Z', { itemIds: ['c', 'gone', 'a'] })
    expect(resolveLookItems(l, items).map((i) => i.id)).toEqual(['c', 'a'])
  })
})
