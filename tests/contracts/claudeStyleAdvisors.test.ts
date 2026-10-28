import { describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { ClaudeApiStyleAdvisor, type StructuredMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeCliStyleAdvisor } from '../../server/ai/ClaudeCliStyleAdvisor'
import type { ProcessRunner } from '../../server/ai/process'
import { fakeModel } from '../server/fakeModel'
import { styleAdvisorContract } from './styleAdvisor.contract'

const cliRunner: ProcessRunner = async (_cmd, _args, { input }) => ({
  code: 0,
  stdout: JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: await fakeModel(input ?? '') }),
  stderr: '',
})

const apiMessages: StructuredMessages = {
  async parse(params) {
    const text = params.messages[0]!.content as string
    return { stop_reason: 'end_turn', parsed_output: await fakeModel(text) }
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

  it('asks the API for structured output with fallbacks and handles refusals', async () => {
    let params: Parameters<StructuredMessages['parse']>[0] | undefined
    const messages: StructuredMessages = {
      async parse(p) {
        params = p
        return { stop_reason: 'refusal', parsed_output: null }
      },
    }
    await expect(ask(new ClaudeApiStyleAdvisor({ messages }))).rejects.toThrow(/declined/)
    expect(params!.model).toBe('claude-opus-5-5')
    expect(params!.fallbacks).toBe('default')
    expect(params!.betas).toContain('server-side-fallback-2026-07-01')
    expect(params!.output_config?.format).toBeDefined()
  })
})
