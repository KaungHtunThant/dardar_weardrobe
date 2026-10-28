import type { ItemRepository } from '#shared/contracts/ItemRepository'
import type { StyleMatchRepository } from '#shared/contracts/StyleMatchRepository'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'

/** Fills an empty wardrobe with demo data. Returns whether it seeded. */
export async function seedIfEmpty(
  items: ItemRepository,
  looks: StyleMatchRepository,
  seed: { items: readonly Item[]; styleMatches: readonly StyleMatch[] },
) {
  if ((await items.findAll()).length > 0 || (await looks.findAll()).length > 0) return false
  for (const item of seed.items) await items.insert(item)
  for (const look of seed.styleMatches) await looks.insert(look)
  return true
}
