import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { StyleMatch } from '#shared/models/styleMatch'
import { favouriteLooks, recentLooks, todaysPick } from '#shared/utils/looks'
import { useGateway } from '~/gateways/provider'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useStyleMatchesStore = defineStore('styleMatches', () => {
  const looks = ref<StyleMatch[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let inFlight: Promise<void> | null = null

  const favourites = computed(() => favouriteLooks(looks.value))

  function recent(limit: number) {
    return recentLooks(looks.value, limit)
  }

  function pickFor(date: string) {
    return todaysPick(looks.value, date)
  }

  function load() {
    if (loaded.value) return Promise.resolve()
    inFlight ??= (async () => {
      loading.value = true
      error.value = null
      try {
        looks.value = await useGateway().listStyleMatches()
        loaded.value = true
      } catch (e) {
        error.value = message(e)
      } finally {
        loading.value = false
        inFlight = null
      }
    })()
    return inFlight
  }

  async function toggleFavourite(id: string) {
    const look = looks.value.find((l) => l.id === id)
    if (!look) return
    const next = !look.isFavourite
    look.isFavourite = next
    try {
      await useGateway().setFavourite(id, next)
    } catch (e) {
      look.isFavourite = !next
      error.value = message(e)
    }
  }

  return { looks, favourites, loaded, loading, error, recent, pickFor, load, toggleFavourite }
})
