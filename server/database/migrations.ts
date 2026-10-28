import type { DatabaseSync } from 'node:sqlite'

/** Ordered, append-only schema migrations; `PRAGMA user_version` records how many have run. */
const MIGRATIONS: string[] = [
  `CREATE TABLE items (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     original_image TEXT NOT NULL,
     clean_image TEXT NOT NULL,
     colors TEXT NOT NULL,
     brand TEXT,
     size TEXT,
     seasons TEXT NOT NULL,
     occasions TEXT NOT NULL,
     notes TEXT,
     is_favourite INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );
   CREATE INDEX items_category ON items (category);
   CREATE TABLE style_matches (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     item_ids TEXT NOT NULL,
     ai_item_ids TEXT,
     prompt TEXT,
     explanation TEXT NOT NULL,
     rating TEXT,
     is_favourite INTEGER NOT NULL DEFAULT 0,
     daily_pick_date TEXT,
     created_at TEXT NOT NULL
   );`,
]

export function migrate(sqlite: DatabaseSync) {
  const { user_version: current } = sqlite.prepare('PRAGMA user_version').get() as { user_version: number }
  for (let v = current; v < MIGRATIONS.length; v++) {
    sqlite.exec('BEGIN')
    try {
      sqlite.exec(MIGRATIONS[v]!)
      sqlite.exec(`PRAGMA user_version = ${v + 1}`)
      sqlite.exec('COMMIT')
    } catch (e) {
      sqlite.exec('ROLLBACK')
      throw e
    }
  }
}
