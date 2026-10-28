import type { StyleAdvisor, StyleAdvisorRequest, StyleCallOptions, StyleSuggestion } from '#shared/contracts/StyleAdvisor'
import { cliJsonSchema, runClaudeCli, type ClaudeCliOptions } from './claudeCli'
import { styleProgressReporter } from './styleProgress'
import { AiSuggestionSchema, buildStyleMessage, STYLE_SYSTEM_PROMPT, toSuggestion } from './stylePrompt'

const JSON_SCHEMA = cliJsonSchema(AiSuggestionSchema)

/** Styles and rates looks through the local Claude Code CLI (`claude -p`), using the user's own login. */
export class ClaudeCliStyleAdvisor implements StyleAdvisor {
  constructor(private readonly options: ClaudeCliOptions) {}

  async suggestLook(request: StyleAdvisorRequest, { signal, onProgress }: StyleCallOptions = {}): Promise<StyleSuggestion> {
    const ai = await runClaudeCli(this.options, {
      system: STYLE_SYSTEM_PROMPT,
      prompt: buildStyleMessage(request),
      schema: AiSuggestionSchema,
      jsonSchema: JSON_SCHEMA,
      signal,
      onPartial: onProgress && styleProgressReporter(request, onProgress),
    })
    return toSuggestion(ai, request)
  }
}
