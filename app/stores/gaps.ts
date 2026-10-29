import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { GapReport } from '#shared/models/gap'
import { useGateway } from '~/gateways/provider'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** What the wardrobe is missing, according to the stylist. */
export const useGapsStore = defineStore('gaps', () => {
  const report = ref<GapReport | null>(null)
  /** The first answer is on its way (the backend may be asking Claude). */
  const loading = ref(false)
  /** The user asked the stylist again. */
  const refreshing = ref(false)
  const error = ref<string | null>(null)

  async function fetch(call: () => Promise<GapReport | null>, busy: typeof loading) {
    busy.value = true
    error.value = null
    try {
      report.value = await call()
    } catch (e) {
      error.value = message(e)
    } finally {
      busy.value = false
    }
  }

  /** The kept report, or a new one when the wardrobe has changed. */
  function load() {
    return fetch(() => useGateway().getWardrobeGaps(), loading)
  }

  function refresh() {
    return fetch(() => useGateway().refreshWardrobeGaps(), refreshing)
  }

  /** After the wardrobe is cleared. */
  function forget() {
    report.value = null
    error.value = null
  }

  return { report, loading, refreshing, error, load, refresh, forget }
})
