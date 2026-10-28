import { computed } from 'vue'
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'

const HERO_ORDER: CategoryId[] = ['dresses', 'tops', 'outerwear', 'bottoms', 'shoes', 'bags', 'accessories']
const MAX_TILES = 5

export function orderForCollage(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => HERO_ORDER.indexOf(a.category) - HERO_ORDER.indexOf(b.category))
}

/** Flat-lay grid: with 4+ pieces the hero garment takes a tall left column. */
export function collageLayout(count: number): { grid: string; tiles: string[] } {
  const n = Math.min(count, MAX_TILES)
  if (n <= 3) {
    const cols = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][n]!
    return { grid: `${cols} grid-rows-1`, tiles: Array.from({ length: n }, () => '') }
  }
  const tiles = ['row-span-2', ...Array.from({ length: n - 1 }, () => '')]
  // Four pieces leave one cell spare: let the last one span both right columns.
  if (n === 4) tiles[3] = 'col-span-2'
  // The hero column is wider so the main garment reads first.
  return { grid: 'grid-cols-[1.5fr_1fr_1fr] grid-rows-2', tiles }
}

export function useLookCollage(props: { items: readonly Item[] }) {
  const ordered = computed(() => orderForCollage(props.items).slice(0, MAX_TILES))
  const layout = computed(() => collageLayout(props.items.length))
  return { ordered, layout }
}
