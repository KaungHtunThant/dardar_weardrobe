import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouter } from '#imports'
import { useWardrobePage } from '~/services/pages/wardrobe/index.service'
import { canGoBack } from '~/services/navigation'
import { setupTestGateway } from '../../../helpers'

vi.mock('~/services/navigation', () => ({ canGoBack: vi.fn(() => false) }))

async function at(query: Record<string, string>) {
  await useRouter().replace({ path: '/', query })
}

describe('wardrobe page service', () => {
  beforeEach(async () => {
    setupTestGateway()
    vi.restoreAllMocks()
    vi.mocked(canGoBack).mockReturnValue(false)
    await at({})
  })

  it('defaults to the closet view with every closet listed', async () => {
    const vm = useWardrobePage()
    await vm.init()
    expect(vm.view.value).toBe('closet')
    expect(vm.closets.value).toHaveLength(7)
    expect(vm.closets.value.find((c) => c.category.id === 'tops')).toMatchObject({ count: 7, countLabel: '7 pieces' })
    expect(vm.totalLabel.value).toBe('33 pieces')
  })

  it('gives each closet a peek at up to three of its newest pieces', async () => {
    const vm = useWardrobePage()
    await vm.init()
    const bags = vm.closets.value.find((c) => c.category.id === 'bags')!
    expect(bags.preview.map((i) => i.id)).toEqual(['item-blush-mini-bag', 'item-camel-tote', 'item-black-handbag'])
  })

  it('switches views through the URL, dropping an open closet', async () => {
    await at({ view: 'closet', closet: 'tops' })
    const replace = vi.spyOn(useRouter(), 'replace')
    useWardrobePage().setView('list')
    expect(replace).toHaveBeenCalledWith({ query: { view: 'list' } })
  })

  it('filters the list by the category in the URL', async () => {
    await at({ view: 'list', filter: 'shoes' })
    const vm = useWardrobePage()
    await vm.init()
    expect(vm.listFilter.value).toBe('shoes')
    expect(vm.listItems.value.length).toBe(4)
    expect(vm.listItems.value.every((i) => i.category === 'shoes')).toBe(true)
  })

  it('reacts when the URL changes', async () => {
    const vm = useWardrobePage()
    await vm.init()
    await at({ view: 'list', filter: 'bags' })
    expect(vm.view.value).toBe('list')
    expect(vm.listItems.value).toHaveLength(3)
  })

  it('ignores unknown categories in the URL', async () => {
    await at({ view: 'closet', filter: 'hats', closet: 'nope' })
    const vm = useWardrobePage()
    expect(vm.listFilter.value).toBe('all')
    expect(vm.openCloset.value).toBeNull()
  })

  it('removes the filter param for "All"', async () => {
    await at({ view: 'list', filter: 'shoes' })
    const replace = vi.spyOn(useRouter(), 'replace')
    useWardrobePage().setFilter('all')
    expect(replace).toHaveBeenCalledWith({ query: { view: 'list' } })
  })

  it('opens a closet as a new history entry so Back closes it', () => {
    const push = vi.spyOn(useRouter(), 'push')
    useWardrobePage().openClosetFor('dresses')
    expect(push).toHaveBeenCalledWith({ query: { view: 'closet', closet: 'dresses' } })
  })

  it("lists the open closet's clothes", async () => {
    await at({ view: 'closet', closet: 'bags' })
    const vm = useWardrobePage()
    await vm.init()
    expect(vm.openCloset.value?.id).toBe('bags')
    expect(vm.closetItems.value).toHaveLength(3)
  })

  it('closes a deep-linked closet by removing it from the URL', async () => {
    await at({ view: 'closet', closet: 'bags' })
    const replace = vi.spyOn(useRouter(), 'replace')
    useWardrobePage().closeCloset()
    expect(replace).toHaveBeenCalledWith({ query: { view: 'closet' } })
  })

  it('closes a closet opened in-app by going back', async () => {
    vi.mocked(canGoBack).mockReturnValue(true)
    const back = vi.spyOn(useRouter(), 'back').mockImplementation(() => {})
    useWardrobePage().closeCloset()
    expect(back).toHaveBeenCalled()
  })

  it('pre-selects the current category when adding an item', async () => {
    await at({ view: 'closet', closet: 'bags' })
    const vm = useWardrobePage()
    vm.openAdd()
    expect(vm.isAddOpen.value).toBe(true)
    expect(vm.addDefaultCategory.value).toBe('bags')
  })
})
