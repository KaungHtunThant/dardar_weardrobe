import { describe, expect, it } from 'vitest'
import { RuleBasedGapAdvisor } from '#shared/advisors/RuleBasedGapAdvisor'
import { seedItems } from '#shared/fixtures/seed'
import type { DayWeather } from '#shared/models/weather'
import { ClaudeApiGapAdvisor } from '../../server/ai/ClaudeApiGapAdvisor'
import { ClaudeCliGapAdvisor } from '../../server/ai/ClaudeCliGapAdvisor'
import type { StructuredMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { buildGapMessage, readGapPayload, toGapSuggestions, type AiGaps } from '../../server/ai/gapPrompt'
import type { ProcessRunner } from '../../server/ai/process'
import { fakeGapModel } from '../server/fakeModel'
import { gapAdvisorContract } from './gapAdvisor.contract'

const cliRunner: ProcessRunner = async (_cmd, _args, { input, signal }) => {
  signal?.throwIfAborted()
  const answer = await fakeGapModel(input ?? '')
  return { code: 0, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: answer }), stderr: '' }
}

const apiMessages = (stopReason = 'end_turn'): StructuredMessages => ({
  async parse(params, options) {
    options?.signal?.throwIfAborted()
    const answer = await fakeGapModel(params.messages[0]!.content as string)
    return { stop_reason: stopReason, parsed_output: stopReason === 'refusal' ? null : answer }
  },
})

gapAdvisorContract('RuleBasedGapAdvisor', () => new RuleBasedGapAdvisor())
gapAdvisorContract('ClaudeCliGapAdvisor (fake process)', () => new ClaudeCliGapAdvisor({ runner: cliRunner }))
gapAdvisorContract('ClaudeApiGapAdvisor (fake client)', () => new ClaudeApiGapAdvisor({ messages: apiMessages() }))

const day = (over: Partial<DayWeather>): DayWeather => ({
  date: '2026-10-30',
  place: 'Oslo, Norway',
  condition: 'snow',
  summary: 'Light snow',
  tempMin: -6,
  tempMax: -1,
  feelsLikeMin: -10,
  feelsLikeMax: -4,
  precipitationChance: 80,
  windMax: 20,
  ...over,
})

describe('the offline gap rules', () => {
  const advisor = new RuleBasedGapAdvisor()
  const names = async (...args: Parameters<RuleBasedGapAdvisor['suggestGaps']>) => (await advisor.suggestGaps(...args)).map((g) => g.name)

  it('finds the staples the demo wardrobe lacks, and not the ones it has', async () => {
    const found = await names({ wardrobe: seedItems })
    expect(found).toEqual(expect.arrayContaining(['Tailored Blazer', 'Crisp White Shirt', 'Black Leather Belt']))
    expect(found).not.toContain('Straight-Leg Jeans')
    expect(found).not.toContain('Classic Trench Coat')
    expect(found).not.toContain('White Leather Trainers')
  })

  it('dresses the wardrobe for the climate where the user lives', async () => {
    const noWinter = seedItems.filter((i) => !(i.category === 'outerwear' && i.seasons.includes('winter')))
    const cold = await advisor.suggestGaps({ wardrobe: noWinter, weather: day({}) })
    expect(cold[0]).toMatchObject({ name: 'Warm Wool Coat', category: 'outerwear' })
    expect(cold[0]!.reason).toContain('Oslo')
    expect(cold.map((g) => g.name)).not.toContain('Flat Leather Sandals')

    const hot = await names({ wardrobe: noWinter, weather: day({ place: 'Bangkok, Thailand', condition: 'clear', summary: 'Clear sky', tempMin: 27, tempMax: 34, feelsLikeMin: 30, feelsLikeMax: 38, precipitationChance: 10 }) })
    expect(hot[0]).toBe('Flat Leather Sandals')
    expect(hot).not.toContain('Warm Wool Coat')
  })

  it('pairs each piece with what it would be worn with, one per category, never its own', async () => {
    const [blazer] = (await advisor.suggestGaps({ wardrobe: seedItems })).filter((g) => g.name === 'Tailored Blazer')
    const pairs = blazer!.pairsWithItemIds.map((id) => seedItems.find((i) => i.id === id)!)
    expect(pairs.length).toBeGreaterThan(1)
    expect(new Set(pairs.map((p) => p.category)).size).toBe(pairs.length)
    expect(pairs.every((p) => p.category !== 'outerwear')).toBe(true)
    expect(pairs.every((p) => p.occasions.some((o) => o === 'work' || o === 'evening'))).toBe(true)
  })
})

describe('the gap prompt', () => {
  const sample = (over: Partial<AiGaps['gaps'][number]> = {}): AiGaps['gaps'][number] => ({
    category: 'outerwear',
    name: '  Tailored Blazer ',
    reason: 'Sharpens the trousers.',
    colors: ['Black', 'black', ' '],
    pairsWithItemIds: ['item-black-trousers', 'item-ghost', 'item-black-trousers'],
    ...over,
  })

  it('carries the wardrobe, the city and its weather', () => {
    const message = buildGapMessage({ wardrobe: seedItems, weather: day({}) })
    expect(message).toMatch(/^Task: find what the wardrobe is missing\./)
    expect(message).toContain('The client lives in Oslo, Norway; today: light snow')
    const payload = readGapPayload(message)
    expect(payload.wardrobe).toHaveLength(seedItems.length)
    expect(payload.place).toBe('Oslo, Norway')
    expect(readGapPayload(buildGapMessage({ wardrobe: [] })).place).toBeNull()
  })

  it('tidies what the model returns: trims, dedupes, drops unknown pieces and caps the list', () => {
    const out = toGapSuggestions(
      { gaps: [sample(), sample({ name: 'tailored blazer' }), sample({ name: ' ', category: 'shoes' }), ...Array.from({ length: 8 }, (_, n) => sample({ name: `Piece ${n}` }))] },
      { wardrobe: seedItems },
    )
    expect(out[0]).toEqual({ category: 'outerwear', name: 'Tailored Blazer', reason: 'Sharpens the trousers.', colors: ['black'], pairsWithItemIds: ['item-black-trousers'] })
    expect(out.map((g) => g.name)).not.toContain('tailored blazer')
    expect(out).toHaveLength(5)
  })

  it('the API provider says so when Claude declines', async () => {
    await expect(new ClaudeApiGapAdvisor({ messages: apiMessages('refusal') }).suggestGaps({ wardrobe: seedItems })).rejects.toThrow(/declined/)
  })
})
