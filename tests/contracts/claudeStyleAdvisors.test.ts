import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import type { StyleProgress } from '#shared/contracts/StyleAdvisor'
import { ClaudeApiStyleAdvisor, type StreamingMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeCliStyleAdvisor } from '../../server/ai/ClaudeCliStyleAdvisor'
import type { ProcessRunner } from '../../server/ai/process'
import { cliStreamJson, fakeModel, textSnapshots } from '../server/fakeModel'
import { styleAdvisorContract } from './styleAdvisor.contract'

/** Answers like `claude -p`: plain JSON, or stream-json fed through onStdout when asked to stream. */
const cliRunner: ProcessRunner = async (_cmd, args, { input, signal, onStdout }) => {
  signal?.throwIfAborted()
  const answer = await fakeModel(input ?? '')
  if (!args.includes('stream-json'))
    return { code: 0, stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: answer }), stderr: '' }
  const stdout = cliStreamJson(answer)
  for (let i = 0; i < stdout.length; i += 50) onStdout?.(stdout.slice(i, i + 50))
  return { code: 0, stdout, stderr: '' }
}

/** Streams like `client.beta.messages.stream()` with structured output: text snapshots, then the parsed message. */
function fakeStream(answer: () => Promise<unknown>, signal?: AbortSignal, stopReason = 'end_turn') {
  const listeners: ((delta: string, snapshot: string) => void)[] = []
  return {
    on(_event: 'text', listener: (delta: string, snapshot: string) => void) {
      listeners.push(listener)
      return this
    },
    async finalMessage() {
      if (signal?.aborted) throw Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })
      const parsed = await answer()
      for (const snap of textSnapshots(parsed)) for (const l of listeners) l('', snap)
      return { stop_reason: stopReason, parsed_output: stopReason === 'refusal' ? null : parsed }
    },
  }
}

const apiMessages: StreamingMessages = {
  stream(params, options) {
    return fakeStream(() => fakeModel(params.messages[0]!.content as string), options?.signal)
  },
}

styleAdvisorContract('ClaudeCliStyleAdvisor (fake process)', () => new ClaudeCliStyleAdvisor({ runner: cliRunner }))
styleAdvisorContract('ClaudeApiStyleAdvisor (fake client)', () => new ClaudeApiStyleAdvisor({ messages: apiMessages }))

describe('Claude style advisors', () => {
  const ask = (advisor: { suggestLook: ClaudeCliStyleAdvisor['suggestLook'] }) =>
    advisor.suggestLook({ wardrobe: seedItems, pinnedItemIds: ['item-linen-tee'], fillCategories: ['shoes'] })

  it('sends the CLI a schema, no tools, the model, and the prompt on stdin', async () => {
    let seen: { cmd: string; args: string[]; input?: string } | undefined
    const runner: ProcessRunner = async (cmd, args, opts) => {
      seen = { cmd, args, input: opts.input }
      return cliRunner(cmd, args, opts)
    }
    await ask(new ClaudeCliStyleAdvisor({ runner, model: 'claude-opus-5-5' }))
    expect(seen!.cmd).toBe('claude')
    expect(seen!.args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--json-schema', '--tools', '', '--model', 'claude-opus-5-5']))
    expect(seen!.input).toContain('item-linen-tee')
  })

  it('reports CLI failures clearly', async () => {
    const failing: ProcessRunner = async () => ({ code: 1, stdout: '', stderr: 'Not logged in' })
    await expect(ask(new ClaudeCliStyleAdvisor({ runner: failing }))).rejects.toThrow(/Claude CLI failed: Not logged in/)
    const errorResult: ProcessRunner = async () => ({ code: 0, stdout: JSON.stringify({ type: 'result', is_error: true, result: 'Usage limit reached' }), stderr: '' })
    await expect(ask(new ClaudeCliStyleAdvisor({ runner: errorResult }))).rejects.toThrow(/Usage limit reached/)
    const missing: ProcessRunner = async () => Promise.reject(Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }))
    await expect(ask(new ClaudeCliStyleAdvisor({ runner: missing }))).rejects.toThrow(/isn't installed/)
  })

  it('streams progress from both providers, ending on the verdict', async () => {
    for (const advisor of [new ClaudeCliStyleAdvisor({ runner: cliRunner }), new ClaudeApiStyleAdvisor({ messages: apiMessages })]) {
      const progress: StyleProgress[] = []
      const look = await advisor.suggestLook(
        { wardrobe: seedItems, pinnedItemIds: ['item-linen-tee'], fillCategories: ['bottoms', 'shoes'] },
        { onProgress: (p) => progress.push(p) },
      )
      expect(progress.length).toBeGreaterThan(3)
      expect(progress[0]!.stage).toBe('picking')
      expect(progress.at(-1)).toMatchObject({ stage: 'rating', aiItemIds: look.aiItemIds, verdict: look.rating.verdict })
    }
  })

  it('asks the API for structured output with fallbacks and handles refusals', async () => {
    let params: Parameters<StreamingMessages['stream']>[0] | undefined
    const messages: StreamingMessages = {
      stream(p) {
        params = p
        return fakeStream(async () => ({}), undefined, 'refusal')
      },
    }
    await expect(ask(new ClaudeApiStyleAdvisor({ messages }))).rejects.toThrow(/declined/)
    expect(params!.model).toBe('claude-opus-5-5')
    expect(params!.fallbacks).toBe('default')
    expect(params!.betas).toContain('server-side-fallback-2026-07-01')
    expect(params!.output_config?.format).toBeDefined()
  })
})
