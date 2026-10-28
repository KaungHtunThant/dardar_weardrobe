import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import type { AiSuggestion } from '../../server/ai/stylePrompt'
import { readStylePayload } from '../../server/ai/stylePrompt'

/**
 * Stands in for Claude: reads the machine-readable payload from the prompt, styles it with the
 * rule-based advisor, then adds the kind of noise a real model might (unknown ids, out-of-range score).
 */
export async function fakeModel(userMessage: string, noisy = true): Promise<AiSuggestion> {
  const payload = readStylePayload(userMessage)
  const s = await new RuleBasedStyleAdvisor().suggestLook({
    wardrobe: payload.wardrobe,
    pinnedItemIds: payload.pinnedItemIds,
    fillCategories: payload.mayAddFrom,
    prompt: payload.brief ?? undefined,
  })
  return {
    title: s.title,
    itemIds: noisy ? [...s.itemIds, 'item-ghost'] : s.itemIds,
    explanation: s.explanation,
    rating: {
      score: noisy ? 11 : s.rating.score,
      verdict: s.rating.verdict,
      works: s.rating.works,
      fails: s.rating.fails,
      fixes: s.rating.fixes.map((f) => ({ removeItemId: f.removeItemId ?? null, addItemId: f.addItemId ?? null, note: f.note })),
    },
  }
}
