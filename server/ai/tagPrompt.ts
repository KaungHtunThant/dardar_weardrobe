import { z } from 'zod'
import type { DetailsSuggestion } from '#shared/contracts/GarmentTagger'
import { CATEGORY_IDS, CategoryIdSchema } from '#shared/models/category'
import { OCCASIONS, OccasionSchema, SEASONS, SeasonSchema } from '#shared/models/item'

export const TAG_SYSTEM_PROMPT = `You catalogue garments for a personal wardrobe app. Look at the photo of a single garment (background removed) and describe it precisely and briefly.`

export const TAG_INSTRUCTIONS = `Suggest details for this garment:
- name: a short, specific product-style name (2–4 words, e.g. "Blush Silk Blouse").
- category: one of ${CATEGORY_IDS.join(', ')}.
- colors: 1–3 plain colour words, main colour first (e.g. "blush", "navy", "camel").
- seasons: which of ${SEASONS.join(', ')} it suits.
- occasions: which of ${OCCASIONS.join(', ')} it suits.`

/** Model output: enums keep it on our vocabulary. */
export const TagSchema = z.object({
  name: z.string(),
  category: z.enum(CATEGORY_IDS),
  colors: z.array(z.string()),
  seasons: z.array(z.enum(SEASONS)),
  occasions: z.array(z.enum(OCCASIONS)),
})
export type TagOutput = z.infer<typeof TagSchema>

/** Keeps only valid, tidy values; anything doubtful is simply left for the user to fill in. */
export function toDetailsSuggestion(raw: Partial<Record<keyof TagOutput, unknown>>): DetailsSuggestion {
  const out: DetailsSuggestion = {}
  if (typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim().slice(0, 80)
  const category = CategoryIdSchema.safeParse(raw.category)
  if (category.success) out.category = category.data
  if (Array.isArray(raw.colors)) {
    const colors = [...new Set(raw.colors.filter((c): c is string => typeof c === 'string').map((c) => c.trim().toLowerCase()).filter(Boolean))]
    if (colors.length) out.colors = colors.slice(0, 6)
  }
  const pick = <T>(list: unknown, schema: z.ZodType<T>) =>
    Array.isArray(list) ? [...new Set(list.flatMap((v) => (schema.safeParse(v).success ? [v as T] : [])))] : []
  const seasons = pick(raw.seasons, SeasonSchema)
  if (seasons.length) out.seasons = seasons
  const occasions = pick(raw.occasions, OccasionSchema)
  if (occasions.length) out.occasions = occasions
  return out
}
