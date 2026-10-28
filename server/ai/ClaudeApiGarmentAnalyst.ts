import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { NO_ANALYSIS, type GarmentAnalysis, type GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { GarmentImage } from '#shared/contracts/GarmentTagger'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { ANALYZE_INSTRUCTIONS, AnalysisSchema, toGarmentAnalysis, type AnalysisOutput } from './analyzePrompt'
import { agentSystem, DEFAULT_MODEL, type StructuredMessages } from './ClaudeApiStyleAdvisor'

const VISION_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
type VisionType = (typeof VISION_TYPES)[number]

/** Finds and describes the garment in a photo with Claude vision (Anthropic API), as the stylist. */
export class ClaudeApiGarmentAnalyst implements GarmentAnalyst {
  constructor(private readonly options: { messages: StructuredMessages; model?: string; agent?: StylistAgent }) {}

  async analyze(image: GarmentImage, { signal }: { signal?: AbortSignal } = {}): Promise<GarmentAnalysis> {
    signal?.throwIfAborted()
    if (!VISION_TYPES.includes(image.mimeType as VisionType)) return NO_ANALYSIS
    const response = await this.options.messages.parse(
      {
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
              { type: 'text', text: ANALYZE_INSTRUCTIONS },
            ],
          },
        ],
        output_config: { format: betaZodOutputFormat(AnalysisSchema), effort: 'low' },
      },
      { signal },
    )
    if (response.stop_reason === 'refusal' || !response.parsed_output) return NO_ANALYSIS
    return toGarmentAnalysis(response.parsed_output as AnalysisOutput)
  }
}
