/** The one fashion-advisor agent every Claude call runs as (styling, describing and finding garments). */
export interface StylistAgent {
  /** The agent's id, e.g. for `claude --agent <name>`. */
  readonly name: string
  /** Its persona and task playbooks; byte-stable so the API can cache it. */
  systemPrompt(): string
  /** The Claude CLI agents file (`claude --agents <file>`), or null when it hasn't been set up on disk. */
  cliAgentsFile(): string | null
}
