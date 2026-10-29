import { computed, ref, watch } from 'vue'
import type { Place } from '#shared/models/weather'
import { useWeatherStore } from '~/stores/weather'
import { onViewUnmounted } from '~/services/lifecycle'

export interface PlaceOption {
  key: string
  place: Place
  title: string
  /** Region and country, to tell the many Londons apart. */
  detail: string
}

export type LocationPickerEmit = (event: 'pick', place: Place) => void

const DEBOUNCE_MS = 300
const MIN_QUERY = 2

/** Find your city: search by name, or let the app guess from this computer's connection. */
export function useLocationPicker(emit: LocationPickerEmit) {
  const weather = useWeatherStore()
  const query = ref('')
  const results = ref<Place[]>([])
  const searched = ref(false)
  const searching = ref(false)
  const locating = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  /** Only the newest search may show its results. */
  let latest = 0

  const options = computed<PlaceOption[]>(() =>
    results.value.map((place) => ({
      key: `${place.latitude},${place.longitude}`,
      place,
      title: place.name,
      detail: [place.region, place.country].filter((p) => p && p !== place.name).join(', '),
    })),
  )
  const empty = computed(() => searched.value && !searching.value && results.value.length === 0 && !error.value)

  async function search() {
    clearTimeout(timer)
    const q = query.value.trim()
    const mine = ++latest
    error.value = null
    if (q.length < MIN_QUERY) {
      results.value = []
      searched.value = false
      return
    }
    searching.value = true
    try {
      const found = await weather.searchPlaces(q)
      if (mine === latest) {
        results.value = found
        searched.value = true
      }
    } catch (e) {
      if (mine === latest) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (mine === latest) searching.value = false
    }
  }

  watch(query, () => {
    clearTimeout(timer)
    timer = setTimeout(search, DEBOUNCE_MS)
  })
  onViewUnmounted(() => clearTimeout(timer))

  function choose(place: Place) {
    clearTimeout(timer)
    latest++
    emit('pick', place)
    query.value = ''
    results.value = []
    searched.value = false
  }

  async function useCurrentLocation() {
    locating.value = true
    error.value = null
    try {
      const place = await weather.locate()
      if (place) choose(place)
      else error.value = "Couldn't tell where you are. Search for your city instead."
    } finally {
      locating.value = false
    }
  }

  return { query, options, empty, searching, locating, error, search, choose, useCurrentLocation }
}
