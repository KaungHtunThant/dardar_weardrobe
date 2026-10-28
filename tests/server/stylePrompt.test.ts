import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { buildStyleMessage, readStylePayload, toSuggestion, type AiSuggestion } from '../../server/ai/stylePrompt'

const request = { wardrobe: seedItems, pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes'] as const, prompt: 'brunch' }
const ai = (over: Partial<AiSuggestion> = {}): AiSuggestion => ({
  title: '  Brunch Ready ',
  itemIds: ['item-linen-tee', 'item-straight-jeans', 'item-white-sneakers'],
  explanation: 'Fine.',
  rating: { score: 7, verdict: 'Solid.', works: ['Clean.'], fails: [], fixes: [] },
  ...over,
})

describe('style prompt', () => {
  it('embeds a machine-readable payload with only what the model needs', () => {
    const message = buildStyleMessage({ ...request, fillCategories: [...request.fillCategories] })
    const payload = readStylePayload(message)
    expect(payload.pinnedItemIds).toEqual(['item-linen-tee'])
    expect(payload.mayAddFrom).toEqual(['bottoms', 'shoes'])
    expect(payload.brief).toBe('brunch')
    expect(Object.keys(payload.wardrobe[0]!).sort()).toEqual(['brand', 'category', 'colors', 'id', 'name', 'occasions', 'seasons'].sort())
  })

  it('does not offer categories the user already covered', () => {
    const payload = readStylePayload(buildStyleMessage({ ...request, fillCategories: ['tops', 'shoes'] }))
    expect(payload.mayAddFrom).toEqual(['shoes'])
  })
})

describe('toSuggestion', () => {
  const r = { ...request, fillCategories: [...request.fillCategories] }

  it('keeps a valid answer, trimming text and computing the AI picks', () => {
    const s = toSuggestion(ai(), r)
    expect(s.title).toBe('Brunch Ready')
    expect(s.aiItemIds).toEqual(['item-straight-jeans', 'item-white-sneakers'])
  })

  it('restores dropped picks and drops unknown, duplicate, disallowed or conflicting pieces', () => {
    const s = toSuggestion(
      ai({ itemIds: ['item-ghost', 'item-straight-jeans', 'item-black-trousers', 'item-trench-coat', 'item-sage-slip-dress', 'item-white-sneakers', 'item-white-sneakers'] }),
      r,
    )
    expect(s.itemIds).toEqual(['item-linen-tee', 'item-straight-jeans', 'item-white-sneakers'])
  })

  it('clamps the score and keeps only fixes that use real pieces', () => {
    const s = toSuggestion(
      ai({
        rating: {
          score: 12.4,
          verdict: 'x',
          works: ['', 'ok'],
          fails: [],
          fixes: [
            { removeItemId: 'item-straight-jeans', addItemId: 'item-black-trousers', note: 'Swap.' },
            { removeItemId: 'item-not-worn', addItemId: null, note: 'Bad remove.' },
            { removeItemId: null, addItemId: 'item-ghost', note: 'Bad add.' },
            { removeItemId: null, addItemId: null, note: '  ' },
          ],
        },
      }),
      r,
    )
    expect(s.rating.score).toBe(10)
    expect(s.rating.works).toEqual(['ok'])
    expect(s.rating.fixes).toEqual([{ removeItemId: 'item-straight-jeans', addItemId: 'item-black-trousers', note: 'Swap.' }])
  })
})

describe('cliJsonSchema', () => {
  it('omits the $schema URI the CLI validator rejects', async () => {
    const { cliJsonSchema } = await import('../../server/ai/claudeCli')
    const { AiSuggestionSchema } = await import('../../server/ai/stylePrompt')
    const schema = cliJsonSchema(AiSuggestionSchema) as Record<string, unknown>
    expect(schema.$schema).toBeUndefined()
    expect(schema.type).toBe('object')
  })
})

describe('long verdicts', () => {
  it('are shortened at a sentence boundary, never mid-word', () => {
    const long = `A mistake. ${'The shoes and the dress come from two different evenings. '.repeat(6)}`
    const s = toSuggestion(ai({ rating: { score: 4, verdict: long, works: [], fails: [], fixes: [] } }), { ...request, fillCategories: [...request.fillCategories] })
    expect(s.rating.verdict.length).toBeLessThanOrEqual(240)
    expect(s.rating.verdict.endsWith('.')).toBe(true)
  })
})
