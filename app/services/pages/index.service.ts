import { computed } from 'vue'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { localIsoDate, longDayLabel } from '#shared/utils/date'
import { resolveLookItems } from '#shared/utils/looks'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '../lifecycle'

export interface LookWithItems {
  look: StyleMatch
  items: Item[]
}

const RECENT_LIMIT = 8

export function useHomePage() {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()
  const now = new Date()
  const todayIso = localIsoDate(now)

  const withItems = (look: StyleMatch): LookWithItems => ({ look, items: resolveLookItems(look, wardrobe.items) })

  const loading = computed(() => !(wardrobe.loaded && looks.loaded) && !error.value)
  const error = computed(() => wardrobe.error ?? looks.error)
  const today = computed(() => {
    const pick = looks.pickFor(todayIso)
    return pick ? withItems(pick) : null
  })
  const recent = computed(() => looks.recent(RECENT_LIMIT).map(withItems))
  const favourites = computed(() => looks.favourites.map(withItems))

  async function init() {
    await Promise.all([wardrobe.load(), looks.load()])
  }

  function toggleFavourite(id: string) {
    return looks.toggleFavourite(id)
  }

  onViewMounted(init)

  return { loading, error, today, recent, favourites, todayLabel: longDayLabel(now), init, toggleFavourite }
}
