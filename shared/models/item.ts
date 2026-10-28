import { z } from 'zod'
import { CategoryIdSchema } from './category'
import { optionalText } from './text'

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const
export const OCCASIONS = ['casual', 'work', 'evening', 'party', 'formal', 'sport', 'lounge'] as const

export const SeasonSchema = z.enum(SEASONS)
export const OccasionSchema = z.enum(OCCASIONS)
export type Season = z.infer<typeof SeasonSchema>
export type Occasion = z.infer<typeof OccasionSchema>

/** What the user fills in on the add-item form. */
export const ItemDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Give this piece a name').max(80),
  category: CategoryIdSchema,
  colors: z.array(z.string().trim().min(1)).max(6).default([]),
  brand: optionalText(60),
  size: optionalText(20),
  seasons: z.array(SeasonSchema).default([]),
  occasions: z.array(OccasionSchema).default([]),
  notes: optionalText(500),
})
export type ItemDetails = z.infer<typeof ItemDetailsSchema>
export type ItemDetailsInput = z.input<typeof ItemDetailsSchema>

export const ItemSchema = ItemDetailsSchema.extend({
  id: z.string().min(1),
  /** The photo as uploaded. */
  originalImage: z.string().min(1),
  /** Garment only, background removed. This is what the UI shows. */
  cleanImage: z.string().min(1),
  isFavourite: z.boolean().default(false),
  createdAt: z.iso.datetime(),
})
export type Item = z.infer<typeof ItemSchema>
