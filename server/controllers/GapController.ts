import type { GapService } from '../services/GapService'

/** "What your wardrobe is missing"; wrapped so "nothing to report" is a plain JSON null. */
export class GapController {
  constructor(private readonly gaps: GapService) {}

  async show() {
    return { report: await this.gaps.current() }
  }

  async refresh() {
    return { report: await this.gaps.refresh() }
  }
}
