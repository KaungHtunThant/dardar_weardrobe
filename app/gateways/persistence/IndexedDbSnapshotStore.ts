import { openDB, type IDBPDatabase } from 'idb'
import type { SnapshotStore, WardrobeSnapshot } from './SnapshotStore'

const STORE = 'snapshot'
const KEY = 'current'

/** Persists the prototype wardrobe in the browser so it survives reloads. */
export class IndexedDbSnapshotStore implements SnapshotStore {
  private db: Promise<IDBPDatabase> | null = null

  constructor(private readonly dbName = 'dardar-wardrobe') {}

  private open() {
    this.db ??= openDB(this.dbName, 1, {
      upgrade(db) {
        db.createObjectStore(STORE)
      },
    })
    return this.db
  }

  async load() {
    return ((await (await this.open()).get(STORE, KEY)) as WardrobeSnapshot | undefined) ?? null
  }

  async save(snapshot: WardrobeSnapshot) {
    await (await this.open()).put(STORE, structuredClone(snapshot), KEY)
  }
}
