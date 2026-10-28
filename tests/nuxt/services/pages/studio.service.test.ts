import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { StyleCallOptions } from '#shared/contracts/StyleAdvisor'
import { useRouter } from '#imports'
import { useStudioPage } from '~/services/pages/studio.service'
import { setupTestGateway } from '../../helpers'

async function ready() {
  const vm = useStudioPage()
  await vm.init()
  return vm
}

const worn = (vm: Awaited<ReturnType<typeof ready>>) => vm.placed.value.map((p) => p.item.id)

describe('studio page service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('starts with an empty dress form, the full wardrobe in the panel and a basic AI fill', async () => {
    const vm = await ready()
    expect(vm.placed.value).toEqual([])
    expect(vm.panelCategory.value).toBe('all')
    expect(vm.panelItems.value).toHaveLength(33)
    expect(vm.fillOptions.value.filter((o) => o.on).map((o) => o.id)).toEqual(['tops', 'bottoms', 'shoes', 'bags'])
    expect(vm.ghosts.value.map((g) => g.slot)).toEqual(['torso', 'legs', 'feet', 'hand'])
    expect(vm.canGenerate.value).toBe(true)
  })

  it('puts pieces on in their body slot, swapping what was there', async () => {
    const vm = await ready()
    vm.toggleWear('item-linen-tee')
    vm.toggleWear('item-straight-jeans')
    vm.toggleWear('item-black-tee')
    expect(worn(vm)).toEqual(['item-straight-jeans', 'item-black-tee'])
    expect(vm.placed.value.find((p) => p.item.id === 'item-black-tee')!.slot).toBe('torso')
    expect(vm.isWorn('item-linen-tee')).toBe(false)
  })

  it('takes a piece off when toggled again', async () => {
    const vm = await ready()
    vm.toggleWear('item-linen-tee')
    vm.toggleWear('item-linen-tee')
    expect(vm.placed.value).toEqual([])
  })

  it('a dress replaces separates and hides their AI placeholders', async () => {
    const vm = await ready()
    vm.toggleWear('item-linen-tee')
    vm.toggleWear('item-sage-slip-dress')
    expect(worn(vm)).toEqual(['item-sage-slip-dress'])
    expect(vm.ghosts.value.map((g) => g.id)).toEqual(['shoes', 'bags'])
  })

  it('clicking a piece on the form filters the wardrobe to its category', async () => {
    const vm = await ready()
    vm.toggleWear('item-ankle-boots')
    vm.focusCategory('shoes')
    expect(vm.panelCategory.value).toBe('shoes')
    expect(vm.panelItems.value.every((i) => i.category === 'shoes')).toBe(true)
    vm.selectPanelCategory('all')
    expect(vm.panelItems.value).toHaveLength(33)
  })

  it('cannot generate with nothing worn and no AI categories', async () => {
    const vm = await ready()
    for (const id of ['tops', 'bottoms', 'shoes', 'bags'] as const) vm.toggleFill(id)
    expect(vm.canGenerate.value).toBe(false)
    vm.toggleWear('item-little-black-dress')
    expect(vm.canGenerate.value).toBe(true)
  })

  it('generates: AI pieces land on the form, marked, and the verdict opens', async () => {
    const vm = await ready()
    vm.toggleWear('item-linen-tee')
    vm.prompt.value = 'weekend coffee'
    await vm.generate()
    expect(vm.panelTab.value).toBe('verdict')
    expect(vm.placed.value[0]).toMatchObject({ item: { id: 'item-linen-tee' }, isAi: false })
    expect(vm.placed.value.slice(1).length).toBeGreaterThan(0)
    expect(vm.placed.value.slice(1).every((p) => p.isAi)).toBe(true)
    expect(vm.result.value!.prompt).toBe('weekend coffee')
    expect(vm.scoreLabel.value).toMatch(/^\d{1,2}\/10$/)
    expect(vm.stale.value).toBe(false)
  })

  it('shows the AI picks, title and verdict as they stream, and cancelling puts the form back', async () => {
    let options: StyleCallOptions | undefined
    vi.spyOn(gateway, 'generateLook').mockImplementationOnce((_request, o) => {
      options = o
      return new Promise((_resolve, reject) => o!.signal!.addEventListener('abort', () => reject(o!.signal!.reason)))
    })
    const vm = await ready()
    vm.toggleWear('item-linen-tee')
    const pending = vm.generate()
    expect(vm.busy.value).toBe(true)
    expect(vm.progressLabel.value).toMatch(/reading your wardrobe/i)

    options!.onProgress!({ stage: 'picking', title: 'Gallery Night', aiItemIds: ['item-burgundy-skirt'] })
    await nextTick()
    expect(worn(vm)).toEqual(['item-linen-tee', 'item-burgundy-skirt'])
    expect(vm.placed.value[1]!.isAi).toBe(true)
    expect(vm.ghosts.value.map((g) => g.id)).not.toContain('bottoms')
    expect(vm.progressLabel.value).toMatch(/choosing/i)
    expect(vm.liveTitle.value).toBe('Gallery Night')

    options!.onProgress!({ stage: 'rating', title: 'Gallery Night', aiItemIds: ['item-burgundy-skirt'], verdict: 'Too safe for a gallery' })
    expect(vm.progressLabel.value).toMatch(/verdict/i)
    expect(vm.liveVerdict.value).toBe('Too safe for a gallery')

    vm.cancel()
    await pending
    expect(vm.busy.value).toBe(false)
    expect(worn(vm)).toEqual(['item-linen-tee'])
    expect(vm.result.value).toBeNull()
    expect(vm.error.value).toBeNull()
    expect(vm.liveTitle.value).toBe('')
  })

  it('marks the verdict stale when the outfit changes afterwards', async () => {
    const vm = await ready()
    await vm.generate()
    vm.toggleWear('item-red-heels')
    expect(vm.stale.value).toBe(true)
  })

  it('applies a fix and re-rates, keeping earlier AI badges', async () => {
    const vm = await ready()
    for (const id of ['tops', 'bottoms', 'bags'] as const) vm.toggleFill(id)
    vm.toggleWear('item-linen-tee')
    vm.toggleWear('item-burgundy-skirt')
    await vm.generate()
    const aiBefore = vm.placed.value.filter((p) => p.isAi).map((p) => p.item.id)
    const fix = vm.fixes.value[0]!
    const pending = vm.applyFix(fix)
    expect(vm.busy.value).toBe(true)
    await pending
    if (fix.addItemId) expect(vm.isWorn(fix.addItemId)).toBe(true)
    if (fix.removeItemId) expect(vm.isWorn(fix.removeItemId)).toBe(false)
    for (const id of aiBefore) if (vm.isWorn(id)) expect(vm.placed.value.find((p) => p.item.id === id)!.isAi).toBe(true)
  })

  it('clears the outfit and favourites the rated look', async () => {
    const vm = await ready()
    await vm.generate()
    await vm.toggleFavourite()
    expect(vm.result.value!.isFavourite).toBe(true)
    vm.clearOutfit()
    expect(vm.placed.value).toEqual([])
    expect(vm.result.value).toBeNull()
    expect(vm.panelTab.value).toBe('wardrobe')
  })

  it('names the active stylist', async () => {
    const vm = await ready()
    expect(vm.stylistLabel.value).toBe('Offline rules')
  })

  it('reopens a saved look from the library with its verdict', async () => {
    const look = await useStudioPage().init().then(async () => {
      const vm = useStudioPage()
      await vm.init()
      await vm.generate()
      return vm.result.value!
    })
    await useRouter().replace({ path: '/', query: { look: look.id } })
    const vm = useStudioPage()
    await vm.init()
    expect(vm.placed.value.map((p) => p.item.id)).toEqual(look.itemIds)
    expect(vm.result.value!.id).toBe(look.id)
    expect(vm.panelTab.value).toBe('verdict')
    expect(vm.placed.value.filter((p) => p.isAi).map((p) => p.item.id)).toEqual(look.aiItemIds)
    await useRouter().replace({ path: '/', query: {} })
  })
})
