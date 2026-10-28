import type { Item } from '../models/item'
import type { StyleMatch } from '../models/styleMatch'
import { sortNewestFirst } from './wardrobe'

export function recentLooks(looks: readonly StyleMatch[], limit: number): StyleMatch[] {
  return sortNewestFirst(looks).slice(0, limit)
}

export function favouriteLooks(looks: readonly StyleMatch[]): StyleMatch[] {
  return sortNewestFirst(looks.filter((l) => l.isFavourite))
}

/**
 * The look recommended for `date` (YYYY-MM-DD): an explicit daily pick if one exists,
 * otherwise a stable choice derived from the date so it doesn't change during the day.
 */
export function todaysPick(looks: readonly StyleMatch[], date: string): StyleMatch | null {
  if (looks.length === 0) return null
  const explicit = looks.find((l) => l.dailyPickDate === date)
  if (explicit) return explicit
  const ordered = [...looks].sort((a, b) => a.id.localeCompare(b.id))
  let hash = 0
  for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return ordered[hash % ordered.length]!
}

export function resolveLookItems(look: StyleMatch, items: readonly Item[]): Item[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  return look.itemIds.flatMap((id) => byId.get(id) ?? [])
}
