import type { StyleSuggestion } from '../contracts/StyleAdvisor'
import { ValidationError } from '../errors'
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

/**
 * A look after one of its pieces was deleted: the piece, its AI badge and any fix mentioning it go.
 * Returns null when nothing would be left, and the same object when the look didn't contain it.
 */
export function withoutItem(look: StyleMatch, itemId: string): StyleMatch | null {
  if (!look.itemIds.includes(itemId)) return look
  const itemIds = look.itemIds.filter((id) => id !== itemId)
  if (itemIds.length === 0) return null
  return {
    ...look,
    itemIds,
    ...(look.aiItemIds ? { aiItemIds: look.aiItemIds.filter((id) => id !== itemId) } : {}),
    ...(look.rating
      ? { rating: { ...look.rating, fixes: look.rating.fixes.filter((f) => f.addItemId !== itemId && f.removeItemId !== itemId) } }
      : {}),
  }
}

/** The saved look for an advisor's suggestion (used by every gateway/back end that generates looks). */
export function lookFromSuggestion(
  suggestion: StyleSuggestion,
  request: { prompt?: string },
  id: string,
  now: Date,
): StyleMatch {
  if (suggestion.itemIds.length === 0)
    throw new ValidationError('There is nothing to style yet. Add some pieces to your wardrobe first.')
  return {
    id,
    title: suggestion.title,
    itemIds: suggestion.itemIds,
    aiItemIds: suggestion.aiItemIds,
    ...(request.prompt ? { prompt: request.prompt } : {}),
    explanation: suggestion.explanation,
    rating: suggestion.rating,
    isFavourite: false,
    createdAt: now.toISOString(),
  }
}

export type LookFilter = 'all' | 'favourites' | 'rated' | 'daily'
export type LookSort = 'newest' | 'score-desc' | 'score-asc'

export function filterLooks(looks: readonly StyleMatch[], filter: LookFilter): StyleMatch[] {
  switch (filter) {
    case 'favourites':
      return looks.filter((l) => l.isFavourite)
    case 'rated':
      return looks.filter((l) => l.rating)
    case 'daily':
      return looks.filter((l) => l.dailyPickDate)
    default:
      return [...looks]
  }
}

/** Newest first, or by score (unrated looks always last, newest first among equals). */
export function sortLooks(looks: readonly StyleMatch[], sort: LookSort): StyleMatch[] {
  const newest = sortNewestFirst(looks)
  if (sort === 'newest') return newest
  const dir = sort === 'score-desc' ? -1 : 1
  return [...newest].sort((a, b) => {
    if (!a.rating || !b.rating) return Number(!a.rating) - Number(!b.rating)
    return dir * (a.rating.score - b.rating.score)
  })
}
