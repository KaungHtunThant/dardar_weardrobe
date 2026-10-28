import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SettingsUpdate, SettingsView } from '#shared/models/settings'
import { useGateway } from '~/gateways/provider'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useSettingsStore = defineStore('settings', () => {
  const view = ref<SettingsView | null>(null)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    error.value = null
    try {
      view.value = await useGateway().getSettings()
    } catch (e) {
      error.value = message(e)
    }
  }

  /** Returns whether the update was saved. */
  async function update(change: SettingsUpdate) {
    saving.value = true
    error.value = null
    try {
      view.value = await useGateway().updateSettings(change)
      return true
    } catch (e) {
      error.value = message(e)
      return false
    } finally {
      saving.value = false
    }
  }

  return { view, saving, error, load, update }
})
