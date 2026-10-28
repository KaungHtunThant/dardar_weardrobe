import { z } from 'zod'
import type { ProcessRunner } from './process'

export interface ClaudeCliOptions {
  runner: ProcessRunner
  /** Executable name or path. */
  command?: string
  /** Model alias or id; omitted = the CLI's own default. */
  model?: string
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

/**
 * Runs `claude -p` once with a JSON schema and returns the validated structured output.
 * The prompt goes over stdin; tools are off unless explicitly allowed.
 */
export async function runClaudeCli<S extends z.ZodType>(
  options: ClaudeCliOptions,
  call: { system: string; prompt: string; schema: S; jsonSchema: object; tools?: string[]; addDirs?: string[] },
): Promise<z.output<S>> {
  const command = options.command ?? 'claude'
  const args = [
    '-p',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(call.jsonSchema),
    '--system-prompt', call.system,
    '--tools', (call.tools ?? []).join(','),
    '--no-session-persistence',
  ]
  if (call.tools?.length) args.push('--allowedTools', ...call.tools)
  for (const dir of call.addDirs ?? []) args.push('--add-dir', dir)
  if (options.model) args.push('--model', options.model)

  let out
  try {
    out = await options.runner(command, args, { input: call.prompt })
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT')
      throw new Error("The Claude CLI isn't installed (or not on PATH). Install Claude Code, or switch to API or Offline in Settings.", { cause: e })
    throw e
  }
  if (out.code !== 0) throw new Error(`Claude CLI failed: ${(out.stderr || out.stdout).trim().slice(0, 300) || `exit code ${out.code}`}`)

  let result: CliResult
  try {
    result = JSON.parse(out.stdout) as CliResult
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
