import { beforeEach, describe, expect, it } from 'vitest'
import { useStudioPage } from '~/services/pages/studio.service'
import { setupTestGateway } from '../../helpers'

async function ready() {
  const vm = useStudioPage()
  await vm.init()
  return vm
}

describe('studio page service', () => {
  beforeEach(() => {
    setupTestGateway()
  })

  it('starts composing with no picks and the AI filling a basic outfit', async () => {
    const vm = await ready()
    expect(vm.stage.value).toBe('compose')
    expect(vm.pinnedItems.value).toEqual([])
    expect(vm.fillOptions.value.filter((o) => o.on).map((o) => o.id)).toEqual(['tops', 'bottoms', 'shoes', 'bags'])
    expect(vm.canGenerate.value).toBe(true)
  })

  it('picks and unpicks pieces', async () => {
    const vm = await ready()
    vm.togglePin('item-linen-tee')
    vm.togglePin('item-camel-tote')
    expect(vm.pinnedItems.value.map((i) => i.id)).toEqual(['item-linen-tee', 'item-camel-tote'])
    vm.togglePin('item-linen-tee')
    expect(vm.isPinned('item-linen-tee')).toBe(false)
  })

  it('shows which AI categories are already covered by your picks', async () => {
    const vm = await ready()
    vm.togglePin('item-linen-tee')
    const tops = vm.fillOptions.value.find((o) => o.id === 'tops')!
    expect(tops.coveredByYou).toBe(true)
    expect(vm.aiSlots.value.map((s) => s.id)).toEqual(['bottoms', 'shoes', 'bags'])
  })

  it('cannot generate with nothing picked and every AI category off', async () => {
    const vm = await ready()
    for (const id of ['tops', 'bottoms', 'shoes', 'bags'] as const) vm.toggleFill(id)
    expect(vm.canGenerate.value).toBe(false)
    vm.togglePin('item-little-black-dress')
    expect(vm.canGenerate.value).toBe(true)
  })

  it('generates and shows a rated look marking the AI picks', async () => {
    const vm = await ready()
    vm.togglePin('item-linen-tee')
    vm.prompt.value = 'weekend coffee'
    await vm.generate()
    expect(vm.stage.value).toBe('result')
    const look = vm.result.value!
    expect(look.prompt).toBe('weekend coffee')
    expect(vm.resultItems.value[0]).toMatchObject({ item: { id: 'item-linen-tee' }, isAi: false })
    expect(vm.resultItems.value.slice(1).every((r) => r.isAi)).toBe(true)
    expect(vm.scoreLabel.value).toMatch(/^\d{1,2}\/10$/)
  })

  it('applies a fix: swaps pieces and re-rates without adding new AI picks', async () => {
    const vm = await ready()
    for (const id of ['tops', 'bottoms', 'shoes', 'bags'] as const) vm.toggleFill(id)
    vm.togglePin('item-linen-tee')
    vm.togglePin('item-straight-jeans')
    await vm.generate()
    const fix = vm.fixes.value.find((f) => f.addItem?.category === 'shoes')!
    expect(fix).toBeDefined()
    const pending = vm.applyFix(fix)
    expect(vm.stage.value).toBe('result')
    expect(vm.busy.value).toBe(true)
    await pending
    expect(vm.busy.value).toBe(false)
    expect(vm.result.value!.itemIds).toContain(fix.addItem!.id)
    expect(vm.result.value!.aiItemIds).toEqual([])
  })

  it('goes back to tweak the same picks, or starts fresh', async () => {
    const vm = await ready()
    vm.togglePin('item-linen-tee')
    await vm.generate()
    vm.tweak()
    expect(vm.stage.value).toBe('compose')
    expect(vm.pinnedItems.value).toHaveLength(1)
    vm.reset()
    expect(vm.pinnedItems.value).toHaveLength(0)
    expect(vm.prompt.value).toBe('')
  })

  it('favourites the generated look', async () => {
    const vm = await ready()
    await vm.generate()
    await vm.toggleFavourite()
    expect(vm.result.value!.isFavourite).toBe(true)
  })
})
