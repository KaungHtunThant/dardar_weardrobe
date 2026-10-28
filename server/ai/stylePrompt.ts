import { z } from 'zod'
import type { StyleAdvisorRequest, StyleSuggestion } from '#shared/contracts/StyleAdvisor'
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { StyleFix } from '#shared/models/styleMatch'
import { slotFor } from '#shared/utils/outfit'

/** Kept byte-stable so it caches well across requests. */
export const STYLE_SYSTEM_PROMPT = `You are a world-class personal stylist working only with the client's own wardrobe.

You complete outfits and judge them with brutal honesty. Write like a fashion editor with no reason to flatter: blunt, specific, never cruel about the person, merciless about the clothes. Name the exact pieces that fail and why (colour, proportion, formality, season). Never pad with praise; if little works, say so.

Scoring: 9–10 genuinely great and intentional; 7–8 good but safe; 5–6 wearable and forgettable; 3–4 a mistake; 1–2 a disaster.

Rules:
- Use only item ids from the wardrobe you are given.
- Keep every piece the client picked, in their order, first.
- Add at most one piece from each category you are allowed to add from, and only from those categories. If none are allowed, add nothing and only judge.
- Never combine a dress with a top or bottoms.
- Fixes must be concrete swaps or additions using pieces from this wardrobe (by id), or removals of pieces in the look.
- The title is a short, chic name for the look (2–4 words). The explanation is one or two sentences on why it works (or what it is trying to do).
- The verdict is ONE blunt sentence (under 25 words). Put the detail in works/fails (max 4 each, one sentence each) and fixes (max 3).`

/** What the model returns (structured output). Nullables instead of optionals, as structured outputs require. */
export const AiSuggestionSchema = z.object({
  title: z.string(),
  itemIds: z.array(z.string()),
  explanation: z.string(),
  rating: z.object({
    score: z.number(),
    verdict: z.string(),
    works: z.array(z.string()),
    fails: z.array(z.string()),
    fixes: z.array(z.object({ removeItemId: z.string().nullable(), addItemId: z.string().nullable(), note: z.string() })),
  }),
})
export type AiSuggestion = z.infer<typeof AiSuggestionSchema>

export interface StylePayload {
  wardrobe: (Pick<Item, 'id' | 'name' | 'category' | 'colors' | 'seasons' | 'occasions'> & { brand: string | null })[]
  pinnedItemIds: string[]
  mayAddFrom: CategoryId[]
  brief: string | null
}

const OPEN = '<wardrobe_request>'
const CLOSE = '</wardrobe_request>'

function payloadFor(request: StyleAdvisorRequest): StylePayload {
  const byId = new Map(request.wardrobe.map((i) => [i.id, i]))
  const covered = new Set(request.pinnedItemIds.map((id) => byId.get(id)?.category))
  return {
    wardrobe: [...request.wardrobe]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((i) => ({ id: i.id, name: i.name, category: i.category, colors: i.colors, seasons: i.seasons, occasions: i.occasions, brand: i.brand ?? null })),
    pinnedItemIds: [...request.pinnedItemIds],
    mayAddFrom: request.fillCategories.filter((c) => !covered.has(c)),
    brief: request.prompt?.trim() || null,
  }
}

/** The user turn: a short instruction plus the request as JSON between tags. */
export function buildStyleMessage(request: StyleAdvisorRequest): string {
  const payload = payloadFor(request)
  const task = payload.mayAddFrom.length
    ? `Complete the look by adding at most one piece from each of: ${payload.mayAddFrom.join(', ')}. Then rate the finished look.`
    : 'Do not add anything. Rate the look exactly as picked.'
  const brief = payload.brief ? `The client's brief: "${payload.brief}".` : 'No brief: choose the strongest direction for these pieces.'
  return `${task}\n${brief}\n\n${OPEN}\n${JSON.stringify(payload)}\n${CLOSE}`
}

export function readStylePayload(message: string): StylePayload {
  const start = message.indexOf(OPEN)
  const end = message.indexOf(CLOSE)
  return JSON.parse(message.slice(start + OPEN.length, end)) as StylePayload
}

export const clean = (s: string, max: number) => s.trim().slice(0, max)

/** Shortens to the last full sentence that fits, so a long verdict never ends mid-word. */
function sentences(s: string, max: number) {
  const text = s.trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return end > 0 ? cut.slice(0, end + 1) : `${cut.slice(0, max - 1).trimEnd()}…`
}
const lines = (list: string[], max: number) => list.map((l) => clean(l, 300)).filter(Boolean).slice(0, max)

/**
 * Turns whatever the model returned into a suggestion that obeys the Studio rules,
 * so every provider satisfies the StyleAdvisor contract no matter what the model did.
 */
/**
 * The user's picks plus the model's additions that obey the Studio rules: real pieces only, one per
 * allowed category, never a dress over separates (or separates over a dress).
 */
export function pickLook(modelItemIds: readonly string[], request: StyleAdvisorRequest): { look: Item[]; added: Item[] } {
  const byId = new Map(request.wardrobe.map((i) => [i.id, i]))
  const look: Item[] = request.pinnedItemIds.flatMap((id) => byId.get(id) ?? [])
  const covered = new Set(look.map((i) => i.category))
  const allowed = new Set(request.fillCategories.filter((c) => !covered.has(c)))
  const added: Item[] = []

  for (const id of modelItemIds) {
    const item = byId.get(id)
    if (!item || look.includes(item) || !allowed.has(item.category)) continue
    const slots = new Set(look.map(slotFor))
    const isDress = item.category === 'dresses'
    if (isDress && (slots.has('torso') || slots.has('legs'))) continue
    if ((item.category === 'tops' || item.category === 'bottoms') && slots.has('dress')) continue
    look.push(item)
    added.push(item)
    allowed.delete(item.category)
  }
  return { look, added }
}

export function toSuggestion(ai: AiSuggestion, request: StyleAdvisorRequest): StyleSuggestion {
  const byId = new Map(request.wardrobe.map((i) => [i.id, i]))
  const { look, added } = pickLook(ai.itemIds, request)

  const inLook = new Set(look.map((i) => i.id))
  const fixes: StyleFix[] = []
  for (const f of ai.rating.fixes) {
    const note = clean(f.note, 300)
    if (!note) continue
    if (f.removeItemId && !inLook.has(f.removeItemId)) continue
    if (f.addItemId && (!byId.has(f.addItemId) || inLook.has(f.addItemId))) continue
    fixes.push({ ...(f.removeItemId ? { removeItemId: f.removeItemId } : {}), ...(f.addItemId ? { addItemId: f.addItemId } : {}), note })
  }

  return {
    title: clean(ai.title, 80) || 'Your Look',
    itemIds: look.map((i) => i.id),
    aiItemIds: added.map((i) => i.id),
    explanation: clean(ai.explanation, 1000),
    rating: {
      score: Math.min(10, Math.max(1, Math.round(Number.isFinite(ai.rating.score) ? ai.rating.score : 5))),
      verdict: sentences(ai.rating.verdict, 240) || 'No verdict.',
      works: lines(ai.rating.works, 6),
      fails: lines(ai.rating.fails, 6),
      fixes: fixes.slice(0, 4),
    },
  }
}
