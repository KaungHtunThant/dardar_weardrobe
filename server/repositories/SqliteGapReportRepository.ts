import { eq } from 'drizzle-orm'
import type { GapReportRepository } from '#shared/contracts/GapReportRepository'
import type { GapReport } from '#shared/models/gap'
import type { Db } from '../database/connection'
import { gapReports } from '../database/schema'

const CURRENT = 'current'

export class SqliteGapReportRepository implements GapReportRepository {
  constructor(private readonly db: Db) {}

  async current() {
    const row = await this.db.select().from(gapReports).where(eq(gapReports.id, CURRENT)).get()
    return row?.report ?? null
  }

  async save(report: GapReport) {
    await this.db
      .insert(gapReports)
      .values({ id: CURRENT, report })
      .onConflictDoUpdate({ target: gapReports.id, set: { report } })
    return report
  }
}
