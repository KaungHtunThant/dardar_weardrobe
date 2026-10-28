import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { StyleRatingSchema } from '#shared/models/styleMatch'
import { seedItems } from '#shared/fixtures/seed'
import { ClaudeApiStyleAdvisor } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeCliStyleAdvisor } from '../../server/ai/ClaudeCliStyleAdvisor'
import { runProcess } from '../../server/ai/process'

// Real model calls (cost money / subscription usage). Opt in with RUN_LIVE=1 (+ ANTHROPIC_API_KEY for the API test).
const request = {
  wardrobe: seedItems,
  pinnedItemIds: ['item-red-evening-dress', 'item-white-sneakers'],
  fillCategories: ['bags' as const, 'accessories' as const],
  prompt: 'dinner date',
}

function check(look: Awaited<ReturnType<ClaudeCliStyleAdvisor['suggestLook']>>) {
  console.log(JSON.stringify(look, null, 2))
  expect(look.itemIds.slice(0, 2)).toEqual(request.pinnedItemIds)
  expect(() => StyleRatingSchema.parse(look.rating)).not.toThrow()
}

describe.runIf(process.env.RUN_LIVE === '1')('Claude advisors (live)', () => {
  it('CLI styles and rates a look', async () => {
    check(await new ClaudeCliStyleAdvisor({ runner: runProcess, model: process.env.CLAUDE_MODEL }).suggestLook(request))
  }, 240_000)

  it.runIf(Boolean(process.env.ANTHROPIC_API_KEY))('API styles and rates a look', async () => {
    check(await new ClaudeApiStyleAdvisor({ messages: new Anthropic().beta.messages }).suggestLook(request))
  }, 240_000)
})
