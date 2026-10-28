import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useAddDialog } from '~/services/components/item/AddDialog.service'
import { useWardrobeStore } from '~/stores/wardrobe'
import { useGateway } from '~/gateways/provider'
import { setupTestGateway } from '../../../helpers'

const photo = () => new File([new Uint8Array([1, 2, 3])], 'tee.png', { type: 'image/png' })

function setup(defaultCategory?: 'tops' | 'bags') {
  const props = reactive({ open: true, defaultCategory })
  const emit = vi.fn()
  const vm = useAddDialog(props, emit)
  return { props, emit, vm }
}

async function toDetails(vm: ReturnType<typeof setup>['vm']) {
  const pending = vm.onFiles([photo()])
  expect(vm.step.value).toBe('processing')
  await pending
  await flushPromises()
}

describe('AddDialog service', () => {
  beforeEach(() => {
    setupTestGateway()
  })

  it('starts at the photo step with the default category pre-selected', () => {
    const { vm } = setup('bags')
    expect(vm.step.value).toBe('pick')
    expect(vm.form.category).toBe('bags')
  })

  it('processes a photo: shows the clean image and moves on to details', async () => {
    const { vm } = setup()
    await toDetails(vm)
    expect(vm.step.value).toBe('details')
    expect(vm.cleanImage.value).toMatch(/^data:image\/png;base64,/)
  })

  it('previews the chosen photo while processing', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const { vm } = setup()
    const pending = vm.onFiles([photo()])
    expect(vm.originalImage.value).toBe('blob:preview')
    await pending
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview')
    vi.restoreAllMocks()
  })

  it('rejects files that are not images', async () => {
    const { vm } = setup()
    await vm.onFiles([new File(['x'], 'notes.txt', { type: 'text/plain' })])
    expect(vm.step.value).toBe('pick')
    expect(vm.photoError.value).toBe('Please choose an image file.')
  })

  it('shows field errors instead of saving invalid details', async () => {
    const { vm, emit } = setup()
    await toDetails(vm)
    await vm.submit()
    expect(vm.errors.value.name).toBe('Give this piece a name')
    expect(vm.errors.value.category).toBe('Choose a category')
    expect(emit).not.toHaveBeenCalledWith('saved', expect.anything())
  })

  it('saves the item with the clean image and closes', async () => {
    const { vm, emit } = setup('tops')
    await toDetails(vm)
    vm.form.name = 'Striped Tee'
    vm.form.colors = 'navy,  white, '
    vm.toggle('seasons', 'summer')
    vm.toggle('occasions', 'casual')
    vm.toggle('occasions', 'work')
    vm.toggle('occasions', 'work')
    await vm.submit()

    const store = useWardrobeStore()
    const saved = store.items[0]!
    expect(saved).toMatchObject({
      name: 'Striped Tee',
      category: 'tops',
      colors: ['navy', 'white'],
      seasons: ['summer'],
      occasions: ['casual'],
    })
    expect(saved.cleanImage).toMatch(/^data:image\/png;base64,/)
    expect(emit).toHaveBeenCalledWith('saved', saved)
    expect(emit).toHaveBeenCalledWith('update:open', false)
  })

  it('starts fresh when the dialog is reopened', async () => {
    const { vm, props } = setup('tops')
    await toDetails(vm)
    vm.form.name = 'Draft'
    props.open = false
    await nextTick()
    props.defaultCategory = 'bags'
    props.open = true
    await nextTick()
    expect(vm.step.value).toBe('pick')
    expect(vm.form.name).toBe('')
    expect(vm.form.category).toBe('bags')
  })

  it('pre-fills empty fields from the stylist without overwriting what you typed', async () => {
    vi.spyOn(useGateway(), 'suggestDetails').mockResolvedValue({
      name: 'Blush Silk Blouse',
      category: 'tops',
      colors: ['blush', 'cream'],
      seasons: ['spring'],
      occasions: ['work'],
    })
    const { vm } = setup('bags')
    vm.form.name = 'My Blouse'
    await toDetails(vm)
    await flushPromises()
    expect(vm.form.name).toBe('My Blouse')
    expect(vm.form.category).toBe('bags')
    expect(vm.form.colors).toBe('blush, cream')
    expect(vm.form.seasons).toEqual(['spring'])
    expect(vm.suggested.value).toBe(true)
    expect(vm.suggesting.value).toBe(false)
  })

  it('keeps going quietly when no suggestion is possible', async () => {
    vi.spyOn(useGateway(), 'suggestDetails').mockRejectedValue(new Error('CLI missing'))
    const { vm } = setup()
    await toDetails(vm)
    await flushPromises()
    expect(vm.suggested.value).toBe(false)
    expect(vm.suggestionNote.value).toMatch(/fill in the details/i)
  })
})
