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

  function reset() {
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
    } catch (e) {
      photoError.value = e instanceof Error ? e.message : 'Could not process that photo.'
      originalImage.value = ''
      step.value = 'pick'
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview)
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
