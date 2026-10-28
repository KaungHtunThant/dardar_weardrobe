import { computed, reactive, ref, watch } from 'vue'
import { DEFAULT_MODEL, type AdvisorMode, type Settings } from '#shared/models/settings'
import { useSettingsStore } from '~/stores/settings'
import { useStyleMatchesStore } from '~/stores/styleMatches'
import { useWardrobeStore } from '~/stores/wardrobe'
import { onViewMounted } from '~/services/lifecycle'

export interface ModeOption {
  value: AdvisorMode
  title: string
  description: string
  icon: string
  status: string
}

const MODELS = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Best taste and judgement (default)' },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Faster, still sharp' },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest and cheapest' },
]

const EFFORTS = [
  { value: 'low', label: 'Low', icon: 'lucide:feather' },
  { value: 'medium', label: 'Medium', icon: 'lucide:gauge' },
  { value: 'high', label: 'High', icon: 'lucide:flame' },
]
type Effort = Settings['effort']

/** Settings page controller: choose the stylist (Claude CLI / API / Offline), model, effort and API key. */
export function useSettingsPage() {
  const store = useSettingsStore()
  const form = reactive<Settings>({ advisor: 'offline', model: DEFAULT_MODEL, effort: 'medium' })
  const apiKeyInput = ref('')
  const savedMessage = ref<string | null>(null)
  const clearOpen = ref(false)
  const clearing = ref(false)
  const clearError = ref<string | null>(null)

  function syncForm() {
    if (!store.view) return
    form.advisor = store.view.advisor
    form.model = store.view.model
    form.effort = store.view.effort
  }
  watch(() => store.view, syncForm)

  const view = computed(() => store.view)
  const keyStatus = computed(() => {
    const key = view.value?.apiKey
    if (!key?.present) return 'No key yet'
    return key.source === 'env' ? `Using ANTHROPIC_API_KEY from the environment (••••${key.last4})` : `Key saved (••••${key.last4})`
  })

  const modes = computed<ModeOption[]>(() => {
    const cli = view.value?.cli
    return [
      {
        value: 'claude-cli',
        title: 'Claude Code CLI',
        description: 'Uses your Claude Code login on this computer. No API key needed.',
        icon: 'lucide:terminal',
        status: cli?.available ? `Detected (v${cli.version})` : 'Not found on this computer',
      },
      {
        value: 'claude-api',
        title: 'Anthropic API',
        description: 'Pay as you go with your own API key.',
        icon: 'lucide:key-round',
        status: keyStatus.value,
      },
      {
        value: 'offline',
        title: 'Offline',
        description: 'Built-in styling rules. Free and private, but not real AI.',
        icon: 'lucide:wifi-off',
        status: 'Always available',
      },
    ]
  })

  const warning = computed(() => {
    if (form.advisor === 'claude-cli' && !view.value?.cli.available)
      return "The Claude CLI wasn't found on this computer. Install Claude Code and sign in, or pick another stylist."
    if (form.advisor === 'claude-api' && !view.value?.apiKey.present && !apiKeyInput.value.trim())
      return 'Add an API key below to use the Anthropic API.'
    return null
  })

  const dirty = computed(
    () =>
      Boolean(apiKeyInput.value.trim()) ||
      (view.value !== null && (form.advisor !== view.value.advisor || form.model !== view.value.model || form.effort !== view.value.effort)),
  )

  const keyStorageNote = computed(() =>
    view.value?.secureStorage
      ? 'Encrypted with your system keychain. It never leaves this computer except to call Anthropic.'
      : 'Stored in a private file in the app data folder (development mode). It never leaves this computer except to call Anthropic.',
  )

  function flash(text: string) {
    savedMessage.value = text
    setTimeout(() => {
      if (savedMessage.value === text) savedMessage.value = null
    }, 2500)
  }

  async function save() {
    const key = apiKeyInput.value.trim()
    const ok = await store.update({ ...form, ...(key ? { apiKey: key } : {}) })
    if (ok) {
      apiKeyInput.value = ''
      flash('Saved')
    }
  }

  async function removeKey() {
    if (await store.update({ apiKey: null })) flash('Key removed')
  }

  function selectAdvisor(mode: AdvisorMode) {
    form.advisor = mode
  }

  function setEffort(value: string) {
    form.effort = value as Effort
  }

  function askClear() {
    clearError.value = null
    clearOpen.value = true
  }

  function setClearOpen(open: boolean) {
    if (!clearing.value) clearOpen.value = open
  }

  /** Start fresh: every piece, photo and look is deleted; settings and the API key stay. */
  async function confirmClear() {
    clearing.value = true
    clearError.value = null
    try {
      await useWardrobeStore().clearAll()
      useStyleMatchesStore().forget()
      clearOpen.value = false
      flash('Your wardrobe is fresh and empty.')
    } catch (e) {
      clearError.value = e instanceof Error ? e.message : String(e)
    } finally {
      clearing.value = false
    }
  }

  async function init() {
    await store.load()
    syncForm()
  }

  onViewMounted(init)

  return {
    form,
    apiKeyInput,
    savedMessage,
    view,
    modes,
    models: MODELS,
    efforts: EFFORTS,
    keyStatus,
    keyStorageNote,
    warning,
    dirty,
    saving: computed(() => store.saving),
    error: computed(() => store.error),
    init,
    selectAdvisor,
    setEffort,
    save,
    removeKey,
    clearOpen,
    clearing,
    clearError,
    askClear,
    setClearOpen,
    confirmClear,
  }
}
