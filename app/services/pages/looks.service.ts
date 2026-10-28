import { computed, ref } from 'vue'
import { useRoute, useRouter } from '#imports'
import type { StyleMatch } from '#shared/models/styleMatch'
import { localIsoDate } from '#shared/utils/date'
import { filterLooks, resolveLookItems, sortLooks, type LookFilter, type LookSort } from '#shared/utils/looks'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '~/services/lifecycle'
import type { LookWithItems } from '~/services/pages/index.service'

const FILTERS: { value: LookFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'favourites', label: 'Favourites' },
  { value: 'rated', label: 'Rated' },
  { value: 'daily', label: 'Daily picks' },
]

const SORTS: { value: LookSort; label: string; icon: string }[] = [
  { value: 'newest', label: 'Newest', icon: 'lucide:clock' },
  { value: 'score-desc', label: 'Best', icon: 'lucide:trending-up' },
  { value: 'score-asc', label: 'Worst', icon: 'lucide:trending-down' },
]

const EMPTY: Record<LookFilter, string> = {
  all: 'No looks yet. Style one in the Studio.',
  favourites: 'No favourites yet. Tap the heart on a look to keep it here.',
  rated: 'No rated looks yet. Generate one in the Studio to get a verdict.',
  daily: 'No daily picks yet. Your stylist adds one each day on Home.',
}

const pick = <T extends string>(value: unknown, allowed: readonly { value: T }[], fallback: T): T =>
  allowed.some((a) => a.value === value) ? (value as T) : fallback

/** Looks library: every saved look, filterable and sortable (state in the URL), reopen or delete. */
export function useLooksPage() {
  const route = useRoute()
  const router = useRouter()
  const looks = useStyleMatchesStore()
  const wardrobe = useWardrobeStore()
  const deleteId = ref<string | null>(null)
  const deleting = ref(false)

  const query = () => route.query as Record<string, string | undefined>
  const filter = computed(() => pick(query().filter, FILTERS, 'all'))
  const sort = computed(() => pick(query().sort, SORTS, 'newest'))

  const filters = computed(() => FILTERS.map((f) => ({ ...f, count: filterLooks(looks.looks, f.value).length })))
  const entries = computed<LookWithItems[]>(() =>
    sortLooks(filterLooks(looks.looks, filter.value), sort.value).map((look) => ({ look, items: resolveLookItems(look, wardrobe.items) })),
  )
  const emptyText = computed(() => EMPTY[filter.value])
  const deleteTarget = computed<StyleMatch | null>(() => (deleteId.value ? looks.byId(deleteId.value) : null))
  const deletingToday = computed(() => {
    const target = deleteTarget.value
    return !!target && (target.id === looks.todayLook?.id || target.dailyPickDate === localIsoDate(new Date()))
  })
  const deleteDescription = computed(() =>
    deletingToday.value
      ? "This is today's pick. Home will style a new one next time it opens. Your clothes stay in your wardrobe."
      : 'The look and its verdict are deleted. Your clothes stay in your wardrobe.',
  )
  const loading = computed(() => !(looks.loaded && wardrobe.loaded) && !(looks.error ?? wardrobe.error))

  function setQuery(next: { filter?: LookFilter; sort?: LookSort }) {
    const f = next.filter ?? filter.value
    const s = next.sort ?? sort.value
    router.replace({ query: { ...(f !== 'all' ? { filter: f } : {}), ...(s !== 'newest' ? { sort: s } : {}) } })
  }

  function setFilter(value: LookFilter) {
    setQuery({ filter: value })
  }

  function setSort(value: string) {
    setQuery({ sort: pick(value, SORTS, 'newest') })
  }

  function openInStudio(id: string) {
    router.push({ path: '/studio', query: { look: id } })
  }

  function toggleFavourite(id: string) {
    return looks.toggleFavourite(id)
  }

  function askDelete(id: string) {
    deleteId.value = id
  }

  function setDeleteOpen(open: boolean) {
    if (!open && !deleting.value) deleteId.value = null
  }

  async function confirmDelete() {
    if (!deleteId.value) return
    deleting.value = true
    try {
      await looks.deleteLook(deleteId.value)
      deleteId.value = null
    } finally {
      deleting.value = false
    }
  }

  function init() {
    return Promise.all([looks.load(), wardrobe.load()])
  }

  onViewMounted(init)

  return {
    filter,
    sort,
    filters,
    sorts: SORTS,
    entries,
    emptyText,
    loading,
    deleteTarget,
    deleteDescription,
    deleting,
    init,
    setFilter,
    setSort,
    openInStudio,
    toggleFavourite,
    askDelete,
    setDeleteOpen,
    confirmDelete,
  }
}
