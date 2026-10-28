import { computed, ref, watch } from 'vue'
import { getCategory } from '#shared/models/category'
import { shortDateLabel } from '#shared/utils/date'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { createItemForm } from '~/services/shared/itemForm'
import { createPhotoUpload } from '~/services/shared/photoUpload'

export type SheetMode = 'view' | 'edit' | 'photo'

type Emit = (event: 'close') => void

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const list = (values: string[]) => values.map(capitalise).join(', ')

/** One piece in detail: view, edit its details, replace its photo, or delete it. */
export function useDetailSheet(props: { itemId: string | null }, emit: Emit) {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()
  const itemForm = createItemForm()
  const upload = createPhotoUpload((file) => wardrobe.prepareImage(file))
  const mode = ref<SheetMode>('view')
  const busy = ref(false)
  const error = ref<string | null>(null)
  const deleteOpen = ref(false)

  const item = computed(() => (props.itemId ? (wardrobe.items.find((i) => i.id === props.itemId) ?? null) : null))
  const open = computed(() => item.value !== null)
  const looksCount = computed(() => (item.value ? looks.looks.filter((l) => l.itemIds.includes(item.value!.id)).length : 0))
  const facts = computed(() => {
    const i = item.value
    if (!i) return []
    return [
      { label: 'Category', value: getCategory(i.category).label },
      { label: 'Colours', value: i.colors.join(', ') },
      { label: 'Brand', value: i.brand ?? '' },
      { label: 'Size', value: i.size ?? '' },
      { label: 'Seasons', value: list(i.seasons) },
      { label: 'Occasions', value: list(i.occasions) },
      { label: 'Added', value: shortDateLabel(i.createdAt) },
    ].filter((f) => f.value)
  })
  const deleteMessage = computed(() => {
    const n = looksCount.value
    const inLooks = n === 0 ? '' : ` It's in ${n} ${n === 1 ? 'look' : 'looks'}; ${n === 1 ? 'it' : 'they'} will lose this piece.`
    return `This deletes the piece and its photos.${inLooks} It can't be undone.`
  })

  watch(
    () => props.itemId,
    () => {
      mode.value = 'view'
      error.value = null
      deleteOpen.value = false
    },
  )
  // Pages like Wardrobe don't load looks; the "in N looks" count needs them.
  watch(open, (isOpen) => void (isOpen && looks.load()), { immediate: true })

  function edit() {
    if (!item.value) return
    itemForm.fill(item.value)
    error.value = null
    mode.value = 'edit'
  }

  function startReplacePhoto() {
    upload.reset()
    error.value = null
    mode.value = 'photo'
  }

  function cancel() {
    mode.value = 'view'
    error.value = null
  }

  async function run(action: () => Promise<unknown>) {
    busy.value = true
    error.value = null
    try {
      await action()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    } finally {
      busy.value = false
    }
  }

  async function save() {
    const details = itemForm.validate()
    if (!details || !item.value) return
    const id = item.value.id
    if (await run(() => wardrobe.updateItem(id, details))) mode.value = 'view'
  }

  async function confirmPhoto() {
    if (!item.value || upload.stage.value !== 'ready') return
    const id = item.value.id
    const photo = { originalImage: upload.originalImage.value, cleanImage: upload.cleanImage.value }
    if (await run(() => wardrobe.replaceItemPhoto(id, photo))) mode.value = 'view'
  }

  function askDelete() {
    deleteOpen.value = true
  }

  function setDeleteOpen(value: boolean) {
    if (!busy.value) deleteOpen.value = value
  }

  async function confirmDelete() {
    if (!item.value) return
    const id = item.value.id
    if (await run(() => wardrobe.deleteItem(id))) {
      deleteOpen.value = false
      emit('close')
    }
  }

  function close() {
    emit('close')
  }

  /** The sheet's own open/close (overlay click, Esc, ×). */
  function setOpen(value: boolean) {
    if (!value) close()
  }

  return {
    item,
    open,
    mode,
    busy,
    error,
    facts,
    looksCount,
    itemForm,
    upload,
    deleteOpen,
    deleteMessage,
    edit,
    startReplacePhoto,
    cancel,
    save,
    confirmPhoto,
    askDelete,
    setDeleteOpen,
    confirmDelete,
    close,
    setOpen,
  }
}
