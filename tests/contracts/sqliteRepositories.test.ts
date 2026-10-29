import { describe, expect, it } from 'vitest'
import { openDatabase } from '../../server/database/connection'
import { SqliteGapReportRepository } from '../../server/repositories/SqliteGapReportRepository'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { SqliteUploadRepository } from '../../server/repositories/SqliteUploadRepository'
import { gapReportRepositoryContract, itemRepositoryContract, styleMatchRepositoryContract, uploadRepositoryContract } from './repositories.contract'

itemRepositoryContract('SqliteItemRepository', () => new SqliteItemRepository(openDatabase(':memory:').db))
styleMatchRepositoryContract('SqliteStyleMatchRepository', () => new SqliteStyleMatchRepository(openDatabase(':memory:').db))
uploadRepositoryContract('SqliteUploadRepository', () => new SqliteUploadRepository(openDatabase(':memory:').db))
gapReportRepositoryContract('SqliteGapReportRepository', () => new SqliteGapReportRepository(openDatabase(':memory:').db))

describe('database', () => {
  it('migrates once and records the schema version', () => {
    const { sqlite } = openDatabase(':memory:')
    const version = sqlite.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(version.user_version).toBeGreaterThan(0)
  })

  it('clears every table, the missing-pieces report included', async () => {
    const database = openDatabase(':memory:')
    const reports = new SqliteGapReportRepository(database.db)
    await reports.save({ gaps: [], wardrobeKey: 'k', place: null, by: 'offline', createdAt: '2026-10-30T08:00:00.000Z' })
    database.clear()
    expect(await reports.current()).toBeNull()
  })
})

describe('database file', () => {
  it('creates missing parent folders', async () => {
    const { mkdtempSync, rmSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const dir = mkdtempSync(join(tmpdir(), 'dardar-db-'))
    const path = join(dir, 'nested', 'dardar.db')
    openDatabase(path).close()
    expect(existsSync(path)).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})
