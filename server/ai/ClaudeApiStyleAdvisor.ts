import type Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { StyleAdvisor, StyleAdvisorRequest, StyleSuggestion } from '#shared/contracts/StyleAdvisor'
import { AiSuggestionSchema, buildStyleMessage, STYLE_SYSTEM_PROMPT, toSuggestion, type AiSuggestion } from './stylePrompt'

export const DEFAULT_MODEL = 'claude-opus-5-5'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

type ParseParams = Parameters<Anthropic['beta']['messages']['parse']>[0]

/** The slice of the SDK this advisor uses (`client.beta.messages`), so tests can pass a fake. */
export interface StructuredMessages {
  parse(params: ParseParams): Promise<{ stop_reason: string | null; parsed_output: unknown }>
}

/** Styles and rates looks through the Anthropic API with structured JSON output. */
export class ClaudeApiStyleAdvisor implements StyleAdvisor {
  constructor(private readonly options: { messages: StructuredMessages; model?: string; effort?: Effort }) {}

  async suggestLook(request: StyleAdvisorRequest): Promise<StyleSuggestion> {
    const response = await this.options.messages.parse({
      model: this.options.model ?? DEFAULT_MODEL,
      max_tokens: 16000,
      // If a safety classifier declines, the API retries on a suitable fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: STYLE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildStyleMessage(request) }],
      output_config: { format: betaZodOutputFormat(AiSuggestionSchema), effort: this.options.effort ?? 'medium' },
    })
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to style this look.')
    if (!response.parsed_output) throw new Error('Claude returned an answer in an unexpected shape.')
    return toSuggestion(response.parsed_output as AiSuggestion, request)
  }
}
