import { setActivePinia, type Pinia } from 'pinia'
import { useNuxtApp } from '#imports'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { MockWardrobeGateway } from '~/gateways/MockWardrobeGateway'
import { InMemorySnapshotStore } from '~/gateways/persistence/InMemorySnapshotStore'
import { provideGateway } from '~/gateways/provider'

/** Disposes every store on the Nuxt test app's Pinia so each test starts clean. */
function resetPinia(): Pinia {
  const pinia = useNuxtApp().$pinia as Pinia & { _s: Map<string, { $dispose(): void }> }
  pinia._s.forEach((store) => store.$dispose())
  pinia._s.clear()
  pinia.state.value = {}
  setActivePinia(pinia)
  return pinia
}

/** Clean Pinia + an instant in-memory gateway seeded with the prototype data. */
export function setupTestGateway(seed = { items: structuredClone(seedItems), styleMatches: structuredClone(seedStyleMatches) }) {
  resetPinia()
  const gateway = new MockWardrobeGateway(new InMemorySnapshotStore(), { seed, latencyMs: 0 })
  provideGateway(gateway)
  return gateway
}
