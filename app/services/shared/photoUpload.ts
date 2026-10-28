import { ref } from 'vue'
import type { ProcessedPhoto } from '#shared/contracts/WardrobeGateway'

export type UploadStage = 'pick' | 'processing' | 'ready'

function objectUrl(file: File): string {
  try {
    return URL.createObjectURL(file)
  } catch {
    return ''
  }
}

/**
 * Pick or drop a photo, then have its background removed. Shared by Add item and Replace photo.
 * `onReady` runs once the processed photo is available.
 */
export function createPhotoUpload(prepare: (photo: File) => Promise<ProcessedPhoto>, onReady?: (photo: ProcessedPhoto) => void) {
  const stage = ref<UploadStage>('pick')
  const originalImage = ref('')
  const cleanImage = ref('')
  const photoError = ref<string | null>(null)
  const dragging = ref(false)

  function reset() {
    stage.value = 'pick'
    originalImage.value = ''
    cleanImage.value = ''
    photoError.value = null
    dragging.value = false
  }

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
    stage.value = 'processing'
    try {
      const processed = await prepare(file)
      originalImage.value = processed.originalImage
      cleanImage.value = processed.cleanImage
      stage.value = 'ready'
      if (processed.backgroundRemoved === false) photoError.value = "We couldn't remove the background, so the original photo is used."
      onReady?.(processed)
    } catch (e) {
      photoError.value = e instanceof Error ? e.message : 'Could not process that photo.'
      originalImage.value = ''
      stage.value = 'pick'
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

  return { stage, originalImage, cleanImage, photoError, dragging, reset, onFiles, onInputChange, onDrop, setDragging }
}

export type PhotoUpload = ReturnType<typeof createPhotoUpload>
