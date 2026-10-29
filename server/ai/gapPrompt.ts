import { z } from 'zod'
import type { GapAdvisorRequest } from '#shared/contracts/GapAdvisor'
import { CATEGORY_IDS, CategoryIdSchema } from '#shared/models/category'
import type { GapSuggestion } from '#shared/models/gap'
import { weatherBrief } from '#shared/utils/weather'
import { clean, modelWardrobe, type StylePayload } from './stylePrompt'

/** What the model returns (structured output). */
export const AiGapsSchema = z.object({
  gaps: z.array(
    z.object({
      category: z.enum(CATEGORY_IDS),
      name: z.string(),
      reason: z.string(),
      colors: z.array(z.string()),
      pairsWithItemIds: z.array(z.string()),
    }),
  ),
})
export type AiGaps = z.infer<typeof AiGapsSchema>

export interface GapPayload {
  wardrobe: StylePayload['wardrobe']
  /** Where the client lives, for the climate. */
  place: string | null
}

const OPEN = '<wardrobe_request>'
const CLOSE = '</wardrobe_request>'
const LIMIT = 5

/** The user turn: the task, the climate, and the wardrobe as JSON between tags. */
export function buildGapMessage(request: GapAdvisorRequest): string {
  const payload: GapPayload = { wardrobe: modelWardrobe(request.wardrobe), place: request.weather?.place ?? null }
  const climate = request.weather ? `\nThe client lives in ${request.weather.place}; today: ${weatherBrief(request.weather)}.` : ''
  const empty = request.wardrobe.length === 0 ? '\nThe wardrobe is empty: suggest the basics to start with.' : ''
  return `Task: find what the wardrobe is missing.\nSuggest at most ${LIMIT} pieces, most important first.${climate}${empty}\n\n${OPEN}\n${JSON.stringify(payload)}\n${CLOSE}`
}

export function readGapPayload(message: string): GapPayload {
  return JSON.parse(message.slice(message.indexOf(OPEN) + OPEN.length, message.indexOf(CLOSE))) as GapPayload
}

/** Whatever the model returned, as suggestions that obey the contract: real pieces only, no repeats, a short list. */
export function toGapSuggestions(ai: AiGaps, request: GapAdvisorRequest): GapSuggestion[] {
  const known = new Set(request.wardrobe.map((i) => i.id))
  const seen = new Set<string>()
  const out: GapSuggestion[] = []
  for (const g of ai.gaps) {
    const name = clean(g.name, 80)
    const reason = clean(g.reason, 300)
    const category = CategoryIdSchema.safeParse(g.category)
    if (!name || !reason || !category.success || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    out.push({
      category: category.data,
      name,
      reason,
      colors: [...new Set(g.colors.map((c) => clean(c, 30).toLowerCase()).filter(Boolean))].slice(0, 3),
      pairsWithItemIds: [...new Set(g.pairsWithItemIds.filter((id) => known.has(id)))].slice(0, 4),
    })
    if (out.length === LIMIT) break
  }
  return out
}
