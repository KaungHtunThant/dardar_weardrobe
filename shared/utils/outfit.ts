import type { Item } from '../models/item'

/** Where a piece sits on the body; one piece per slot. */
export type BodySlot = 'head' | 'face' | 'neck' | 'outer' | 'torso' | 'dress' | 'legs' | 'feet' | 'hand' | 'wrist'

const ACCESSORY_SLOTS: [RegExp, BodySlot][] = [
  [/\b(hat|cap|beret|beanie|headband|hair)\b/i, 'head'],
  [/\b(sunglasses|glasses|shades)\b/i, 'face'],
  [/\b(necklace|pendant|choker|chain|scarf|collar)\b/i, 'neck'],
]

export function slotFor(item: Item): BodySlot {
  switch (item.category) {
    case 'tops':
      return 'torso'
    case 'outerwear':
      return 'outer'
    case 'dresses':
      return 'dress'
    case 'bottoms':
      return 'legs'
    case 'shoes':
      return 'feet'
    case 'bags':
      return 'hand'
    case 'accessories':
      return ACCESSORY_SLOTS.find(([re]) => re.test(item.name))?.[1] ?? 'wrist'
  }
}

/** A dress covers torso and legs, so it can't be worn with separates. */
const CONFLICTS: Partial<Record<BodySlot, BodySlot[]>> = {
  dress: ['torso', 'legs'],
  torso: ['dress'],
  legs: ['dress'],
}

/** Puts a piece on: anything in the same slot, or in a conflicting one, comes off. */
export function wear(outfit: readonly Item[], piece: Item): Item[] {
  const slot = slotFor(piece)
  const blocked = new Set([slot, ...(CONFLICTS[slot] ?? [])])
  return [...outfit.filter((i) => i.id !== piece.id && !blocked.has(slotFor(i))), piece]
}
