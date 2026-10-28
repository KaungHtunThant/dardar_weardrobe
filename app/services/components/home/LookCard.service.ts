import { computed } from 'vue'
import { shortDateLabel } from '#shared/utils/date'
import type { LookWithItems } from '~/services/pages/index.service'

export function useLookCard(props: { entry: LookWithItems }) {
  const dateLabel = computed(() => shortDateLabel(props.entry.look.createdAt))
  const piecesLabel = computed(() => {
    const n = props.entry.look.itemIds.length
    return `${n} ${n === 1 ? 'piece' : 'pieces'}`
  })
  return { dateLabel, piecesLabel }
}
