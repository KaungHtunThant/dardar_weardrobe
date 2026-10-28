import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { StyleAdvisor, StyleAdvisorRequest, StyleCallOptions, StyleSuggestion } from '#shared/contracts/StyleAdvisor'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { BUILT_IN_STYLIST } from './agent/builtInStylist'
import { parsePartialJson } from './partialJson'
import { styleProgressReporter } from './styleProgress'
import { AiSuggestionSchema, buildStyleMessage, toSuggestion, type AiSuggestion } from './stylePrompt'

export const DEFAULT_MODEL = 'claude-opus-5-5'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

type ParseParams = Parameters<Anthropic['beta']['messages']['parse']>[0]
type StreamParams = Parameters<Anthropic['beta']['messages']['stream']>[0]
type StructuredResult = { stop_reason: string | null; parsed_output?: unknown }

/** The slice of the SDK the tagger uses (`client.beta.messages.parse`), so tests can pass a fake. */
export interface StructuredMessages {
  parse(params: ParseParams): Promise<StructuredResult>
}

/** The slice of the SDK the stylist uses (`client.beta.messages.stream`), so tests can pass a fake. */
export interface StreamingMessages {
  stream(
    params: StreamParams,
    options?: { signal?: AbortSignal },
  ): { on(event: 'text', listener: (delta: string, snapshot: string) => void): unknown; finalMessage(): Promise<StructuredResult> }
}

/** The stylist agent's persona as a cached system prompt. */
export function agentSystem(agent: StylistAgent = BUILT_IN_STYLIST) {
  return [{ type: 'text' as const, text: agent.systemPrompt(), cache_control: { type: 'ephemeral' as const } }]
}

/** Styles and rates looks through the Anthropic API as the stylist agent, with structured JSON output streamed so progress shows. */
export class ClaudeApiStyleAdvisor implements StyleAdvisor {
  constructor(private readonly options: { messages: StreamingMessages; model?: string; effort?: Effort; agent?: StylistAgent }) {}

  async suggestLook(request: StyleAdvisorRequest, { signal, onProgress }: StyleCallOptions = {}): Promise<StyleSuggestion> {
    signal?.throwIfAborted()
    const stream = this.options.messages.stream(
      {
        model: this.options.model ?? DEFAULT_MODEL,
        max_tokens: 16000,
        // If a safety classifier declines, the API retries on a suitable fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: agentSystem(this.options.agent),
        messages: [{ role: 'user', content: buildStyleMessage(request) }],
        output_config: { format: betaZodOutputFormat(AiSuggestionSchema), effort: this.options.effort ?? 'medium' },
      },
      { signal },
    )
    if (onProgress) {
      const report = styleProgressReporter(request, onProgress)
      stream.on('text', (_delta, snapshot) => report(parsePartialJson(snapshot)))
    }
    let response: StructuredResult
    try {
      response = await stream.finalMessage()
    } catch (e) {
      // The SDK's own abort error becomes the caller's AbortError.
      signal?.throwIfAborted()
      throw e
    }
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to style this look.')
    if (!response.parsed_output) throw new Error('Claude returned an answer in an unexpected shape.')
    return toSuggestion(response.parsed_output as AiSuggestion, request)
  }
}
