import { z } from 'zod'

/** The stylist agent set up on this device on first launch. */
export const StylistAgentInfoSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  /** Bumped by the app when the agent's prompt changes; an older agent is refreshed on start. */
  version: z.number().int(),
  createdAt: z.string(),
})
export type StylistAgentInfo = z.infer<typeof StylistAgentInfoSchema>
