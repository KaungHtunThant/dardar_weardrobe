import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'
import { migrate } from './migrations'
import * as schema from './schema'

export type Db = SqliteRemoteDatabase<typeof schema>

/**
 * SQLite via Node's built-in `node:sqlite` (no native modules, works inside Electron),
 * exposed to Drizzle through its sqlite-proxy driver.
 */
export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const sqlite = new DatabaseSync(path)
  if (path !== ':memory:') sqlite.exec('PRAGMA journal_mode = WAL')
  migrate(sqlite)

  const db: Db = drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql)
      if (method === 'run') {
        stmt.run(...(params as never[]))
        return { rows: [] }
      }
      stmt.setReturnArrays(true)
      if (method === 'get') return { rows: (stmt.get(...(params as never[])) ?? undefined) as unknown as unknown[] }
      return { rows: stmt.all(...(params as never[])) as unknown as unknown[] }
    },
    { schema },
  )

  /** Removes all rows (used by the test-only reset). */
  function clear() {
    sqlite.exec('DELETE FROM items; DELETE FROM style_matches; DELETE FROM uploads;')
  }

  return { db, sqlite, clear, close: () => sqlite.close() }
}
