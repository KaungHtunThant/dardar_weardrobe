import { reactive, ref } from 'vue'
import type { DetailsSuggestion } from '#shared/contracts/GarmentTagger'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import { ItemDetailsSchema, OCCASIONS, SEASONS, type Item, type ItemDetails, type Occasion, type Season } from '#shared/models/item'

export type ItemField = 'name' | 'category' | 'colors' | 'brand' | 'size' | 'notes'

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const ITEM_FORM_OPTIONS = {
  categories: CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
  seasons: SEASONS.map((s) => ({ value: s, label: capitalise(s) })),
  occasions: OCCASIONS.map((o) => ({ value: o, label: capitalise(o) })),
}

const MESSAGES: Partial<Record<ItemField, string>> = { category: 'Choose a category' }

function emptyValues(category?: CategoryId) {
  return {
    name: '',
    category: (category ?? null) as CategoryId | null,
    /** Comma-separated in the form, an array in the model. */
    colors: '',
    brand: '',
    size: '',
    seasons: [] as Season[],
    occasions: [] as Occasion[],
    notes: '',
  }
}

function valuesOf(item: Item) {
  return {
    name: item.name,
    category: item.category as CategoryId | null,
    colors: item.colors.join(', '),
    brand: item.brand ?? '',
    size: item.size ?? '',
    seasons: [...item.seasons],
    occasions: [...item.occasions],
    notes: item.notes ?? '',
  }
}

/** The garment details form shared by Add and Edit: state, chip toggles, validation and AI pre-fill. */
export function createItemForm(defaultCategory?: CategoryId) {
  const form = reactive(emptyValues(defaultCategory))
  const errors = ref<Partial<Record<ItemField, string>>>({})

  function reset(category?: CategoryId) {
    errors.value = {}
    Object.assign(form, emptyValues(category))
  }

  function fill(item: Item) {
    errors.value = {}
    Object.assign(form, valuesOf(item))
  }

  function toggle<K extends 'seasons' | 'occasions'>(key: K, value: (typeof form)[K][number]) {
    const list = form[key] as string[]
    const i = list.indexOf(value)
    if (i >= 0) list.splice(i, 1)
    else list.push(value)
  }

  function setCategory(category: CategoryId) {
    form.category = category
  }

  /** Fills only fields the user hasn't touched; returns whether anything was filled. */
  function applySuggestion(s: DetailsSuggestion) {
    let filled = false
    if (s.name && !form.name.trim()) [form.name, filled] = [s.name, true]
    if (s.category && !form.category) [form.category, filled] = [s.category, true]
    if (s.colors?.length && !form.colors.trim()) [form.colors, filled] = [s.colors.join(', '), true]
    if (s.seasons?.length && form.seasons.length === 0) [form.seasons, filled] = [[...s.seasons], true]
    if (s.occasions?.length && form.occasions.length === 0) [form.occasions, filled] = [[...s.occasions], true]
    return filled
  }

  /** Validated details, or null with field errors set. */
  function validate(): ItemDetails | null {
    const parsed = ItemDetailsSchema.safeParse({
      ...form,
      category: form.category ?? undefined,
      colors: form.colors.split(',').map((c) => c.trim()).filter(Boolean),
    })
    if (!parsed.success) {
      const next: Partial<Record<ItemField, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ItemField
        next[field] ??= MESSAGES[field] ?? issue.message
      }
      errors.value = next
      return null
    }
    errors.value = {}
    return parsed.data
  }

  return { form, errors, options: ITEM_FORM_OPTIONS, reset, fill, toggle, setCategory, applySuggestion, validate }
}

export type ItemForm = ReturnType<typeof createItemForm>
