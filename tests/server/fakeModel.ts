import { RuleBasedGapAdvisor } from '#shared/advisors/RuleBasedGapAdvisor'
import { RuleBasedStyleAdvisor } from '#shared/advisors/RuleBasedStyleAdvisor'
import { readGapPayload, type AiGaps } from '../../server/ai/gapPrompt'
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

/**
 * What `claude -p --output-format stream-json --verbose --include-partial-messages` prints for an
 * answer: the structured output streams as input_json_delta chunks, then a final result line.
 */
export function cliStreamJson(answer: unknown, chunk = 23): string {
  const json = JSON.stringify(answer)
  const event = (e: object) => JSON.stringify({ type: 'stream_event', event: e })
  const lines = [
    JSON.stringify({ type: 'system', subtype: 'init' }),
    event({ type: 'content_block_start', index: 1, content_block: { type: 'tool_use', name: 'StructuredOutput', input: {} } }),
  ]
  for (let i = 0; i < json.length; i += chunk)
    lines.push(event({ type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: json.slice(i, i + chunk) } }))
  lines.push(event({ type: 'content_block_stop', index: 1 }))
  lines.push(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: answer }))
  return `${lines.join('\n')}\n`
}

/** The answer as text snapshots, the way the API streams a structured-output text block. */
export function textSnapshots(answer: unknown, chunk = 23): string[] {
  const json = JSON.stringify(answer)
  const out: string[] = []
  for (let i = chunk; i < json.length + chunk; i += chunk) out.push(json.slice(0, i))
  return out
}

/**
 * Stands in for Claude finding wardrobe gaps: the offline rules on the prompt's payload, plus the
 * noise a real model might add (a piece that doesn't exist, a repeated suggestion, too many).
 */
export async function fakeGapModel(userMessage: string): Promise<AiGaps> {
  const payload = readGapPayload(userMessage)
  const gaps = await new RuleBasedGapAdvisor().suggestGaps({ wardrobe: payload.wardrobe as never })
  const noisy = gaps.map((g) => ({ ...g, pairsWithItemIds: [...g.pairsWithItemIds, 'item-ghost'] }))
  return { gaps: [...noisy, ...noisy.slice(0, 1), ...noisy.map((g) => ({ ...g, name: `${g.name} II` }))] }
}
