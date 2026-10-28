import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import type { Upload } from '#shared/models/upload'
import { useAddDialog } from '~/services/components/item/AddDialog.service'
import { useUploadsStore } from '~/stores/uploads'
import { useWardrobeStore } from '~/stores/wardrobe'
import { setupTestGateway } from '../../../helpers'

const photo = (name = 'tee.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })

function setup(over: { defaultCategory?: 'tops' | 'bags' | 'shoes'; upload?: Upload | null } = {}) {
  const props = reactive({ open: true, defaultCategory: over.defaultCategory, upload: over.upload ?? null })
  const emit = vi.fn()
  const vm = useAddDialog(props, emit)
  return { props, emit, vm }
}

/** A photo the queue has prepared. */
async function readyUpload(suggestion: Upload['suggestion'] = {}, over: Partial<Upload> = {}) {
  const store = useUploadsStore()
  const [u] = await store.enqueue([photo()], over.categoryHint ?? undefined)
  for (let i = 0; i < 50 && store.uploads.find((x) => x.id === u!.id)!.state !== 'ready'; i++) {
    await new Promise((r) => setTimeout(r, 5))
    await store.refresh()
  }
  const ready = store.uploads.find((x) => x.id === u!.id)!
  return { ...ready, suggestion, ...over }
}

describe('AddDialog service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })
  afterEach(() => useUploadsStore().stop())

  describe('adding photos', () => {
    it('starts at the photo step', () => {
      const { vm } = setup({ defaultCategory: 'bags' })
      expect(vm.step.value).toBe('pick')
    })

    it('queues every chosen photo with the closet it came from, then closes so you can carry on', async () => {
      const spy = vi.spyOn(gateway, 'enqueuePhotos')
      const { vm, emit } = setup({ defaultCategory: 'shoes' })
      await vm.onFiles([photo('a.png'), photo('b.png')])
      expect(spy).toHaveBeenCalledWith([expect.any(File), expect.any(File)], { categoryHint: 'shoes' })
      expect(useUploadsStore().uploads).toHaveLength(2)
      expect(emit).toHaveBeenCalledWith('queued', 2)
      expect(emit).toHaveBeenCalledWith('update:open', false)
    })

    it('rejects files that are not images and queues nothing', async () => {
      const spy = vi.spyOn(gateway, 'enqueuePhotos')
      const { vm, emit } = setup()
      await vm.onFiles([photo(), new File(['x'], 'notes.txt', { type: 'text/plain' })])
      expect(vm.photoError.value).toBe('Please choose image files only.')
      expect(spy).not.toHaveBeenCalled()
      expect(emit).not.toHaveBeenCalledWith('update:open', false)
    })

    it('shows what went wrong if the photos could not be queued', async () => {
      vi.spyOn(gateway, 'enqueuePhotos').mockRejectedValueOnce(new Error('That photo is too large (20 MB max).'))
      const { vm } = setup()
      await vm.onFiles([photo()])
      expect(vm.photoError.value).toBe('That photo is too large (20 MB max).')
      expect(vm.queuing.value).toBe(false)
    })
  })

  describe('reviewing a prepared photo', () => {
    it("opens on the details with the cut-out and the stylist's suggestions", async () => {
      const upload = await readyUpload({ name: 'Blush Silk Blouse', category: 'tops', colors: ['blush', 'cream'], seasons: ['spring'], occasions: ['work'] })
      const { vm } = setup({ upload })
      expect(vm.step.value).toBe('details')
      expect(vm.cleanImage.value).toBe(upload.cleanImage)
      expect(vm.form).toMatchObject({ name: 'Blush Silk Blouse', category: 'tops', colors: 'blush, cream', seasons: ['spring'], occasions: ['work'] })
      expect(vm.suggestionNote.value).toMatch(/Suggested by Dardar/)
    })

    it("uses the closet's category when the stylist couldn't tell", async () => {
      const upload = await readyUpload({}, { categoryHint: 'shoes' })
      const { vm } = setup({ upload })
      expect(vm.form.category).toBe('shoes')
      expect(vm.suggestionNote.value).toBeNull()
    })

    it('says so when the garment could not be cut out', async () => {
      const upload = await readyUpload({}, { backgroundRemoved: false })
      expect(setup({ upload }).vm.photoError.value).toMatch(/couldn.t cut/)
    })

    it('shows field errors instead of saving invalid details', async () => {
      const upload = await readyUpload()
      const { vm, emit } = setup({ upload })
      await vm.submit()
      expect(vm.errors.value.name).toBe('Give this piece a name')
      expect(emit).not.toHaveBeenCalledWith('saved', expect.anything())
    })

    it('saves the piece from the prepared photo and closes', async () => {
      const upload = await readyUpload({ category: 'tops' })
      const { vm, emit } = setup({ upload })
      vm.form.name = 'Striped Tee'
      vm.form.colors = 'navy,  white, '
      vm.toggle('seasons', 'summer')
      await vm.submit()
      const saved = useWardrobeStore().items.find((i) => i.name === 'Striped Tee')!
      expect(saved).toMatchObject({ category: 'tops', colors: ['navy', 'white'], seasons: ['summer'], cleanImage: upload.cleanImage })
      expect(useUploadsStore().uploads).toEqual([])
      expect(emit).toHaveBeenCalledWith('saved', saved)
      expect(emit).toHaveBeenCalledWith('update:open', false)
    })

    it('can throw the photo away instead', async () => {
      const upload = await readyUpload()
      const { vm, emit } = setup({ upload })
      await vm.discardPhoto()
      expect(useUploadsStore().uploads).toEqual([])
      expect(emit).toHaveBeenCalledWith('update:open', false)
    })

    it('fills the form again for the next photo', async () => {
      const first = await readyUpload({ name: 'First' })
      const second = await readyUpload({ name: 'Second' })
      const { vm, props } = setup({ upload: first })
      vm.form.colors = 'draft'
      props.upload = second
      await nextTick()
      expect(vm.form.name).toBe('Second')
      expect(vm.form.colors).toBe('')
    })
  })
})
