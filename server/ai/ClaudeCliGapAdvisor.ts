import type { GapAdvisor, GapAdvisorRequest, GapCallOptions } from '#shared/contracts/GapAdvisor'
import type { GapSuggestion } from '#shared/models/gap'
import { cliJsonSchema, runClaudeCli, type ClaudeCliOptions } from './claudeCli'
import { AiGapsSchema, buildGapMessage, toGapSuggestions } from './gapPrompt'

const JSON_SCHEMA = cliJsonSchema(AiGapsSchema)

/** Finds what the wardrobe is missing through the local Claude Code CLI, as the stylist agent. */
export class ClaudeCliGapAdvisor implements GapAdvisor {
  constructor(private readonly options: ClaudeCliOptions) {}

  async suggestGaps(request: GapAdvisorRequest, { signal }: GapCallOptions = {}): Promise<GapSuggestion[]> {
    const ai = await runClaudeCli(this.options, { prompt: buildGapMessage(request), schema: AiGapsSchema, jsonSchema: JSON_SCHEMA, signal })
    return toGapSuggestions(ai, request)
  }
}
