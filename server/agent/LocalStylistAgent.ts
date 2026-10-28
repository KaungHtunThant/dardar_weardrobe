import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StylistAgent } from '#shared/contracts/StylistAgent'
import { StylistAgentInfoSchema, type StylistAgentInfo } from '#shared/models/agent'
import {
  STYLIST_AGENT_DESCRIPTION,
  STYLIST_AGENT_DISPLAY_NAME,
  STYLIST_AGENT_NAME,
  STYLIST_AGENT_PROMPT,
  STYLIST_AGENT_VERSION,
} from '../ai/agent/stylistPrompt'
import type { Clock } from '../services/clock'

/**
 * The stylist agent, set up in the app's data folder on first launch:
 * `agents.json` is a Claude CLI agents file (`claude --agents <file> --agent dardar-stylist`),
 * `agent.json` records when it was made and from which version of the prompt.
 */
export class LocalStylistAgent implements StylistAgent {
  readonly name = STYLIST_AGENT_NAME

  constructor(
    private readonly dir: string,
    private readonly clock: Clock,
  ) {}

  private get agentsFile() {
    return join(this.dir, 'agents.json')
  }

  private get infoFile() {
    return join(this.dir, 'agent.json')
  }

  systemPrompt() {
    return STYLIST_AGENT_PROMPT
  }

  cliAgentsFile() {
    return existsSync(this.agentsFile) ? this.agentsFile : null
  }

  info(): StylistAgentInfo | null {
    try {
      return StylistAgentInfoSchema.parse(JSON.parse(readFileSync(this.infoFile, 'utf8')))
    } catch {
      return null
    }
  }

  /** Creates the agent if it doesn't exist yet, and refreshes it when the app ships a newer prompt. */
  ensure(): StylistAgentInfo {
    const current = this.info()
    if (current && current.version === STYLIST_AGENT_VERSION && this.cliAgentsFile()) return current
    return this.write(current?.createdAt ?? this.clock.now().toISOString())
  }

  /** Sets the agent up again from scratch. */
  recreate(): StylistAgentInfo {
    return this.write(this.clock.now().toISOString())
  }

  private write(createdAt: string): StylistAgentInfo {
    mkdirSync(this.dir, { recursive: true })
    const agents = { [STYLIST_AGENT_NAME]: { description: STYLIST_AGENT_DESCRIPTION, prompt: STYLIST_AGENT_PROMPT } }
    writeFileSync(this.agentsFile, JSON.stringify(agents, null, 2))
    const info: StylistAgentInfo = { name: STYLIST_AGENT_NAME, displayName: STYLIST_AGENT_DISPLAY_NAME, version: STYLIST_AGENT_VERSION, createdAt }
    writeFileSync(this.infoFile, JSON.stringify(info, null, 2))
    return info
  }
}
