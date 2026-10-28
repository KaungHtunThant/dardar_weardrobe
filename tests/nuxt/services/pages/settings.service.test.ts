import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsPage } from '~/services/pages/settings.service'
import { setupTestGateway } from '../../helpers'

async function ready() {
  const vm = useSettingsPage()
  await vm.init()
  return vm
}

describe('settings page service', () => {
  beforeEach(() => {
    setupTestGateway()
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
  })
})
