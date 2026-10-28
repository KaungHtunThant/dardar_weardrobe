import { computed, ref, watch } from 'vue'
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import { useWardrobeStore } from '~/stores/wardrobe'
import { createItemForm } from '~/services/shared/itemForm'
import { createPhotoUpload } from '~/services/shared/photoUpload'

export type AddStep = 'pick' | 'processing' | 'details'

interface Emit {
  (event: 'update:open', open: boolean): void
  (event: 'saved', item: Item): void
}

/**
 * Add-item flow: pick a photo → background removal → details (pre-filled by the stylist) → save.
 */
export function useAddDialog(props: { open: boolean; defaultCategory?: CategoryId }, emit: Emit) {
  const wardrobe = useWardrobeStore()
  const itemForm = createItemForm(props.defaultCategory)
  const upload = createPhotoUpload((file) => wardrobe.prepareImage(file), (photo) => void prefill(photo.cleanImage))
  const saving = ref(false)
  const suggesting = ref(false)
  const suggested = ref(false)
  const suggestionNote = ref<string | null>(null)
  /** Bumped on every new photo / reset so a late suggestion never fills the wrong form. */
  let attempt = 0

  const step = computed<AddStep>(() => (upload.stage.value === 'ready' ? 'details' : upload.stage.value))

  function reset() {
    attempt++
    suggesting.value = false
    suggested.value = false
    suggestionNote.value = null
    saving.value = false
    upload.reset()
    itemForm.reset(props.defaultCategory)
  }

  watch(
    () => props.open,
    (open) => {
      if (open) reset()
    },
  )

  /** Asks the stylist about the photo and fills only the fields the user hasn't touched. */
  async function prefill(image: string) {
    const mine = ++attempt
    suggesting.value = true
    suggested.value = false
    suggestionNote.value = null
    try {
      const s = await wardrobe.suggestDetails(image)
      if (mine !== attempt) return
      const filled = itemForm.applySuggestion(s)
      suggested.value = filled
      suggestionNote.value = filled ? 'Suggested by your stylist. Check and adjust.' : null
    } catch {
      if (mine === attempt) suggestionNote.value = "Couldn't suggest details. Please fill in the details yourself."
    } finally {
      if (mine === attempt) suggesting.value = false
    }
  }

  function startOver() {
    attempt++
    suggesting.value = false
    suggestionNote.value = null
    upload.reset()
  }

  function close() {
    emit('update:open', false)
  }

  async function submit() {
    const details = itemForm.validate()
    if (!details) return
    saving.value = true
    try {
      const item = await wardrobe.addItem({
        ...details,
        originalImage: upload.originalImage.value,
        cleanImage: upload.cleanImage.value,
      })
      emit('saved', item)
      emit('update:open', false)
    } finally {
      saving.value = false
    }
  }

  return {
    itemForm,
    options: itemForm.options,
    form: itemForm.form,
    errors: itemForm.errors,
    toggle: itemForm.toggle,
    setCategory: itemForm.setCategory,
    step,
    originalImage: upload.originalImage,
    cleanImage: upload.cleanImage,
    photoError: upload.photoError,
    dragging: upload.dragging,
    onFiles: upload.onFiles,
    onInputChange: upload.onInputChange,
    onDrop: upload.onDrop,
    setDragging: upload.setDragging,
    saving,
    suggesting,
    suggested,
    suggestionNote,
    startOver,
    close,
    submit,
  }
}
