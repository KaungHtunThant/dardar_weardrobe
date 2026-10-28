import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRouter } from '#imports'
import { useLooksPage } from '~/services/pages/looks.service'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { localIsoDate } from '#shared/utils/date'
import { setupTestGateway } from '../../helpers'

async function at(query: Record<string, string>) {
  await useRouter().replace({ path: '/', query })
}

async function ready() {
  const vm = useLooksPage()
  await vm.init()
  return vm
}

describe('looks page service', () => {
  beforeEach(async () => {
    setupTestGateway()
    vi.restoreAllMocks()
    await at({})
  })

  it('lists every look newest first with its pieces', async () => {
    const vm = await ready()
    expect(vm.entries.value).toHaveLength(6)
    expect(vm.entries.value[0]!.look.id).toBe('look-summer-party')
    expect(vm.entries.value[0]!.items.length).toBeGreaterThan(0)
    expect(vm.filters.value.find((f) => f.value === 'favourites')!.count).toBe(3)
  })

  it('filters and sorts through the URL', async () => {
    const replace = vi.spyOn(useRouter(), 'replace')
    const vm = await ready()
    vm.setFilter('favourites')
    expect(replace).toHaveBeenCalledWith({ query: { filter: 'favourites' } })
    await at({ filter: 'favourites', sort: 'score-desc' })
    expect(vm.filter.value).toBe('favourites')
    expect(vm.entries.value.every((e) => e.look.isFavourite)).toBe(true)
  })

  it('opens a look in the Studio', async () => {
    const push = vi.spyOn(useRouter(), 'push')
    const vm = await ready()
    vm.openInStudio('look-date-night')
    expect(push).toHaveBeenCalledWith({ path: '/studio', query: { look: 'look-date-night' } })
  })

  it('deletes a look after confirmation', async () => {
    const vm = await ready()
    vm.askDelete('look-date-night')
    expect(vm.deleteTarget.value?.title).toBe('Date Night')
    await vm.confirmDelete()
    expect(vm.deleteTarget.value).toBeNull()
    expect(useStyleMatchesStore().looks.some((l) => l.id === 'look-date-night')).toBe(false)
  })

  it("warns that deleting today's pick makes Home style a new one", async () => {
    const vm = await ready()
    vm.askDelete('look-date-night')
    expect(vm.deleteDescription.value).not.toMatch(/today/i)
    const store = useStyleMatchesStore()
    await store.loadToday(localIsoDate(new Date()))
    vm.askDelete(store.todayLook!.id)
    expect(vm.deleteDescription.value).toMatch(/today's pick/i)
  })

  it('explains an empty filter', async () => {
    await at({ filter: 'daily' })
    const vm = await ready()
    expect(vm.entries.value).toEqual([])
    expect(vm.emptyText.value).toMatch(/daily/i)
  })
})
