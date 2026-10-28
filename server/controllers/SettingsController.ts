import { readBody, type H3Event } from 'h3'
import type { SettingsService } from '../settings/SettingsService'

export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  show() {
    return this.settings.get()
  }

  async update(event: H3Event) {
    return this.settings.update(await readBody(event))
  }

  recreateAgent() {
    return this.settings.recreateAgent()
  }
}
