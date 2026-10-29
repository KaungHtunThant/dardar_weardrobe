import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { StyleRequestInput } from '#shared/models/styleRequest'
import { favouriteLooks, recentLooks, todaysPick } from '#shared/utils/looks'
import { useGateway } from '~/gateways/provider'
import type { StyleProgress } from '#shared/contracts/StyleAdvisor'

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
  /** What the stylist has produced so far while generating. */
  const progress = ref<StyleProgress | null>(null)
  let styling: AbortController | null = null
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
      // A pick restyled for a new city replaces the old one: there is one per day.
      if (look && !looks.value.some((l) => l.id === look.id))
        looks.value = [...looks.value.filter((l) => l.dailyPickDate !== date), look]
      todayId.value = look?.id ?? null
    } catch (e) {
      error.value = message(e)
    } finally {
      todayLoading.value = false
    }
  }

  /** Fetches the looks again (e.g. after a piece was deleted). */
  function reload() {
    loaded.value = false
    return load()
  }

  async function deleteLook(id: string) {
    await useGateway().deleteLook(id)
    looks.value = looks.value.filter((l) => l.id !== id)
    if (todayId.value === id) todayId.value = null
  }

  /** After the wardrobe is cleared: no looks, no daily pick. */
  function forget() {
    looks.value = []
    loaded.value = true
    todayId.value = null
  }

  /** Styles a look, reporting progress; returns null on failure or when cancelled (which is not an error). */
  async function generate(request: StyleRequestInput): Promise<StyleMatch | null> {
    styling?.abort()
    const mine = new AbortController()
    styling = mine
    generating.value = true
    generateError.value = null
    progress.value = null
    try {
      const look = await useGateway().generateLook(request, {
        signal: mine.signal,
        onProgress: (p) => {
          if (styling === mine) progress.value = p
        },
      })
      looks.value = [...looks.value, look]
      return look
    } catch (e) {
      if (!mine.signal.aborted) generateError.value = message(e)
      return null
    } finally {
      if (styling === mine) {
        styling = null
        generating.value = false
        progress.value = null
      }
    }
  }

  function cancelGenerate() {
    styling?.abort()
  }

  return {
    looks,
    progress,
    cancelGenerate,
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
    reload,
    deleteLook,
    forget,
    generate,
  }
})
