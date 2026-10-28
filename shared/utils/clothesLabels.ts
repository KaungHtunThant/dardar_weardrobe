import type { CategoryId } from '../models/category'

/** The clothes-segmentation model's classes (SegFormer B2 "clothes", ATR labels), in output order. */
export const CLOTHES_LABELS = [
  'Background',
  'Hat',
  'Hair',
  'Sunglasses',
  'Upper-clothes',
  'Skirt',
  'Pants',
  'Dress',
  'Belt',
  'Left-shoe',
  'Right-shoe',
  'Face',
  'Left-leg',
  'Right-leg',
  'Left-arm',
  'Right-arm',
  'Bag',
  'Scarf',
] as const
export type ClothesLabel = (typeof CLOTHES_LABELS)[number]

const ANY_CLOTHES: ClothesLabel[] = ['Hat', 'Sunglasses', 'Upper-clothes', 'Skirt', 'Pants', 'Dress', 'Belt', 'Left-shoe', 'Right-shoe', 'Bag', 'Scarf']

/**
 * Which labels count as "the garment" for a category. Neighbours the model confuses are kept
 * together (a long tee often reads as a dress); the stylist's crop keeps other garments out.
 */
const BY_CATEGORY: Record<CategoryId, ClothesLabel[]> = {
  tops: ['Upper-clothes', 'Dress'],
  outerwear: ['Upper-clothes', 'Dress'],
  dresses: ['Dress', 'Upper-clothes', 'Skirt'],
  bottoms: ['Pants', 'Skirt', 'Dress'],
  shoes: ['Left-shoe', 'Right-shoe'],
  bags: ['Bag'],
  accessories: ['Hat', 'Sunglasses', 'Belt', 'Bag', 'Scarf'],
}

export function clothesLabelsFor(category?: CategoryId): ClothesLabel[] {
  return category ? BY_CATEGORY[category] : ANY_CLOTHES
}
