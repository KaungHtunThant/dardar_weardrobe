import type { GapReport } from '../models/gap'

/** Keeps the latest "what your wardrobe is missing" report. */
export interface GapReportRepository {
  current(): Promise<GapReport | null>
  /** Replaces the previous report. */
  save(report: GapReport): Promise<GapReport>
}
