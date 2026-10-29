import { z } from 'zod'
import { CategoryIdSchema } from './category'

/** A piece the wardrobe is missing: what to look for, why, and what the user already owns that it goes with. */
export const GapSuggestionSchema = z.object({
  category: CategoryIdSchema,
  /** A short, shoppable name, e.g. "Black Tailored Blazer". */
  name: z.string().trim().min(1).max(80),
  /** Why the wardrobe needs it, in one or two sentences. */
  reason: z.string().trim().min(1).max(300),
  colors: z.array(z.string().trim().min(1).max(30)).max(3),
  /** Pieces already in the wardrobe it would be worn with. */
  pairsWithItemIds: z.array(z.string().min(1)).max(4),
})
export type GapSuggestion = z.infer<typeof GapSuggestionSchema>

export const MAX_GAPS = 6

/** The stylist's list of missing pieces for one state of the wardrobe. */
export const GapReportSchema = z.object({
  gaps: z.array(GapSuggestionSchema).max(MAX_GAPS),
  /** The wardrobe it was written for (see wardrobeKey): once pieces are added or removed it is out of date. */
  wardrobeKey: z.string(),
  /** The city it was written for ("Oslo, Norway"): a move to another climate makes it out of date too. */
  place: z.string().nullable().default(null),
  /** Claude, or the offline rules (chosen, or when Claude failed). */
  by: z.enum(['claude', 'offline']),
  createdAt: z.iso.datetime(),
})
export type GapReport = z.infer<typeof GapReportSchema>
