import { reactive, ref, watch } from 'vue'
import { CATEGORIES, type CategoryId } from '#shared/models/category'
import { ItemDetailsSchema, OCCASIONS, SEASONS, type Item, type Occasion, type Season } from '#shared/models/item'
import { useWardrobeStore } from '~/stores/wardrobe'

export type AddStep = 'pick' | 'processing' | 'details'

type Field = 'name' | 'category' | 'colors' | 'brand' | 'size' | 'notes'

interface Emit {
  (event: 'update:open', open: boolean): void
  (event: 'saved', item: Item): void
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const OPTIONS = {
  categories: CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
  seasons: SEASONS.map((s) => ({ value: s, label: capitalise(s) })),
  occasions: OCCASIONS.map((o) => ({ value: o, label: capitalise(o) })),
}

const MESSAGES: Partial<Record<Field, string>> = { category: 'Choose a category' }

function objectUrl(file: File): string {
  try {
    return URL.createObjectURL(file)
  } catch {
    return ''
  }
}

function emptyForm(category?: CategoryId) {
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

/**
 * Add-item flow: pick a photo → background removal → details → save.
 */
export function useAddDialog(props: { open: boolean; defaultCategory?: CategoryId }, emit: Emit) {
  const wardrobe = useWardrobeStore()
  const step = ref<AddStep>('pick')
  const originalImage = ref('')
  const cleanImage = ref('')
  const photoError = ref<string | null>(null)
  const errors = ref<Partial<Record<Field, string>>>({})
  const saving = ref(false)
  const dragging = ref(false)
  const form = reactive(emptyForm(props.defaultCategory))
  const suggesting = ref(false)
  const suggested = ref(false)
  const suggestionNote = ref<string | null>(null)
  /** Bumped on every new photo / reset so a late suggestion never fills the wrong form. */
  let attempt = 0

  function reset() {
    attempt++
    suggesting.value = false
    suggested.value = false
    suggestionNote.value = null
    step.value = 'pick'
    originalImage.value = ''
    cleanImage.value = ''
    photoError.value = null
    errors.value = {}
    saving.value = false
    dragging.value = false
    Object.assign(form, emptyForm(props.defaultCategory))
  }

  watch(
    () => props.open,
    (open) => {
      if (open) reset()
    },
  )

  async function onFiles(files: FileList | readonly File[] | null | undefined) {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      photoError.value = 'Please choose an image file.'
      return
    }
    photoError.value = null
    // Show the photo itself while its background is being removed.
    const localPreview = objectUrl(file)
    originalImage.value = localPreview
    step.value = 'processing'
    try {
      const processed = await wardrobe.prepareImage(file)
      originalImage.value = processed.originalImage
      cleanImage.value = processed.cleanImage
      step.value = 'details'
      if (processed.backgroundRemoved === false) photoError.value = "We couldn't remove the background, so the original photo is used."
      void prefill(processed.cleanImage)
    } catch (e) {
      photoError.value = e instanceof Error ? e.message : 'Could not process that photo.'
      originalImage.value = ''
      step.value = 'pick'
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }

  /** Asks the stylist about the photo and fills only the fields the user hasn't touched. */
  async function prefill(image: string) {
    const mine = ++attempt
    suggesting.value = true
    suggested.value = false
    suggestionNote.value = null
    try {
      const s = await wardrobe.suggestDetails(image)
      if (mine !== attempt) return
      let filled = false
      if (s.name && !form.name.trim()) [form.name, filled] = [s.name, true]
      if (s.category && !form.category) [form.category, filled] = [s.category, true]
      if (s.colors?.length && !form.colors.trim()) [form.colors, filled] = [s.colors.join(', '), true]
      if (s.seasons?.length && form.seasons.length === 0) [form.seasons, filled] = [[...s.seasons], true]
      if (s.occasions?.length && form.occasions.length === 0) [form.occasions, filled] = [[...s.occasions], true]
      suggested.value = filled
      suggestionNote.value = filled ? 'Suggested by your stylist. Check and adjust.' : null
    } catch {
      if (mine === attempt) suggestionNote.value = "Couldn't suggest details. Please fill in the details yourself."
    } finally {
      if (mine === attempt) suggesting.value = false
    }
  }

  function onInputChange(event: Event) {
    const input = event.target as HTMLInputElement
    void onFiles(input.files)
    input.value = ''
  }

  function onDrop(event: DragEvent) {
    dragging.value = false
    void onFiles(event.dataTransfer?.files)
  }

  function setDragging(value: boolean) {
    dragging.value = value
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

  function startOver() {
    attempt++
    suggesting.value = false
    suggestionNote.value = null
    step.value = 'pick'
    originalImage.value = ''
    cleanImage.value = ''
  }

  function close() {
    emit('update:open', false)
  }

  async function submit() {
    const parsed = ItemDetailsSchema.safeParse({
      ...form,
      category: form.category ?? undefined,
      colors: form.colors.split(',').map((c) => c.trim()).filter(Boolean),
    })
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= MESSAGES[field] ?? issue.message
      }
      errors.value = next
      return
    }
    errors.value = {}
    saving.value = true
    try {
      const item = await wardrobe.addItem({
        ...parsed.data,
        originalImage: originalImage.value,
        cleanImage: cleanImage.value,
      })
      emit('saved', item)
      emit('update:open', false)
    } finally {
      saving.value = false
    }
  }

  return {
    options: OPTIONS,
    step,
    originalImage,
    cleanImage,
    photoError,
    errors,
    saving,
    dragging,
    form,
    suggesting,
    suggested,
    suggestionNote,
    onFiles,
    onInputChange,
    onDrop,
    setDragging,
    toggle,
    setCategory,
    startOver,
    close,
    submit,
  }
}
