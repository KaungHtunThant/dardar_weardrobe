import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import type { StyleAdvisor, StyleProgress } from '#shared/contracts/StyleAdvisor'
import { StyleRatingSchema } from '#shared/models/styleMatch'
import { seedItems } from '#shared/fixtures/seed'
import { ClaudeApiStyleAdvisor } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeCliStyleAdvisor } from '../../server/ai/ClaudeCliStyleAdvisor'
import { runProcess } from '../../server/ai/process'
import { LocalStylistAgent } from '../../server/agent/LocalStylistAgent'
import { systemClock } from '../../server/services/clock'

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

/** Streams a look and checks progress arrived well before the end, ending on the final picks. */
async function checkStream(advisor: StyleAdvisor) {
  const started = Date.now()
  const progress: (StyleProgress & { at: number })[] = []
  const look = await advisor.suggestLook(request, { onProgress: (p) => progress.push({ ...p, at: Date.now() - started }) })
  const total = Date.now() - started
  console.log(`total ${total} ms; first progress at ${progress[0]?.at} ms; ${progress.length} updates`)
  console.log(progress.map((p) => `${p.at}ms ${p.stage} [${p.aiItemIds.join(', ')}] ${p.title ?? ''} ${p.verdict ?? ''}`).join('\n'))
  check(look)
  expect(progress.length).toBeGreaterThan(2)
  expect(progress.at(-1)!.aiItemIds).toEqual(look.aiItemIds)
  return progress
}

describe.runIf(process.env.RUN_LIVE === '1')('Claude advisors (live)', () => {
  it('CLI streams progress while it styles', async () => {
    await checkStream(new ClaudeCliStyleAdvisor({ runner: runProcess, model: process.env.CLAUDE_MODEL }))
  }, 240_000)

  it('CLI styles a look as the stylist agent set up on disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dardar-live-agent-'))
    try {
      const agent = new LocalStylistAgent(dir, systemClock)
      agent.ensure()
      check(await new ClaudeCliStyleAdvisor({ runner: runProcess, model: process.env.CLAUDE_MODEL, agent }).suggestLook(request))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 240_000)

  it('CLI stops when cancelled', async () => {
    const controller = new AbortController()
    const run = new ClaudeCliStyleAdvisor({ runner: runProcess, model: process.env.CLAUDE_MODEL }).suggestLook(request, {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    })
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
  }, 240_000)

  it.runIf(Boolean(process.env.ANTHROPIC_API_KEY))('API streams progress while it styles', async () => {
    await checkStream(new ClaudeApiStyleAdvisor({ messages: new Anthropic().beta.messages }))
  }, 240_000)

  it('CLI styles and rates a look', async () => {
    check(await new ClaudeCliStyleAdvisor({ runner: runProcess, model: process.env.CLAUDE_MODEL }).suggestLook(request))
  }, 240_000)

  it.runIf(Boolean(process.env.ANTHROPIC_API_KEY))('API styles and rates a look', async () => {
    check(await new ClaudeApiStyleAdvisor({ messages: new Anthropic().beta.messages }).suggestLook(request))
  }, 240_000)
})
