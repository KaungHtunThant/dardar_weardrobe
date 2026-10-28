import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { MockWardrobeGateway } from './MockWardrobeGateway'
import { IndexedDbSnapshotStore } from './persistence/IndexedDbSnapshotStore'

export type GatewayKind = 'mock'

/** Composition root for the client: the only place that knows concrete gateway classes. */
export function createGateway(kind: GatewayKind): WardrobeGateway {
  switch (kind) {
    case 'mock':
      return new MockWardrobeGateway(new IndexedDbSnapshotStore(), {
        seed: { items: seedItems, styleMatches: seedStyleMatches },
        latencyMs: 250,
      })
  }
}
