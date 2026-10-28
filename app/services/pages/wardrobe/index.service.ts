import { computed, ref } from 'vue'
import { useRoute, useRouter } from '#imports'
import { CATEGORIES, CategoryIdSchema, type Category, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '~/services/lifecycle'
import { pieces } from '~/services/plural'
import { canGoBack } from '~/services/navigation'
import { useItemSheetRoute } from '~/services/shared/itemSheetRoute'

export type WardrobeView = 'closet' | 'list'

export interface ClosetSummary {
  category: Category
  count: number
  countLabel: string
  /** A few pieces visible when the doors are ajar. */
  preview: Item[]
}

const PREVIEW_SIZE = 3

const VIEW_OPTIONS = [
  { value: 'closet', label: 'Closet', icon: 'lucide:door-closed' },
  { value: 'list', label: 'List', icon: 'lucide:layout-grid' },
]

const asCategory = (value: unknown): CategoryId | null => {
  const parsed = CategoryIdSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Wardrobe page controller. View state lives in the URL:
 * ?view=list&filter=shoes  |  ?view=closet&closet=tops
 */
export function useWardrobePage() {
  const route = useRoute()
  const router = useRouter()
  const wardrobe = useWardrobeStore()
  const isAddOpen = ref(false)
  const sheet = useItemSheetRoute()

  const query = () => route.query as Record<string, string | undefined>

  const view = computed<WardrobeView>(() => (query().view === 'list' ? 'list' : 'closet'))
  const listFilter = computed<CategoryFilter>(() => asCategory(query().filter) ?? 'all')
  const openCloset = computed<Category | null>(() => {
    const id = view.value === 'closet' ? asCategory(query().closet) : null
    return id ? CATEGORIES.find((c) => c.id === id)! : null
  })

  const closets = computed<ClosetSummary[]>(() =>
    CATEGORIES.map((category) => ({
      category,
      count: wardrobe.counts[category.id],
      countLabel: pieces(wardrobe.counts[category.id]),
      preview: wardrobe.byCategory(category.id).slice(0, PREVIEW_SIZE),
    })),
  )
  const listItems = computed<Item[]>(() => wardrobe.byCategory(listFilter.value))
  const closetItems = computed<Item[]>(() => (openCloset.value ? wardrobe.byCategory(openCloset.value.id) : []))
  const totalLabel = computed(() => pieces(wardrobe.items.length))
  const loading = computed(() => !wardrobe.loaded && !wardrobe.error)
  const addDefaultCategory = computed<CategoryId | undefined>(() => {
    if (openCloset.value) return openCloset.value.id
    return view.value === 'list' && listFilter.value !== 'all' ? listFilter.value : undefined
  })

  function setView(next: string) {
    router.replace({ query: { view: next === 'list' ? 'list' : 'closet' } })
  }

  function setFilter(filter: CategoryFilter) {
    router.replace({ query: filter === 'all' ? { view: 'list' } : { view: 'list', filter } })
  }

  function openClosetFor(id: CategoryId) {
    router.push({ query: { view: 'closet', closet: id } })
  }

  function closeCloset() {
    // Opened from the grid → go back so history stays clean; deep-linked → just drop the param.
    if (canGoBack()) router.back()
    else router.replace({ query: { view: 'closet' } })
  }

  function openAdd() {
    isAddOpen.value = true
  }

  function setAddOpen(open: boolean) {
    isAddOpen.value = open
  }

  function init() {
    return wardrobe.load()
  }

  onViewMounted(init)

  return {
    viewOptions: VIEW_OPTIONS,
    view,
    listFilter,
    openCloset,
    closets,
    listItems,
    closetItems,
    counts: computed(() => wardrobe.counts),
    totalLabel,
    loading,
    error: computed(() => wardrobe.error),
    isAddOpen,
    addDefaultCategory,
    init,
    setView,
    setFilter,
    openClosetFor,
    closeCloset,
    openAdd,
    setAddOpen,
    openItemId: sheet.openItemId,
    openItem: sheet.openItem,
    closeItem: sheet.closeItem,
  }
}
