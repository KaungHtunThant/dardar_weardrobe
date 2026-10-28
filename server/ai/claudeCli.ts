import { dirname } from 'node:path'
import { z } from 'zod'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { BUILT_IN_STYLIST } from './agent/builtInStylist'
import { parsePartialJson } from './partialJson'
import type { ProcessRunner } from './process'

export interface ClaudeCliOptions {
  runner: ProcessRunner
  /** Executable name or path. */
  command?: string
  /** Model alias or id; omitted = the CLI's own default. */
  model?: string
  /** The stylist agent the call runs as (defaults to the built-in persona). */
  agent?: StylistAgent
}

interface CliResult {
  type?: string
  is_error?: boolean
  result?: string
  structured_output?: unknown
}

/** JSON Schema for the CLI's --json-schema: draft-7 style, without a `$schema` URI its validator doesn't know. */
export function cliJsonSchema(schema: z.ZodType): object {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>
  return rest
}

interface StreamLine {
  type?: string
  event?: {
    type?: string
    index?: number
    content_block?: { type?: string; name?: string }
    delta?: { type?: string; partial_json?: string }
  }
}

/** The CLI delivers --json-schema output as the input of this tool call. */
const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput'

/**
 * Reads `--output-format stream-json --include-partial-messages` as it arrives and reports the
 * structured output parsed so far each time a piece of it streams in.
 */
function structuredOutputStream(onPartial: (partial: unknown) => void) {
  let pending = ''
  let blockIndex: number | undefined
  let json = ''
  const line = (text: string) => {
    let msg: StreamLine
    try {
      msg = JSON.parse(text) as StreamLine
    } catch {
      return
    }
    const e = msg.type === 'stream_event' ? msg.event : undefined
    if (e?.type === 'content_block_start' && e.content_block?.type === 'tool_use' && e.content_block.name === STRUCTURED_OUTPUT_TOOL) {
      blockIndex = e.index
      json = ''
    } else if (e?.type === 'content_block_delta' && e.index === blockIndex && e.delta?.type === 'input_json_delta') {
      json += e.delta.partial_json ?? ''
      const partial = parsePartialJson(json)
      if (partial !== undefined) onPartial(partial)
    }
  }
  return (chunk: string) => {
    pending += chunk
    let nl
    while ((nl = pending.indexOf('\n')) >= 0) {
      line(pending.slice(0, nl))
      pending = pending.slice(nl + 1)
    }
  }
}

/** The final `result` message of a stream-json run. */
function lastResult(stdout: string): CliResult {
  const lines = stdout.trim().split('\n').reverse()
  for (const l of lines) {
    try {
      const msg = JSON.parse(l) as CliResult
      if (msg.type === 'result') return msg
    } catch {
      // not a complete JSON line
    }
  }
  throw new Error('Claude CLI ended without a result.')
}

/**
 * Runs `claude -p` once, as the stylist agent, with a JSON schema and returns the validated structured output.
 * With an agents file the CLI runs `--agent` from it, inside the agent's folder; otherwise the persona is the system prompt.
 * The prompt goes over stdin; tools are off unless explicitly allowed.
 * With `onPartial`, the answer is streamed and reported as it is written; `signal` kills the process.
 */
export async function runClaudeCli<S extends z.ZodType>(
  options: ClaudeCliOptions,
  call: {
    prompt: string
    schema: S
    jsonSchema: object
    tools?: string[]
    addDirs?: string[]
    signal?: AbortSignal
    onPartial?: (partial: unknown) => void
  },
): Promise<z.output<S>> {
  const command = options.command ?? 'claude'
  const streaming = !!call.onPartial
  const agent = options.agent ?? BUILT_IN_STYLIST
  const agentsFile = agent.cliAgentsFile()
  const args = [
    '-p',
    '--output-format', streaming ? 'stream-json' : 'json',
    ...(streaming ? ['--verbose', '--include-partial-messages'] : []),
    '--json-schema', JSON.stringify(call.jsonSchema),
    ...(agentsFile ? ['--agents', agentsFile, '--agent', agent.name] : ['--system-prompt', agent.systemPrompt()]),
    '--tools', (call.tools ?? []).join(','),
    '--no-session-persistence',
  ]
  if (call.tools?.length) args.push('--allowedTools', ...call.tools)
  for (const dir of call.addDirs ?? []) args.push('--add-dir', dir)
  if (options.model) args.push('--model', options.model)

  let out
  try {
    out = await options.runner(command, args, {
      input: call.prompt,
      cwd: agentsFile ? dirname(agentsFile) : undefined,
      signal: call.signal,
      onStdout: call.onPartial ? structuredOutputStream(call.onPartial) : undefined,
    })
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT')
      throw new Error("The Claude CLI isn't installed (or not on PATH). Install Claude Code, or switch to API or Offline in Settings.", { cause: e })
    throw e
  }
  if (out.code !== 0) throw new Error(`Claude CLI failed: ${(out.stderr || out.stdout).trim().slice(0, 300) || `exit code ${out.code}`}`)

  let result: CliResult
  try {
    result = streaming ? lastResult(out.stdout) : (JSON.parse(out.stdout) as CliResult)
  } catch (e) {
    throw new Error('Claude CLI returned something that is not JSON.', { cause: e })
  }
  if (result.is_error) throw new Error(`Claude CLI: ${String(result.result ?? 'unknown error').slice(0, 300)}`)
  const raw = result.structured_output ?? (result.result ? JSON.parse(result.result) : undefined)
  const parsed = call.schema.safeParse(raw)
  if (!parsed.success) throw new Error('Claude CLI returned an answer in an unexpected shape.')
  return parsed.data
}

/** `claude --version`, or null when the CLI isn't available. */
export async function claudeCliVersion(runner: ProcessRunner, command = 'claude'): Promise<string | null> {
  try {
    const out = await runner(command, ['--version'], { timeoutMs: 10_000 })
    return out.code === 0 ? out.stdout.trim().split(/\s+/)[0] ?? null : null
  } catch {
    return null
  }
}
