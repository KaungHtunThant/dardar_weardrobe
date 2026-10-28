import { z } from 'zod'

const line = z.string().trim().min(1).max(300)

/** A concrete improvement using the user's own wardrobe. */
export const StyleFixSchema = z.object({
  /** Piece to take out of the look, if any. */
  removeItemId: z.string().min(1).optional(),
  /** Piece from the wardrobe to bring in, if any. */
  addItemId: z.string().min(1).optional(),
  note: line,
})
export type StyleFix = z.infer<typeof StyleFixSchema>

/** The advisor's brutally honest verdict on a look. */
export const StyleRatingSchema = z.object({
  score: z.number().int().min(1).max(10),
  verdict: z.string().trim().min(1).max(200),
  works: z.array(line).max(6),
  fails: z.array(line).max(6),
  fixes: z.array(StyleFixSchema).max(4),
})
export type StyleRating = z.infer<typeof StyleRatingSchema>

/** A look: existing wardrobe items combined into a style, by the user and/or the AI. */
export const StyleMatchSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  itemIds: z.array(z.string().min(1)).min(1),
  /** The pieces the AI chose (the rest were picked by the user). */
  aiItemIds: z.array(z.string().min(1)).optional(),
  /** The user's custom prompt, if they gave one. */
  prompt: z.string().trim().max(500).optional(),
  explanation: z.string().trim().max(1000),
  rating: StyleRatingSchema.optional(),
  isFavourite: z.boolean().default(false),
  /** Set when this look was chosen as the recommendation for that day. */
  dailyPickDate: z.iso.date().optional(),
  createdAt: z.iso.datetime(),
})
export type StyleMatch = z.infer<typeof StyleMatchSchema>
