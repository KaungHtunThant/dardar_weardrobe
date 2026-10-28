import type { SnapshotStore, WardrobeSnapshot } from './SnapshotStore'

export class InMemorySnapshotStore implements SnapshotStore {
  private snapshot: WardrobeSnapshot | null = null

  async load() {
    return this.snapshot ? structuredClone(this.snapshot) : null
  }

  async save(snapshot: WardrobeSnapshot) {
    this.snapshot = structuredClone(snapshot)
  }
}
