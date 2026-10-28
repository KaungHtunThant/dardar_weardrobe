import { dirname } from 'node:path'
import { NO_ANALYSIS, type GarmentAnalysis, type GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'
import type { GarmentImage } from '#shared/contracts/GarmentTagger'
import { ANALYZE_INSTRUCTIONS, AnalysisSchema, toGarmentAnalysis } from './analyzePrompt'
import { cliJsonSchema, runClaudeCli, type ClaudeCliOptions } from './claudeCli'

const JSON_SCHEMA = cliJsonSchema(AnalysisSchema)

/** Finds and describes the garment in a photo via the Claude CLI (as the stylist), which may read only the photo's folder. */
export class ClaudeCliGarmentAnalyst implements GarmentAnalyst {
  constructor(private readonly options: ClaudeCliOptions) {}

  async analyze(image: GarmentImage, { signal }: { signal?: AbortSignal } = {}): Promise<GarmentAnalysis> {
    signal?.throwIfAborted()
    if (!image.path || image.mimeType === 'image/svg+xml') return NO_ANALYSIS
    const out = await runClaudeCli(this.options, {
      prompt: `Read the photo at ${image.path} and look at it.\n\n${ANALYZE_INSTRUCTIONS}`,
      schema: AnalysisSchema,
      jsonSchema: JSON_SCHEMA,
      tools: ['Read'],
      addDirs: [dirname(image.path)],
      signal,
    })
    return toGarmentAnalysis(out)
  }
}
