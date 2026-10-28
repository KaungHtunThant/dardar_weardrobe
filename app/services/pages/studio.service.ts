import { computed, ref } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { StyleFix } from '#shared/models/styleMatch'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '~/services/lifecycle'

export type StudioStage = 'compose' | 'generating' | 'result'

export interface FillOption {
  id: CategoryId
  label: string
  on: boolean
  /** You already picked something here, so the AI leaves it alone. */
  coveredByYou: boolean
}

export interface ResolvedFix extends StyleFix {
  addItem?: Item
  removeItem?: Item
}

const DEFAULT_FILL: CategoryId[] = ['tops', 'bottoms', 'shoes', 'bags']
const MAX_PICKS = 12

/**
 * Style Studio controller: the user picks pieces (or not), chooses which categories
 * the AI may fill, optionally describes a vibe, then gets a completed, brutally rated look.
 */
export function useStudioPage() {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()

  const pinnedIds = ref<string[]>([])
  const fill = ref<CategoryId[]>([...DEFAULT_FILL])
  const prompt = ref('')
  const stage = ref<StudioStage>('compose')
  const resultId = ref<string | null>(null)

  const byId = (id?: string) => (id ? wardrobe.items.find((i) => i.id === id) : undefined)

  const items = computed(() => wardrobe.items)
  const pinnedItems = computed(() => pinnedIds.value.flatMap((id) => byId(id) ?? []))
  const covered = computed(() => new Set(pinnedItems.value.map((i) => i.category)))

  const fillOptions = computed<FillOption[]>(() =>
    CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      on: fill.value.includes(c.id),
      coveredByYou: covered.value.has(c.id),
    })),
  )
  const aiSlots = computed(() => fillOptions.value.filter((o) => o.on && !o.coveredByYou))
  const canGenerate = computed(
    () => stage.value !== 'generating' && (pinnedIds.value.length > 0 || aiSlots.value.length > 0),
  )

  const result = computed(() => (resultId.value ? looks.byId(resultId.value) : null))
  const resultItems = computed(() =>
    (result.value?.itemIds ?? []).flatMap((id) => {
      const item = byId(id)
      return item ? [{ item, isAi: result.value!.aiItemIds?.includes(id) ?? false }] : []
    }),
  )
  const scoreLabel = computed(() => (result.value?.rating ? `${result.value.rating.score}/10` : ''))
  const fixes = computed<ResolvedFix[]>(() =>
    (result.value?.rating?.fixes ?? []).map((f) => ({ ...f, addItem: byId(f.addItemId), removeItem: byId(f.removeItemId) })),
  )
  const error = computed(() => looks.generateError ?? wardrobe.error)
  const loading = computed(() => !wardrobe.loaded && !wardrobe.error)
  const busy = computed(() => looks.generating)

  function isPinned(id: string) {
    return pinnedIds.value.includes(id)
  }

  function togglePin(id: string) {
    if (isPinned(id)) pinnedIds.value = pinnedIds.value.filter((p) => p !== id)
    else if (pinnedIds.value.length < MAX_PICKS) pinnedIds.value = [...pinnedIds.value, id]
  }

  function toggleFill(id: CategoryId) {
    fill.value = fill.value.includes(id) ? fill.value.filter((c) => c !== id) : [...fill.value, id]
  }

  /** `rerate` keeps the current result on screen while the adjusted look is judged. */
  async function run(pinned: string[], fillCategories: CategoryId[], rerate = false) {
    if (!rerate) stage.value = 'generating'
    const look = await looks.generate({ pinnedItemIds: pinned, fillCategories, prompt: prompt.value })
    if (look) {
      resultId.value = look.id
      stage.value = 'result'
    } else if (!rerate) {
      stage.value = 'compose'
    }
  }

  function generate() {
    if (!canGenerate.value) return Promise.resolve()
    return run(pinnedIds.value, fill.value)
  }

  /** Takes the advisor's advice: apply the swap to the look and have it re-rated as-is. */
  function applyFix(fix: ResolvedFix) {
    const next = (result.value?.itemIds ?? []).filter((id) => id !== fix.removeItemId)
    if (fix.addItemId && !next.includes(fix.addItemId)) next.push(fix.addItemId)
    pinnedIds.value = next
    return run(next, [], true)
  }

  function toggleFavourite() {
    return resultId.value ? looks.toggleFavourite(resultId.value) : Promise.resolve()
  }

  function tweak() {
    stage.value = 'compose'
  }

  function reset() {
    pinnedIds.value = []
    fill.value = [...DEFAULT_FILL]
    prompt.value = ''
    resultId.value = null
    stage.value = 'compose'
  }

  function init() {
    return Promise.all([wardrobe.load(), looks.load()])
  }

  onViewMounted(init)

  return {
    items,
    pinnedIds,
    pinnedItems,
    fillOptions,
    aiSlots,
    prompt,
    stage,
    canGenerate,
    result,
    resultItems,
    scoreLabel,
    fixes,
    error,
    loading,
    busy,
    init,
    isPinned,
    togglePin,
    toggleFill,
    generate,
    applyFix,
    toggleFavourite,
    tweak,
    reset,
  }
}
