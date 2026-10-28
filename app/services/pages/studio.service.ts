import { computed, ref } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { StyleFix } from '#shared/models/styleMatch'
import { slotFor, wear, type BodySlot } from '#shared/utils/outfit'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import { useSettingsStore } from '~/stores/settings'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '~/services/lifecycle'
import { useItemSheetRoute } from '~/services/shared/itemSheetRoute'

export type PanelTab = 'wardrobe' | 'verdict'

export interface FillOption {
  id: CategoryId
  label: string
  on: boolean
  /** Something from this category is already on the form, so the AI leaves it alone. */
  coveredByYou: boolean
}

/** A piece on the dress form. */
export interface PlacedPiece {
  item: Item
  slot: BodySlot
  isAi: boolean
}

/** A dashed placeholder where the AI will add a piece. */
export interface Ghost {
  id: CategoryId
  label: string
  slot: BodySlot
}

export interface ResolvedFix extends StyleFix {
  addItem?: Item
  removeItem?: Item
}

const DEFAULT_FILL: CategoryId[] = ['tops', 'bottoms', 'shoes', 'bags']
const GHOST_SLOT: Record<CategoryId, BodySlot> = {
  tops: 'torso',
  bottoms: 'legs',
  dresses: 'dress',
  outerwear: 'outer',
  shoes: 'feet',
  bags: 'hand',
  accessories: 'neck',
}

/**
 * Style Studio controller, Create-A-Sim style: the dress form on the left wears the outfit,
 * the wardrobe panel on the right dresses it. The AI fills the chosen categories and rates the look.
 */
export function useStudioPage() {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()
  const settings = useSettingsStore()
  const sheet = useItemSheetRoute()

  const outfitIds = ref<string[]>([])
  const aiIds = ref<string[]>([])
  const fill = ref<CategoryId[]>([...DEFAULT_FILL])
  const prompt = ref('')
  const panelCategory = ref<CategoryFilter>('all')
  const panelTab = ref<PanelTab>('wardrobe')
  const resultId = ref<string | null>(null)
  const stale = ref(false)

  const byId = (id?: string) => (id ? wardrobe.items.find((i) => i.id === id) : undefined)

  const outfit = computed(() => outfitIds.value.flatMap((id) => byId(id) ?? []))
  const placed = computed<PlacedPiece[]>(() =>
    outfit.value.map((item) => ({ item, slot: slotFor(item), isAi: aiIds.value.includes(item.id) })),
  )
  const covered = computed(() => new Set(outfit.value.map((i) => i.category)))
  const wearsDress = computed(() => covered.value.has('dresses'))
  const wearsSeparates = computed(() => covered.value.has('tops') || covered.value.has('bottoms'))

  const fillOptions = computed<FillOption[]>(() =>
    CATEGORIES.map((c) => ({ id: c.id, label: c.label, on: fill.value.includes(c.id), coveredByYou: covered.value.has(c.id) })),
  )
  const openToAi = computed(() => fillOptions.value.filter((o) => o.on && !o.coveredByYou).map((o) => o.id))
  const ghosts = computed<Ghost[]>(() => {
    const open = openToAi.value
    return open
      .filter((id) => {
        if ((id === 'tops' || id === 'bottoms') && wearsDress.value) return false
        // The AI prefers separates when both are allowed, so don't draw a dress over them.
        if (id === 'dresses') return !wearsSeparates.value && !open.includes('tops') && !open.includes('bottoms')
        return true
      })
      .map((id) => ({ id, label: CATEGORIES.find((c) => c.id === id)!.label, slot: GHOST_SLOT[id] }))
  })

  const panelItems = computed(() => wardrobe.byCategory(panelCategory.value))
  const wornIds = computed(() => outfitIds.value)
  const wornCategories = computed(() => [...covered.value])
  const busy = computed(() => looks.generating)
  const canGenerate = computed(() => !busy.value && (outfitIds.value.length > 0 || openToAi.value.length > 0))

  const result = computed(() => (resultId.value ? looks.byId(resultId.value) : null))
  const scoreLabel = computed(() => (result.value?.rating ? `${result.value.rating.score}/10` : ''))
  const fixes = computed<ResolvedFix[]>(() =>
    (result.value?.rating?.fixes ?? []).map((f) => ({ ...f, addItem: byId(f.addItemId), removeItem: byId(f.removeItemId) })),
  )
  const error = computed(() => looks.generateError ?? wardrobe.error)
  const stylistLabel = computed(() => {
    switch (settings.view?.advisor) {
      case 'claude-cli':
        return 'Claude (Claude Code CLI)'
      case 'claude-api':
        return 'Claude (Anthropic API)'
      case 'offline':
        return 'Offline rules'
      default:
        return ''
    }
  })
  const loading = computed(() => !wardrobe.loaded && !wardrobe.error)

  function isWorn(id: string) {
    return outfitIds.value.includes(id)
  }

  function setOutfit(ids: string[]) {
    outfitIds.value = ids
    aiIds.value = aiIds.value.filter((id) => ids.includes(id))
    if (resultId.value) stale.value = true
  }

  /** Puts a piece on (swapping out its slot) or takes it off. */
  function toggleWear(id: string) {
    const item = byId(id)
    if (!item) return
    setOutfit(isWorn(id) ? outfitIds.value.filter((o) => o !== id) : wear(outfit.value, item).map((i) => i.id))
  }

  /** Clicking a piece or placeholder on the form browses that category. */
  function focusCategory(id: CategoryId) {
    panelCategory.value = id
    panelTab.value = 'wardrobe'
  }

  function selectPanelCategory(id: CategoryFilter) {
    panelCategory.value = id
  }

  function setPanelTab(tab: PanelTab) {
    panelTab.value = tab
  }

  function toggleFill(id: CategoryId) {
    fill.value = fill.value.includes(id) ? fill.value.filter((c) => c !== id) : [...fill.value, id]
  }

  async function run(pinned: string[], fillCategories: CategoryId[]) {
    const previousAi = aiIds.value
    const look = await looks.generate({ pinnedItemIds: pinned, fillCategories, prompt: prompt.value })
    if (!look) return
    outfitIds.value = look.itemIds
    aiIds.value = [...new Set([...previousAi.filter((id) => look.itemIds.includes(id)), ...(look.aiItemIds ?? [])])]
    resultId.value = look.id
    stale.value = false
    panelTab.value = 'verdict'
  }

  function generate() {
    return canGenerate.value ? run(outfitIds.value, fill.value) : Promise.resolve()
  }

  /** Takes the advisor's advice: apply the swap and have the look re-rated as worn. */
  function applyFix(fix: ResolvedFix) {
    const next = outfitIds.value.filter((id) => id !== fix.removeItemId)
    if (fix.addItemId && !next.includes(fix.addItemId)) next.push(fix.addItemId)
    return run(next, [])
  }

  function toggleFavourite() {
    return resultId.value ? looks.toggleFavourite(resultId.value) : Promise.resolve()
  }

  function clearOutfit() {
    outfitIds.value = []
    aiIds.value = []
    resultId.value = null
    stale.value = false
    panelTab.value = 'wardrobe'
  }

  function init() {
    return Promise.all([wardrobe.load(), looks.load(), settings.load()])
  }

  onViewMounted(init)

  return {
    placed,
    ghosts,
    fillOptions,
    prompt,
    panelCategory,
    panelItems,
    wornIds,
    wornCategories,
    panelTab,
    canGenerate,
    busy,
    result,
    stale,
    scoreLabel,
    fixes,
    error,
    stylistLabel,
    loading,
    init,
    isWorn,
    toggleWear,
    focusCategory,
    selectPanelCategory,
    setPanelTab,
    toggleFill,
    generate,
    applyFix,
    toggleFavourite,
    clearOutfit,
    openItemId: sheet.openItemId,
    openItem: sheet.openItem,
    closeItem: sheet.closeItem,
  }
}
