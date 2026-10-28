import { computed } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { CategoryFilter } from '#shared/utils/wardrobe'

interface Emit {
  (event: 'select-category', id: CategoryFilter): void
  (event: 'toggle', id: string): void
  // eslint-disable-next-line @typescript-eslint/unified-signatures -- must mirror defineEmits' separate overloads
  (event: 'details', id: string): void
}

export function useWardrobePanel(
  props: { items: readonly Item[]; category: CategoryFilter; wornIds: readonly string[]; wornCategories: readonly CategoryId[] },
  emit: Emit,
) {
  const tabs = computed(() => [
    { id: 'all' as CategoryFilter, label: 'All', icon: 'lucide:layout-grid', worn: false },
    ...CATEGORIES.map((c) => ({ id: c.id as CategoryFilter, label: c.label, icon: c.icon, worn: props.wornCategories.includes(c.id) })),
  ])

  function select(id: CategoryFilter) {
    emit('select-category', id)
  }

  function toggle(id: string) {
    emit('toggle', id)
  }

  function details(id: string) {
    emit('details', id)
  }

  function isWorn(id: string) {
    return props.wornIds.includes(id)
  }

  return { tabs, select, toggle, details, isWorn }
}
