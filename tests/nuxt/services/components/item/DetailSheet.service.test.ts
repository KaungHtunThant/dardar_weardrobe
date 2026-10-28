import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useDetailSheet } from '~/services/components/item/DetailSheet.service'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { setupTestGateway } from '../../../helpers'

async function setup(itemId: string | null = 'item-gold-necklace') {
  const wardrobe = useWardrobeStore()
  const looks = useStyleMatchesStore()
  await Promise.all([wardrobe.load(), looks.load()])
  const props = reactive({ itemId })
  const emit = vi.fn()
  return { vm: useDetailSheet(props, emit), props, emit, wardrobe }
}

describe('DetailSheet service', () => {
  beforeEach(() => {
    setupTestGateway()
  })

  it('shows the piece with readable details and how many looks use it', async () => {
    const { vm } = await setup()
    expect(vm.open.value).toBe(true)
    expect(vm.item.value!.name).toBe('Gold Pendant Necklace')
    expect(vm.facts.value).toEqual(expect.arrayContaining([{ label: 'Category', value: 'Accessories' }, { label: 'Colours', value: 'gold' }]))
    expect(vm.looksCount.value).toBe(2)
    expect(vm.mode.value).toBe('view')
  })

  it('is closed without an item', async () => {
    const { vm } = await setup(null)
    expect(vm.open.value).toBe(false)
  })

  it('edits and saves the details', async () => {
    const { vm, wardrobe } = await setup('item-linen-tee')
    vm.edit()
    expect(vm.mode.value).toBe('edit')
    expect(vm.itemForm.form.name).toBe('White Linen Tee')
    vm.itemForm.form.name = 'Linen Shirt'
    await vm.save()
    expect(vm.mode.value).toBe('view')
    expect(wardrobe.items.find((i) => i.id === 'item-linen-tee')!.name).toBe('Linen Shirt')
  })

  it('keeps editing when the details are invalid', async () => {
    const { vm } = await setup('item-linen-tee')
    vm.edit()
    vm.itemForm.form.name = ''
    await vm.save()
    expect(vm.mode.value).toBe('edit')
    expect(vm.itemForm.errors.value.name).toBeTruthy()
  })

  it('replaces the photo after the new one is processed', async () => {
    const { vm, wardrobe } = await setup('item-linen-tee')
    vm.startReplacePhoto()
    expect(vm.mode.value).toBe('photo')
    await vm.upload.onFiles([new File([new Uint8Array([1, 2, 3])], 'new.png', { type: 'image/png' })])
    expect(vm.upload.stage.value).toBe('ready')
    await vm.confirmPhoto()
    expect(vm.mode.value).toBe('view')
    expect(wardrobe.items.find((i) => i.id === 'item-linen-tee')!.cleanImage).toMatch(/^data:image\/png/)
  })

  it('deletes only after confirmation, then closes', async () => {
    const { vm, emit, wardrobe } = await setup()
    vm.askDelete()
    expect(vm.deleteOpen.value).toBe(true)
    vm.setDeleteOpen(false)
    expect(wardrobe.items.some((i) => i.id === 'item-gold-necklace')).toBe(true)
    vm.askDelete()
    await vm.confirmDelete()
    await flushPromises()
    expect(wardrobe.items.some((i) => i.id === 'item-gold-necklace')).toBe(false)
    expect(emit).toHaveBeenCalledWith('close')
  })

  it('goes back to viewing when another piece is opened', async () => {
    const { vm, props } = await setup('item-linen-tee')
    vm.edit()
    props.itemId = 'item-red-heels'
    await flushPromises()
    expect(vm.mode.value).toBe('view')
    expect(vm.item.value!.name).toBe('Red Pumps')
  })

  it('loads the looks itself, so the count is right on pages that never loaded them', async () => {
    const wardrobe = useWardrobeStore()
    await wardrobe.load()
    const vm = useDetailSheet(reactive({ itemId: 'item-silk-blouse' }), vi.fn())
    await flushPromises()
    expect(vm.looksCount.value).toBe(1)
  })
})
