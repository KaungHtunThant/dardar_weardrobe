import { z } from 'zod'

/** A look: existing wardrobe items the AI combined into a style. */
export const StyleMatchSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  itemIds: z.array(z.string().min(1)).min(1),
  /** The user's custom prompt, if they gave one. */
  prompt: z.string().trim().max(500).optional(),
  explanation: z.string().trim().max(1000),
  isFavourite: z.boolean().default(false),
  /** Set when this look was chosen as the recommendation for that day. */
  dailyPickDate: z.iso.date().optional(),
  createdAt: z.iso.datetime(),
})
export type StyleMatch = z.infer<typeof StyleMatchSchema>
