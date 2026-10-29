import { computed, ref, watch } from 'vue'
import { getCategory } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import type { Place } from '#shared/models/weather'
import { localIsoDate, longDayLabel } from '#shared/utils/date'
import { resolveLookItems } from '#shared/utils/looks'
import { placeLabel, weatherIcon, weatherLine } from '#shared/utils/weather'
import { useGapsStore } from '~/stores/gaps'
import { useSettingsStore } from '~/stores/settings'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { useWeatherStore } from '~/stores/weather'
import { onViewMounted, onViewUnmounted } from '../lifecycle'

export interface LookWithItems {
  look: StyleMatch
  items: Item[]
}

/** A piece the wardrobe is missing, ready to show. */
export interface MissingPiece {
  key: string
  name: string
  category: string
  icon: string
  reason: string
  /** e.g. "black · camel" */
  colors: string
  /** Pieces already owned that it would be worn with. */
  pairsWith: Item[]
}

const RECENT_LIMIT = 8

/** Rough timings of a Claude daily pick; the endpoint doesn't stream, so the stages follow the clock. */
const TODAY_STAGES: [afterSeconds: number, label: string][] = [
  [12, 'Writing the verdict…'],
  [4, "Choosing today's pieces…"],
  [0, 'Reading your wardrobe…'],
]

export function useHomePage() {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()
  const settings = useSettingsStore()
  const weather = useWeatherStore()
  const missing = useGapsStore()
  const now = new Date()
  const todayIso = localIsoDate(now)

  const withItems = (look: StyleMatch): LookWithItems => ({ look, items: resolveLookItems(look, wardrobe.items) })

  const loading = computed(() => !(wardrobe.loaded && looks.loaded) && !error.value)
  const error = computed(() => wardrobe.error ?? looks.error)
  const today = computed(() => (looks.todayLook ? withItems(looks.todayLook) : null))
  const todayLoading = computed(() => looks.todayLoading)
  const waited = ref(0)
  let ticker: ReturnType<typeof setInterval> | undefined
  watch(todayLoading, (on) => {
    clearInterval(ticker)
    waited.value = 0
    if (on) ticker = setInterval(() => waited.value++, 1000)
  })
  onViewUnmounted(() => clearInterval(ticker))
  const todayStage = computed(() => TODAY_STAGES.find(([after]) => waited.value >= after)![1])
  const recent = computed(() => looks.recent(RECENT_LIMIT).map(withItems))
  const favourites = computed(() => looks.favourites.map(withItems))

  /** What the wardrobe is missing, each with the owned pieces it goes with. */
  const gaps = computed<MissingPiece[]>(() =>
    (missing.report?.gaps ?? []).map((g, n) => {
      const category = getCategory(g.category)
      return {
        key: `${n}-${g.name}`,
        name: g.name,
        category: category.label,
        icon: category.icon,
        reason: g.reason,
        colors: g.colors.join(' · '),
        pairsWith: g.pairsWithItemIds.flatMap((id) => wardrobe.items.find((i) => i.id === id) ?? []),
      }
    }),
  )
  const gapsLoading = computed(() => missing.loading)
  const gapsRefreshing = computed(() => missing.refreshing)
  const gapsError = computed(() => missing.error)
  /** Only once there is a wardrobe to look through. */
  const showGaps = computed(() => wardrobe.items.length > 0)

  function refreshGaps() {
    return missing.refresh()
  }

  /** The weather today's look was styled for. */
  const todayWeather = computed(() => {
    const w = today.value?.look.weather
    return w ? { icon: weatherIcon(w.condition), label: `${weatherLine(w)} in ${w.place}` } : null
  })

  /** The one-time introduction to the stylist agent set up on this device. */
  const welcome = computed(() => {
    const view = settings.view
    return view?.agent && !view.welcomed ? { name: view.agent.displayName } : null
  })
  /** After the welcome, a quiet nudge for users who haven't said where they live. */
  const askForCity = computed(() => Boolean(settings.view && !settings.view.location && !welcome.value))

  /** Where the welcome thinks the user lives: first a guess from this computer, then their pick. */
  const place = ref<Place | null>(null)
  const welcomeLocating = ref(false)
  const changingPlace = ref(false)
  const welcomePlace = computed(() => (place.value ? placeLabel(place.value) : null))
  const pickingPlace = computed(() => changingPlace.value || (!welcomeLocating.value && !place.value))

  async function guessPlace() {
    welcomeLocating.value = true
    try {
      place.value = settings.view?.location ?? (await weather.locate())
    } finally {
      welcomeLocating.value = false
    }
  }

  function changePlace() {
    changingPlace.value = true
  }

  function pickPlace(picked: Place) {
    place.value = picked
    changingPlace.value = false
  }

  async function dismissWelcome() {
    const location = place.value
    const saved = await settings.update({ welcomed: true, ...(location ? { location } : {}) })
    if (saved && location) {
      weather.forget()
      // Today's look and the missing pieces were written before Dardar knew the climate: the backend redoes them.
      await Promise.all([looks.loadToday(todayIso), showGaps.value ? missing.load() : null])
    }
  }

  async function init() {
    await Promise.all([wardrobe.load(), looks.load(), settings.view ? null : settings.load()])
    if (welcome.value) void guessPlace()
    // Styling today's look and finding what's missing may take a while with Claude; the rest of Home shows meanwhile.
    await Promise.all([looks.loadToday(todayIso), wardrobe.items.length ? missing.load() : null])
  }

  function toggleFavourite(id: string) {
    return looks.toggleFavourite(id)
  }

  onViewMounted(init)

  return {
    loading,
    error,
    welcome,
    welcomePlace,
    welcomeLocating,
    pickingPlace,
    changePlace,
    pickPlace,
    dismissWelcome,
    askForCity,
    today,
    todayWeather,
    todayLoading,
    todayStage,
    recent,
    gaps,
    gapsLoading,
    gapsRefreshing,
    gapsError,
    showGaps,
    refreshGaps,
    favourites,
    todayLabel: longDayLabel(now),
    init,
    toggleFavourite,
  }
}
