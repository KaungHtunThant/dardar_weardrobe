import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { DetailsSuggestion, GarmentImage, GarmentTagger } from '#shared/contracts/GarmentTagger'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { agentSystem, DEFAULT_MODEL, type Effort, type StructuredMessages } from './ClaudeApiStyleAdvisor'
import { TAG_INSTRUCTIONS, TagSchema, toDetailsSuggestion, type TagOutput } from './tagPrompt'

const VISION_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type VisionType = (typeof VISION_TYPES)[number]

/** Suggests garment details from the photo with Claude vision (Anthropic API), as the stylist agent. */
export class ClaudeApiTagger implements GarmentTagger {
  constructor(private readonly options: { messages: StructuredMessages; model?: string; effort?: Effort; agent?: StylistAgent }) {}

  async suggestDetails(image: GarmentImage): Promise<DetailsSuggestion> {
    if (!VISION_TYPES.includes(image.mimeType as VisionType)) return {}
    const response = await this.options.messages.parse({
      model: this.options.model ?? DEFAULT_MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: agentSystem(this.options.agent),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType as VisionType, data: Buffer.from(image.bytes).toString('base64') } },
            { type: 'text', text: TAG_INSTRUCTIONS },
          ],
        },
      ],
      output_config: { format: betaZodOutputFormat(TagSchema), effort: 'low' },
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) return {}
    return toDetailsSuggestion(response.parsed_output as TagOutput)
  }
}
