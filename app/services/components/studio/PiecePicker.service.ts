import { computed, ref } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'

type Emit = (event: 'toggle', id: string) => void

export function usePiecePicker(props: { items: readonly Item[]; pinnedIds: readonly string[] }, emit: Emit) {
  const category = ref<CategoryId>('tops')

  const visible = computed(() => props.items.filter((i) => i.category === category.value))
  const tabs = computed(() =>
    CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      picked: props.items.filter((i) => i.category === c.id && props.pinnedIds.includes(i.id)).length,
    })),
  )

  function setCategory(id: CategoryId) {
    category.value = id
  }

  function isPicked(id: string) {
    return props.pinnedIds.includes(id)
  }

  function toggle(id: string) {
    emit('toggle', id)
  }

  return { category, visible, tabs, setCategory, isPicked, toggle }
}
