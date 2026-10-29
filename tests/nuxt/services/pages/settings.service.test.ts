import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsPage } from '~/services/pages/settings.service'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { useGapsStore } from '~/stores/gaps'
import { DEMO_PLACES } from '#shared/weather/DemoWeather'
import { setupTestGateway } from '../../helpers'

async function ready() {
  const vm = useSettingsPage()
  await vm.init()
  return vm
}

describe('settings page service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })

  it('shows the three stylist modes with their status', async () => {
    const vm = await ready()
    expect(vm.modes.value.map((m) => m.value)).toEqual(['claude-cli', 'claude-api', 'offline'])
    expect(vm.modes.value.find((m) => m.value === 'claude-cli')!.status).toMatch(/not found/i)
    expect(vm.modes.value.find((m) => m.value === 'claude-api')!.status).toMatch(/no key/i)
    expect(vm.form.advisor).toBe('offline')
  })

  it('introduces the stylist agent set up on this device and can recreate it', async () => {
    const vm = await ready()
    expect(vm.agent.value).toMatchObject({ name: 'Dardar', runsOn: 'Offline rules' })
    expect(vm.agent.value!.since).toMatch(/\d{4}/)
    const spy = vi.spyOn(gateway, 'recreateAgent')
    await vm.recreateAgent()
    expect(spy).toHaveBeenCalled()
    expect(vm.savedMessage.value).toMatch(/Dardar is set up again/)
  })

  it('shows the city looks are dressed for, and changes it at once', async () => {
    const vm = await ready()
    expect(vm.location.value).toBeNull()
    vm.changeLocation()
    expect(vm.editingLocation.value).toBe(true)
    await vm.pickLocation(DEMO_PLACES.find((p) => p.name === 'Milan')!)
    expect(vm.location.value).toEqual({ label: 'Milan, Italy', detail: 'Lombardy' })
    expect(vm.editingLocation.value).toBe(false)
    expect(vm.savedMessage.value).toMatch(/Milan/)
    expect((await gateway.getSettings()).location).toMatchObject({ name: 'Milan' })
    expect(vm.dirty.value).toBe(false)
  })

  it('forgets the city on request', async () => {
    await gateway.updateSettings({ location: DEMO_PLACES[0] })
    const vm = await ready()
    expect(vm.location.value?.label).toBe('Paris, France')
    await vm.removeLocation()
    expect(vm.location.value).toBeNull()
    expect((await gateway.getSettings()).location).toBeNull()
  })

  it('warns before saving a mode that cannot work yet', async () => {
    const vm = await ready()
    vm.form.advisor = 'claude-api'
    expect(vm.warning.value).toMatch(/API key/)
    vm.apiKeyInput.value = 'sk-ant-xyz-7777'
    expect(vm.warning.value).toBeNull()
    vm.form.advisor = 'claude-cli'
    expect(vm.warning.value).toMatch(/wasn.t found/)
  })

  it('saves the choices and a new key, then clears the key field', async () => {
    const vm = await ready()
    vm.form.advisor = 'claude-api'
    vm.form.model = 'claude-sonnet-5-5'
    vm.form.effort = 'high'
    vm.apiKeyInput.value = 'sk-ant-xyz-7777'
    expect(vm.dirty.value).toBe(true)
    await vm.save()
    expect(vm.savedMessage.value).toBe('Saved')
    expect(vm.apiKeyInput.value).toBe('')
    expect(vm.keyStatus.value).toMatch(/7777/)
    expect(vm.dirty.value).toBe(false)
  })

  it('removes the stored key', async () => {
    const vm = await ready()
    vm.apiKeyInput.value = 'sk-ant-xyz-7777'
    await vm.save()
    await vm.removeKey()
    expect(vm.keyStatus.value).toMatch(/no key/i)
  })

  it('explains where the key is kept', async () => {
    const vm = await ready()
    expect(vm.keyStorageNote.value).toMatch(/private file/)
    expect(vm.keyInputDisabled.value).toBe(false)
  })

  it('without a system keychain, the key field is off and the note says what to do instead', async () => {
    const real = gateway.getSettings.bind(gateway)
    vi.spyOn(gateway, 'getSettings').mockImplementation(async () => ({ ...(await real()), keyStorage: 'unavailable' }))
    const vm = await ready()
    expect(vm.keyInputDisabled.value).toBe(true)
    expect(vm.keyStorageNote.value).toMatch(/no system keychain/i)
    expect(vm.keyStorageNote.value).toMatch(/ANTHROPIC_API_KEY/)
  })

  it('clears the wardrobe only after confirmation, keeping the settings', async () => {
    const vm = await ready()
    const wardrobe = useWardrobeStore()
    const looks = useStyleMatchesStore()
    const gaps = useGapsStore()
    await Promise.all([wardrobe.load(), looks.load(), gaps.load()])
    vm.form.model = 'claude-haiku-5-5'
    await vm.save()

    vm.askClear()
    expect(vm.clearOpen.value).toBe(true)
    vm.setClearOpen(false)
    expect(wardrobe.items.length).toBeGreaterThan(0)

    vm.askClear()
    await vm.confirmClear()
    expect(vm.clearOpen.value).toBe(false)
    expect(wardrobe.items).toEqual([])
    expect(looks.looks).toEqual([])
    expect(looks.todayLook).toBeNull()
    expect(gaps.report).toBeNull()
    expect(vm.savedMessage.value).toMatch(/fresh/i)
    expect(vm.view.value?.model).toBe('claude-haiku-5-5')
  })
})
