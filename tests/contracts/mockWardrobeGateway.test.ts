import { describe, expect, it } from 'vitest'
import { MockWardrobeGateway } from '~/gateways/MockWardrobeGateway'
import { InMemorySnapshotStore } from '~/gateways/persistence/InMemorySnapshotStore'
import { IndexedDbSnapshotStore } from '~/gateways/persistence/IndexedDbSnapshotStore'
import { wardrobeGatewayContract } from './wardrobeGateway.contract'

wardrobeGatewayContract('MockWardrobeGateway (memory)', async (seed) =>
  new MockWardrobeGateway(new InMemorySnapshotStore(), { seed, latencyMs: 0 }),
)

let dbCounter = 0
wardrobeGatewayContract('MockWardrobeGateway (IndexedDB)', async (seed) =>
  new MockWardrobeGateway(new IndexedDbSnapshotStore(`contract-${dbCounter++}`), { seed, latencyMs: 0 }),
)

describe('MockWardrobeGateway persistence', () => {
  const seed = { items: [], styleMatches: [] }
  const photo = new Blob(['x'], { type: 'image/png' })

  it('keeps created items across instances sharing a store', async () => {
    const store = new IndexedDbSnapshotStore('persist-test')
    const first = new MockWardrobeGateway(store, { seed, latencyMs: 0 })
    const processed = await first.removeBackground(photo)
    const created = await first.createItem({ name: 'Beret', category: 'accessories', ...processed })

    const second = new MockWardrobeGateway(store, { seed, latencyMs: 0 })
    expect((await second.listItems()).map((i) => i.id)).toEqual([created.id])
  })

  it('returns the photo as a data URL so the UI can preview it', async () => {
    const gw = new MockWardrobeGateway(new InMemorySnapshotStore(), { seed, latencyMs: 0 })
    const { cleanImage } = await gw.removeBackground(photo)
    expect(cleanImage).toBe('data:image/png;base64,eA==')
  })

  it('uses the injected clock and id generator', async () => {
    const gw = new MockWardrobeGateway(new InMemorySnapshotStore(), {
      seed,
      latencyMs: 0,
      now: () => new Date('2026-10-28T12:00:00.000Z'),
      newId: () => 'fixed',
    })
    const item = await gw.createItem({ name: 'Tee', category: 'tops', originalImage: 'a', cleanImage: 'b' })
    expect(item.id).toBe('item-fixed')
    expect(item.createdAt).toBe('2026-10-28T12:00:00.000Z')
  })
})
