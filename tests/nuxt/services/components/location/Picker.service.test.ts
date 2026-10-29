import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useLocationPicker } from '~/services/components/location/Picker.service'
import { setupTestGateway } from '../../../helpers'

describe('location picker service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  const emit = vi.fn()
  beforeEach(() => {
    gateway = setupTestGateway()
    emit.mockReset()
  })
  afterEach(() => vi.useRealTimers())

  it('searches as the user types (after a short pause) and lists the cities with their region', async () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(gateway, 'searchPlaces')
    const vm = useLocationPicker(emit)
    vm.query.value = 'L'
    vm.query.value = 'Lond'
    await vi.advanceTimersByTimeAsync(400)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('Lond')
    expect(vm.options.value[0]).toMatchObject({ title: 'London', detail: 'England, United Kingdom' })
    expect(vm.empty.value).toBe(false)
  })

  it('says so when nothing matches, and clears for a short query', async () => {
    const vm = useLocationPicker(emit)
    vm.query.value = 'Atlantis'
    await vm.search()
    expect(vm.options.value).toEqual([])
    expect(vm.empty.value).toBe(true)
    vm.query.value = 'A'
    await vm.search()
    expect(vm.empty.value).toBe(false)
  })

  it('picks a city', async () => {
    const vm = useLocationPicker(emit)
    vm.query.value = 'Tokyo'
    await vm.search()
    vm.choose(vm.options.value[0]!.place)
    expect(emit).toHaveBeenCalledWith('pick', expect.objectContaining({ name: 'Tokyo' }))
    expect(vm.query.value).toBe('')
    expect(vm.options.value).toEqual([])
  })

  it('uses the current location, or explains when it cannot tell', async () => {
    const vm = useLocationPicker(emit)
    await vm.useCurrentLocation()
    expect(emit).toHaveBeenCalledWith('pick', expect.objectContaining({ name: 'Paris' }))

    vi.spyOn(gateway, 'locatePlace').mockResolvedValue(null)
    await vm.useCurrentLocation()
    await flushPromises()
    expect(vm.error.value).toMatch(/search for your city/i)
    expect(vm.locating.value).toBe(false)
  })

  it('shows a search failure', async () => {
    vi.spyOn(gateway, 'searchPlaces').mockRejectedValue(new Error("Couldn't reach the city search."))
    const vm = useLocationPicker(emit)
    vm.query.value = 'Paris'
    await vm.search()
    expect(vm.error.value).toMatch(/couldn't reach/i)
    expect(vm.searching.value).toBe(false)
  })
})
