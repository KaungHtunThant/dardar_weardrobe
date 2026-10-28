import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedItems } from '#shared/fixtures/seed'
import { STYLIST_AGENT_NAME, STYLIST_AGENT_PROMPT, STYLIST_AGENT_VERSION } from '../../server/ai/agent/stylistPrompt'
import { BUILT_IN_STYLIST } from '../../server/ai/agent/builtInStylist'
import { LocalStylistAgent } from '../../server/agent/LocalStylistAgent'
import { ClaudeApiStyleAdvisor, type StreamingMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeApiTagger } from '../../server/ai/ClaudeApiTagger'
import { ClaudeCliStyleAdvisor } from '../../server/ai/ClaudeCliStyleAdvisor'
import { ClaudeCliTagger } from '../../server/ai/ClaudeCliTagger'
import type { ProcessOptions, ProcessRunner } from '../../server/ai/process'
import type { Clock } from '../../server/services/clock'
import { cliStreamJson, fakeModel } from './fakeModel'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-agent-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const at = (iso: string): Clock => ({ now: () => new Date(iso), newId: () => 'id' })
const agentDir = () => join(dir, 'agent')

describe('stylist prompt', () => {
  it('is one persona with a playbook for every task', () => {
    expect(STYLIST_AGENT_PROMPT).toMatch(/Task: style a look/)
    expect(STYLIST_AGENT_PROMPT).toMatch(/Task: describe a garment/)
    expect(STYLIST_AGENT_PROMPT).toMatch(/Task: find the garment/)
    expect(STYLIST_AGENT_NAME).toBe('dardar-stylist')
  })
})

describe('LocalStylistAgent', () => {
  it('has no CLI file until it is set up', () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    expect(agent.info()).toBeNull()
    expect(agent.cliAgentsFile()).toBeNull()
    expect(agent.systemPrompt()).toBe(STYLIST_AGENT_PROMPT)
  })

  it('writes a Claude CLI agents file on first run', () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    const info = agent.ensure()
    expect(info).toEqual({ name: STYLIST_AGENT_NAME, displayName: 'Dardar', version: STYLIST_AGENT_VERSION, createdAt: '2026-10-28T10:00:00.000Z' })
    const file = agent.cliAgentsFile()!
    const agents = JSON.parse(readFileSync(file, 'utf8'))
    expect(Object.keys(agents)).toEqual([STYLIST_AGENT_NAME])
    expect(agents[STYLIST_AGENT_NAME]).toMatchObject({ prompt: STYLIST_AGENT_PROMPT, description: expect.any(String) })
  })

  it('keeps the same agent on later starts', () => {
    new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z')).ensure()
    const again = new LocalStylistAgent(agentDir(), at('2026-11-02T10:00:00Z')).ensure()
    expect(again.createdAt).toBe('2026-10-28T10:00:00.000Z')
  })

  it('refreshes the agent when the app ships a new version of it', () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    agent.ensure()
    writeFileSync(agent.cliAgentsFile()!, JSON.stringify({ [STYLIST_AGENT_NAME]: { description: 'old', prompt: 'old' } }))
    writeFileSync(join(agentDir(), 'agent.json'), JSON.stringify({ ...agent.info(), version: 0 }))
    const info = new LocalStylistAgent(agentDir(), at('2026-11-02T10:00:00Z')).ensure()
    expect(info).toMatchObject({ version: STYLIST_AGENT_VERSION, createdAt: '2026-10-28T10:00:00.000Z' })
    expect(JSON.parse(readFileSync(agent.cliAgentsFile()!, 'utf8'))[STYLIST_AGENT_NAME].prompt).toBe(STYLIST_AGENT_PROMPT)
  })

  it('can be recreated from scratch', () => {
    new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z')).ensure()
    const info = new LocalStylistAgent(agentDir(), at('2026-11-02T10:00:00Z')).recreate()
    expect(info.createdAt).toBe('2026-11-02T10:00:00.000Z')
    expect(existsSync(join(agentDir(), 'agents.json'))).toBe(true)
  })
})

describe('Claude providers run as the stylist agent', () => {
  const request = { wardrobe: seedItems, pinnedItemIds: ['item-linen-tee'], fillCategories: ['shoes' as const] }
  const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

  function recordingRunner() {
    const calls: { args: string[]; options: ProcessOptions }[] = []
    const runner: ProcessRunner = async (_cmd, args, options) => {
      calls.push({ args, options })
      const answer = args.includes('Read')
        ? { name: 'Tee', category: 'tops', colors: ['white'], seasons: [], occasions: [] }
        : await fakeModel(options.input ?? '')
      return { code: 0, stdout: JSON.stringify({ type: 'result', is_error: false, structured_output: answer }), stderr: '' }
    }
    return { calls, runner }
  }

  it('CLI: selects the agent from its file and runs in its folder', async () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    agent.ensure()
    const { calls, runner } = recordingRunner()
    await new ClaudeCliStyleAdvisor({ runner, agent }).suggestLook(request)
    await new ClaudeCliTagger({ runner, agent }).suggestDetails({ bytes: PNG, mimeType: 'image/png', path: '/data/images/a.png' })
    for (const { args, options } of calls) {
      expect(args).toEqual(expect.arrayContaining(['--agents', agent.cliAgentsFile()!, '--agent', STYLIST_AGENT_NAME]))
      expect(args).not.toContain('--system-prompt')
      expect(options.cwd).toBe(agentDir())
    }
  })

  it('CLI: falls back to the persona as the system prompt when no file exists', async () => {
    const { calls, runner } = recordingRunner()
    await new ClaudeCliStyleAdvisor({ runner, agent: BUILT_IN_STYLIST }).suggestLook(request)
    const args = calls[0]!.args
    expect(args[args.indexOf('--system-prompt') + 1]).toBe(STYLIST_AGENT_PROMPT)
    expect(args).not.toContain('--agents')
  })

  it('CLI streaming still works as the agent', async () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    agent.ensure()
    const runner: ProcessRunner = async (_cmd, args, { input, onStdout }) => {
      expect(args).toContain('--agent')
      const stdout = cliStreamJson(await fakeModel(input ?? ''))
      onStdout?.(stdout)
      return { code: 0, stdout, stderr: '' }
    }
    let updates = 0
    await new ClaudeCliStyleAdvisor({ runner, agent }).suggestLook(request, { onProgress: () => updates++ })
    expect(updates).toBeGreaterThan(0)
  })

  it('API: the agent persona is the cached system prompt', async () => {
    const agent = new LocalStylistAgent(agentDir(), at('2026-10-28T10:00:00Z'))
    let system: unknown
    const messages: StreamingMessages = {
      stream(params) {
        system = params.system
        return {
          on: () => undefined,
          finalMessage: async () => ({ stop_reason: 'end_turn', parsed_output: await fakeModel(params.messages[0]!.content as string) }),
        }
      },
    }
    await new ClaudeApiStyleAdvisor({ messages, agent }).suggestLook(request)
    expect(system).toEqual([{ type: 'text', text: STYLIST_AGENT_PROMPT, cache_control: { type: 'ephemeral' } }])

    let tagSystem: unknown
    await new ClaudeApiTagger({
      agent,
      messages: {
        async parse(p) {
          tagSystem = p.system
          return { stop_reason: 'end_turn', parsed_output: { name: 'Tee', category: 'tops', colors: [], seasons: [], occasions: [] } }
        },
      },
    }).suggestDetails({ bytes: PNG, mimeType: 'image/png', path: null })
    expect(tagSystem).toEqual([{ type: 'text', text: STYLIST_AGENT_PROMPT, cache_control: { type: 'ephemeral' } }])
  })
})
