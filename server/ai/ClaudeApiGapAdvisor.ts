import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { GapAdvisor, GapAdvisorRequest, GapCallOptions } from '#shared/contracts/GapAdvisor'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import type { GapSuggestion } from '#shared/models/gap'
import { agentSystem, DEFAULT_MODEL, type Effort, type StructuredMessages } from './ClaudeApiStyleAdvisor'
import { AiGapsSchema, buildGapMessage, toGapSuggestions, type AiGaps } from './gapPrompt'

/** Finds what the wardrobe is missing through the Anthropic API, as the stylist agent. */
export class ClaudeApiGapAdvisor implements GapAdvisor {
  constructor(private readonly options: { messages: StructuredMessages; model?: string; effort?: Effort; agent?: StylistAgent }) {}

  async suggestGaps(request: GapAdvisorRequest, { signal }: GapCallOptions = {}): Promise<GapSuggestion[]> {
    signal?.throwIfAborted()
    let response
    try {
      response = await this.options.messages.parse(
        {
          model: this.options.model ?? DEFAULT_MODEL,
          max_tokens: 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: agentSystem(this.options.agent),
          messages: [{ role: 'user', content: buildGapMessage(request) }],
          output_config: { format: betaZodOutputFormat(AiGapsSchema), effort: this.options.effort ?? 'medium' },
        },
        { signal },
      )
    } catch (e) {
      // The SDK's own abort error becomes the caller's AbortError.
      signal?.throwIfAborted()
      throw e
    }
    if (response.stop_reason === 'refusal') throw new Error('Claude declined to look through this wardrobe.')
    if (!response.parsed_output) throw new Error('Claude returned an answer in an unexpected shape.')
    return toGapSuggestions(response.parsed_output as AiGaps, request)
  }
}
