import { describe, expect, it } from 'vitest'
import { openDatabase } from '../../server/database/connection'
import { SqliteItemRepository } from '../../server/repositories/SqliteItemRepository'
import { SqliteStyleMatchRepository } from '../../server/repositories/SqliteStyleMatchRepository'
import { itemRepositoryContract, styleMatchRepositoryContract } from './repositories.contract'

itemRepositoryContract('SqliteItemRepository', () => new SqliteItemRepository(openDatabase(':memory:').db))
styleMatchRepositoryContract('SqliteStyleMatchRepository', () => new SqliteStyleMatchRepository(openDatabase(':memory:').db))

describe('database', () => {
  it('migrates once and records the schema version', () => {
    const { sqlite } = openDatabase(':memory:')
    const version = sqlite.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(version.user_version).toBeGreaterThan(0)
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
