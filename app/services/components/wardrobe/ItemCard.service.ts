import { computed } from 'vue'
import type { Item } from '#shared/models/item'

export function useItemCard(props: { item: Item }) {
  const meta = computed(() => [props.item.brand, props.item.colors.join(', ')].filter(Boolean).join(' · '))
  return { meta }
}
