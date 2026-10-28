import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'

export interface WardrobeSnapshot {
  items: Item[]
  styleMatches: StyleMatch[]
}

/** Where the mock gateway keeps its data between sessions. */
export interface SnapshotStore {
  load(): Promise<WardrobeSnapshot | null>
  save(snapshot: WardrobeSnapshot): Promise<void>
}
