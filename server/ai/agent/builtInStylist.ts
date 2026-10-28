import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { STYLIST_AGENT_NAME, STYLIST_AGENT_PROMPT } from './stylistPrompt'

/** The stylist without a file on disk: the CLI gets the persona as its system prompt. */
export const BUILT_IN_STYLIST: StylistAgent = {
  name: STYLIST_AGENT_NAME,
  systemPrompt: () => STYLIST_AGENT_PROMPT,
  cliAgentsFile: () => null,
}
