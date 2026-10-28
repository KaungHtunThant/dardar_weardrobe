import { dirname } from 'node:path'
import type { DetailsSuggestion, GarmentImage, GarmentTagger } from '#shared/contracts/GarmentTagger'
import { cliJsonSchema, runClaudeCli, type ClaudeCliOptions } from './claudeCli'
import { TAG_INSTRUCTIONS, TagSchema, toDetailsSuggestion } from './tagPrompt'

const JSON_SCHEMA = cliJsonSchema(TagSchema)

/** Suggests garment details via the Claude CLI, which may read only the image's folder. */
export class ClaudeCliTagger implements GarmentTagger {
  constructor(private readonly options: ClaudeCliOptions) {}

  async suggestDetails(image: GarmentImage): Promise<DetailsSuggestion> {
    if (!image.path || image.mimeType === 'image/svg+xml') return {}
    const out = await runClaudeCli(this.options, {
      prompt: `Read the garment photo at ${image.path} and look at it.\n\n${TAG_INSTRUCTIONS}`,
      schema: TagSchema,
      jsonSchema: JSON_SCHEMA,
      tools: ['Read'],
      addDirs: [dirname(image.path)],
    })
    return toDetailsSuggestion(out)
  }
}
