import { computed, ref, watch } from 'vue'
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { Upload } from '#shared/models/upload'
import { useUploadsStore } from '~/stores/uploads'
import { createItemForm } from '~/services/shared/itemForm'

export type AddStep = 'pick' | 'details'

interface Emit {
  (event: 'update:open', open: boolean): void
  (event: 'saved', item: Item): void
  (event: 'queued', count: number): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Add pieces in two moments: pick photos (they are queued and prepared in the background, so the
 * dialog closes at once), then, when a photo is ready, review the details Dardar suggested and save.
 */
export function useAddDialog(props: { open: boolean; defaultCategory?: CategoryId; upload?: Upload | null }, emit: Emit) {
  const uploads = useUploadsStore()
  const itemForm = createItemForm(props.defaultCategory)
  const photoError = ref<string | null>(null)
  const dragging = ref(false)
  const queuing = ref(false)
  const saving = ref(false)
  const suggestionNote = ref<string | null>(null)

  const step = computed<AddStep>(() => (props.upload ? 'details' : 'pick'))
  const cleanImage = computed(() => props.upload?.cleanImage ?? props.upload?.originalImage ?? '')
  const description = computed(() =>
    step.value === 'pick'
      ? 'Add photos of your pieces. Dardar cuts each garment out and suggests its details while you carry on.'
      : 'Dardar has prepared this piece. Check the details and save it.',
  )

  /** A fresh form for the photo under review, pre-filled with the stylist's suggestion. */
  function reset() {
    photoError.value = null
    dragging.value = false
    queuing.value = false
    saving.value = false
    suggestionNote.value = null
    const upload = props.upload
    itemForm.reset(upload?.categoryHint ?? props.defaultCategory)
    if (!upload) return
    // The stylist's category wins over the closet the photo was added from.
    if (upload.suggestion?.category) itemForm.form.category = null
    if (itemForm.applySuggestion(upload.suggestion ?? {})) suggestionNote.value = 'Suggested by Dardar. Check and adjust.'
    if (!itemForm.form.category) itemForm.form.category = upload.categoryHint ?? props.defaultCategory ?? null
    if (!upload.backgroundRemoved) photoError.value = "We couldn't cut the garment out, so the original photo is used."
  }
  reset()

  watch(
    () => [props.open, props.upload?.id],
    ([open]) => {
      if (open) reset()
    },
  )

  async function onFiles(files: FileList | readonly File[] | null | undefined) {
    const list = [...(files ?? [])]
    if (!list.length) return
    if (list.some((f) => !f.type.startsWith('image/'))) {
      photoError.value = 'Please choose image files only.'
      return
    }
    photoError.value = null
    queuing.value = true
    try {
      await uploads.enqueue(list, props.defaultCategory)
      emit('queued', list.length)
      emit('update:open', false)
    } catch (e) {
      photoError.value = message(e)
    } finally {
      queuing.value = false
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

  function close() {
    emit('update:open', false)
  }

  async function submit() {
    const upload = props.upload
    const details = itemForm.validate()
    if (!upload || !details) return
    saving.value = true
    try {
      const item = await uploads.save(upload.id, details)
      emit('saved', item)
      emit('update:open', false)
    } catch (e) {
      photoError.value = message(e)
    } finally {
      saving.value = false
    }
  }

  async function discardPhoto() {
    if (!props.upload) return
    await uploads.discard(props.upload.id)
    emit('update:open', false)
  }

  return {
    itemForm,
    options: itemForm.options,
    form: itemForm.form,
    errors: itemForm.errors,
    toggle: itemForm.toggle,
    setCategory: itemForm.setCategory,
    step,
    description,
    cleanImage,
    photoError,
    dragging,
    queuing,
    onFiles,
    onInputChange,
    onDrop,
    setDragging,
    saving,
    suggestionNote,
    discardPhoto,
    close,
    submit,
  }
}
