import { computed } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import type { CategoryFilter } from '#shared/utils/wardrobe'

export interface CategoryOption {
  id: CategoryFilter
  label: string
  count: number
}

type Emit = (event: 'select', id: CategoryFilter) => void

export function useCategoryBar(props: { counts: Record<CategoryId, number>; selected: CategoryFilter }, emit: Emit) {
  const options = computed<CategoryOption[]>(() => {
    const total = Object.values(props.counts).reduce((a, b) => a + b, 0)
    return [
      { id: 'all', label: 'All', count: total },
      ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: props.counts[c.id] })),
    ]
  })

  function select(id: CategoryFilter) {
    emit('select', id)
  }

  return { options, select }
}
