import { computed } from 'vue'
import { shortDateLabel } from '#shared/utils/date'
import type { LookWithItems } from '~/services/pages/index.service'
import { pieces } from '~/services/plural'

export function useLookCard(props: { entry: LookWithItems }) {
  const dateLabel = computed(() => shortDateLabel(props.entry.look.createdAt))
  const piecesLabel = computed(() => pieces(props.entry.look.itemIds.length))
  return { dateLabel, piecesLabel }
}
