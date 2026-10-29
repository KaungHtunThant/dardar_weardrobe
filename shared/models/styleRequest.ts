import { z } from 'zod'
import { CategoryIdSchema } from './category'
import { optionalText } from './text'

/**
 * What the user asks the Style Studio for: pieces they picked themselves,
 * the categories the AI may fill in, and an optional vibe prompt.
 */
export const StyleRequestSchema = z
  .object({
    pinnedItemIds: z
      .array(z.string().min(1))
      .max(12)
      .refine((ids) => new Set(ids).size === ids.length, 'Each piece can only be picked once')
      .default([]),
    fillCategories: z.array(CategoryIdSchema).default([]),
    prompt: optionalText(500),
    /** Dress for today's weather where the user lives (when a city is set and a forecast is available). */
    dressForWeather: z.boolean().default(true),
  })
  .refine((r) => r.pinnedItemIds.length > 0 || r.fillCategories.length > 0, {
    message: 'Pick a piece or let the AI fill at least one category',
  })
export type StyleRequest = z.infer<typeof StyleRequestSchema>
export type StyleRequestInput = z.input<typeof StyleRequestSchema>
