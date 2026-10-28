import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { cliJsonSchema, runClaudeCli } from '../../server/ai/claudeCli'
import type { ProcessOptions, ProcessRunner } from '../../server/ai/process'

/** Recorded from `claude -p --output-format stream-json --verbose --include-partial-messages --json-schema …` (CLI 2.1.312). */
const recorded = readFileSync(new URL('../fixtures/cli-stream-json.jsonl', import.meta.url), 'utf8')

const schema = z.object({ title: z.string(), itemIds: z.array(z.string()), verdict: z.string() })
const call = { system: 'sys', prompt: 'style it', schema, jsonSchema: cliJsonSchema(schema) }

/** Replays the recording through onStdout in odd-sized chunks, so lines arrive split. */
function replay(stdout = recorded, seen: { args?: string[]; options?: ProcessOptions } = {}): ProcessRunner {
  return async (_cmd, args, options) => {
    seen.args = args
    seen.options = options
    for (let i = 0; i < stdout.length; i += 97) options.onStdout?.(stdout.slice(i, i + 97))
    return { code: 0, stdout, stderr: '' }
  }
}

describe('runClaudeCli in stream mode', () => {
  it('asks for stream-json with partial messages', async () => {
    const seen: { args?: string[] } = {}
    await runClaudeCli({ runner: replay(recorded, seen) }, { ...call, onPartial: () => {} })
    expect(seen.args).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--verbose', '--include-partial-messages']))
  })

  it('reports the structured output as it is written, then returns the validated result', async () => {
    const partials: unknown[] = []
    const result = await runClaudeCli({ runner: replay() }, { ...call, onPartial: (p) => partials.push(p) })

    expect(result.itemIds).toEqual(['a', 'b', 'c'])
    expect(result.verdict).toMatch(/^This is a clean, versatile everyday outfit/)
    expect(partials.length).toBeGreaterThan(10)
    expect(partials[0]).toEqual({ title: 'Class' })
    // `["a` arrives before its closing quote: the list shows up empty, never with half an id
    expect(partials).toContainEqual({ title: 'Classic Casual: White Tee, Jeans, Sneakers', itemIds: [] })
    for (const p of partials) expect(['a', 'b', 'c']).toEqual(expect.arrayContaining((p as { itemIds?: string[] }).itemIds ?? []))
    expect(partials.at(-1)).toEqual(result)
  })

  it('passes the abort signal to the process', async () => {
    const seen: { options?: ProcessOptions } = {}
    const signal = new AbortController().signal
    await runClaudeCli({ runner: replay(recorded, seen) }, { ...call, signal, onPartial: () => {} })
    expect(seen.options!.signal).toBe(signal)
  })

  it('still reports a failed result line', async () => {
    const failed = `${JSON.stringify({ type: 'system', subtype: 'init' })}\n${JSON.stringify({ type: 'result', is_error: true, result: 'Usage limit reached' })}\n`
    await expect(runClaudeCli({ runner: replay(failed) }, { ...call, onPartial: () => {} })).rejects.toThrow(/Usage limit reached/)
  })
})
