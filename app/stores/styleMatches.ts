import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { StyleRequestInput } from '#shared/models/styleRequest'
import { favouriteLooks, recentLooks, todaysPick } from '#shared/utils/looks'
import { useGateway } from '~/gateways/provider'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useStyleMatchesStore = defineStore('styleMatches', () => {
  const looks = ref<StyleMatch[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const generating = ref(false)
  const todayId = ref<string | null>(null)
  const todayLoading = ref(false)
  const generateError = ref<string | null>(null)
  let inFlight: Promise<void> | null = null

  const favourites = computed(() => favouriteLooks(looks.value))
  const todayLook = computed(() => (todayId.value ? (looks.value.find((l) => l.id === todayId.value) ?? null) : null))

  function recent(limit: number) {
    return recentLooks(looks.value, limit)
  }

  function byId(id: string) {
    return looks.value.find((l) => l.id === id) ?? null
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

  /** Asks for today's recommendation (the backend styles one per day if needed). */
  async function loadToday(date: string) {
    todayLoading.value = true
    try {
      const look = await useGateway().getTodayLook(date)
      if (look && !looks.value.some((l) => l.id === look.id)) looks.value = [...looks.value, look]
      todayId.value = look?.id ?? null
    } catch (e) {
      error.value = message(e)
    } finally {
      todayLoading.value = false
    }
  }

  async function generate(request: StyleRequestInput): Promise<StyleMatch | null> {
    generating.value = true
    generateError.value = null
    try {
      const look = await useGateway().generateLook(request)
      looks.value = [...looks.value, look]
      return look
    } catch (e) {
      generateError.value = message(e)
      return null
    } finally {
      generating.value = false
    }
  }

  return {
    looks,
    favourites,
    loaded,
    loading,
    error,
    generating,
    generateError,
    todayLook,
    todayLoading,
    recent,
    byId,
    pickFor,
    load,
    toggleFavourite,
    loadToday,
    generate,
  }
})
