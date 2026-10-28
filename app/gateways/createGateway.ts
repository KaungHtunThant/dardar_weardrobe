import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { HttpWardrobeGateway } from './HttpWardrobeGateway'
import { MockWardrobeGateway } from './MockWardrobeGateway'
import { IndexedDbSnapshotStore } from './persistence/IndexedDbSnapshotStore'

export type GatewayKind = 'http' | 'mock'

/** Composition root for the client: the only place that knows concrete gateway classes. */
export function createGateway(kind: GatewayKind): WardrobeGateway {
  switch (kind) {
    case 'http':
      return new HttpWardrobeGateway()
    case 'mock':
      return new MockWardrobeGateway(new IndexedDbSnapshotStore(), {
        seed: { items: seedItems, styleMatches: seedStyleMatches },
        latencyMs: 250,
      })
  }
}
