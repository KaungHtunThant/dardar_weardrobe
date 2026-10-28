import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsPage } from '~/services/pages/settings.service'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
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
    await Promise.all([wardrobe.load(), looks.load()])
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
    expect(vm.savedMessage.value).toMatch(/fresh/i)
    expect(vm.view.value?.model).toBe('claude-haiku-5-5')
  })
})
