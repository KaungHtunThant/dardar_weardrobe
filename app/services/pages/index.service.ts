import { computed, ref, watch } from 'vue'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { localIsoDate, longDayLabel } from '#shared/utils/date'
import { resolveLookItems } from '#shared/utils/looks'
import { useSettingsStore } from '~/stores/settings'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted, onViewUnmounted } from '../lifecycle'

export interface LookWithItems {
  look: StyleMatch
  items: Item[]
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

  /** The one-time introduction to the stylist agent set up on this device. */
  const welcome = computed(() => {
    const view = settings.view
    return view?.agent && !view.welcomed ? { name: view.agent.displayName } : null
  })

  async function dismissWelcome() {
    await settings.update({ welcomed: true })
  }

  async function init() {
    await Promise.all([wardrobe.load(), looks.load(), settings.view ? null : settings.load()])
    // Styling today's look may take a while with Claude; the rest of Home shows meanwhile.
    await looks.loadToday(todayIso)
  }

  function toggleFavourite(id: string) {
    return looks.toggleFavourite(id)
  }

  onViewMounted(init)

  return {
    loading,
    error,
    welcome,
    dismissWelcome,
    today,
    todayLoading,
    todayStage,
    recent,
    favourites,
    todayLabel: longDayLabel(now),
    init,
    toggleFavourite,
  }
}
