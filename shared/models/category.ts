import { z } from 'zod'

export const CATEGORY_IDS = [
  'tops',
  'bottoms',
  'dresses',
  'outerwear',
  'shoes',
  'bags',
  'accessories',
] as const

export const CategoryIdSchema = z.enum(CATEGORY_IDS)
export type CategoryId = z.infer<typeof CategoryIdSchema>

export interface Category {
  id: CategoryId
  label: string
  /** Iconify name (lucide set). */
  icon: string
  order: number
}

export const CATEGORIES: readonly Category[] = [
  { id: 'tops', label: 'Tops', icon: 'lucide:shirt', order: 1 },
  { id: 'bottoms', label: 'Bottoms', icon: 'lucide:scissors', order: 2 },
  { id: 'dresses', label: 'Dresses', icon: 'lucide:sparkles', order: 3 },
  { id: 'outerwear', label: 'Outerwear', icon: 'lucide:cloud-sun', order: 4 },
  { id: 'shoes', label: 'Shoes', icon: 'lucide:footprints', order: 5 },
  { id: 'bags', label: 'Bags', icon: 'lucide:shopping-bag', order: 6 },
  { id: 'accessories', label: 'Accessories', icon: 'lucide:gem', order: 7 },
]

export function getCategory(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id)!
}
