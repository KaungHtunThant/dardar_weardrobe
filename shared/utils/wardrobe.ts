import { CATEGORY_IDS, type CategoryId } from '../models/category'
import type { Item } from '../models/item'

export type CategoryFilter = CategoryId | 'all'

export function filterByCategory(items: readonly Item[], category: CategoryFilter): Item[] {
  return category === 'all' ? [...items] : items.filter((i) => i.category === category)
}

export function countByCategory(items: readonly Item[]): Record<CategoryId, number> {
  const counts = Object.fromEntries(CATEGORY_IDS.map((id) => [id, 0])) as Record<CategoryId, number>
  for (const item of items) counts[item.category]++
  return counts
}

export function sortNewestFirst<T extends { createdAt: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
