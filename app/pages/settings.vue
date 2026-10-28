<script setup lang="ts">
import { useSettingsPage } from '~/services/pages/settings.service'

const vm = useSettingsPage()
</script>

<template>
  <div class="mx-auto max-w-3xl px-10 pt-10 pb-24">
    <h1 class="font-display text-4xl font-medium text-ink">Settings</h1>
    <p class="mt-1 text-sm text-taupe">Choose who styles and judges your looks.</p>

    <p v-if="vm.error.value" role="alert" class="mt-6 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">{{ vm.error.value }}</p>

    <section aria-labelledby="stylist-title" class="mt-10">
      <h2 id="stylist-title" class="mb-4 font-display text-2xl text-ink">Your stylist</h2>
      <div role="radiogroup" aria-labelledby="stylist-title" class="grid gap-3">
        <button
          v-for="mode in vm.modes.value"
          :key="mode.value"
          type="button"
          role="radio"
          :aria-checked="vm.form.advisor === mode.value"
          class="flex items-start gap-4 rounded-2xl border bg-surface p-5 text-left transition-colors duration-200"
          :class="vm.form.advisor === mode.value ? 'border-blush ring-1 ring-blush' : 'border-line hover:border-blush/60'"
          @click="vm.selectAdvisor(mode.value)"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-rose">
            <Icon :name="mode.icon" class="size-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-display text-xl text-ink">{{ mode.title }}</span>
            <span class="block text-sm text-taupe">{{ mode.description }}</span>
            <span class="mt-1.5 block text-xs text-ink/70" :data-testid="`status-${mode.value}`">{{ mode.status }}</span>
          </span>
          <span
            class="mt-1 grid size-5 shrink-0 place-items-center rounded-full border"
            :class="vm.form.advisor === mode.value ? 'border-rose bg-rose text-white' : 'border-line'"
          >
            <Icon v-if="vm.form.advisor === mode.value" name="lucide:check" class="size-3" />
          </span>
        </button>
      </div>
      <p v-if="vm.warning.value" class="mt-3 rounded-xl bg-cream px-4 py-3 text-sm text-ink" data-testid="settings-warning">{{ vm.warning.value }}</p>
    </section>

    <section v-if="vm.form.advisor !== 'offline'" aria-labelledby="model-title" class="mt-10">
      <h2 id="model-title" class="mb-4 font-display text-2xl text-ink">Model</h2>
      <label for="model" class="sr-only">Claude model</label>
      <select
        id="model"
        v-model="vm.form.model"
        class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink focus:border-blush focus:outline-none"
      >
        <option v-for="m in vm.models" :key="m.value" :value="m.value">{{ m.label }} — {{ m.hint }}</option>
      </select>

      <template v-if="vm.form.advisor === 'claude-api'">
        <p class="mt-6 mb-2 text-xs uppercase tracking-[0.2em] text-taupe">Effort</p>
        <UiSegmented
          label="Effort"
          :model-value="vm.form.effort"
          :options="vm.efforts"
          @update:model-value="vm.setEffort"
        />
        <p class="mt-2 text-xs text-taupe">Higher effort thinks harder: sharper critiques, but slower and pricier.</p>
      </template>
    </section>

    <section v-if="vm.form.advisor === 'claude-api'" aria-labelledby="key-title" class="mt-10">
      <h2 id="key-title" class="mb-1 font-display text-2xl text-ink">API key</h2>
      <p class="mb-4 text-sm text-taupe" data-testid="key-status">{{ vm.keyStatus.value }}</p>
      <div class="flex gap-2">
        <label for="api-key" class="sr-only">Anthropic API key</label>
        <input
          id="api-key"
          v-model="vm.apiKeyInput.value"
          type="password"
          autocomplete="off"
          placeholder="sk-ant-…"
          class="h-11 flex-1 rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
        >
        <button
          v-if="vm.view.value?.apiKey.source === 'stored'"
          type="button"
          class="h-11 rounded-full px-5 text-sm text-taupe transition-colors hover:text-ink"
          @click="vm.removeKey"
        >
          Remove key
        </button>
      </div>
      <p class="mt-2 text-xs text-taupe">{{ vm.keyStorageNote.value }}</p>
    </section>

    <div class="mt-10 flex items-center gap-4">
      <button
        type="button"
        :disabled="!vm.dirty.value || vm.saving.value"
        class="h-11 rounded-full bg-rose px-7 text-sm font-medium tracking-wide text-white transition-colors hover:bg-[#ad6b72] disabled:opacity-50"
        @click="vm.save"
      >
        {{ vm.saving.value ? 'Saving…' : 'Save settings' }}
      </button>
      <p v-if="vm.savedMessage.value" role="status" class="text-sm text-taupe">{{ vm.savedMessage.value }}</p>
    </div>

    <section aria-labelledby="fresh-title" class="mt-16 border-t border-line/70 pt-10">
      <h2 id="fresh-title" class="font-display text-2xl text-ink">Start fresh</h2>
      <p class="mt-1 max-w-xl text-sm text-taupe">
        Delete every piece, photo and look from this computer and begin with an empty wardrobe. Your stylist settings and API key are kept.
      </p>
      <button
        type="button"
        class="mt-4 h-11 rounded-full border border-rose/60 px-6 text-sm text-rose transition-colors hover:bg-blush-soft"
        @click="vm.askClear"
      >
        Clear wardrobe…
      </button>
    </section>

    <UiDialog
      :open="vm.clearOpen.value"
      size="sm"
      title="Clear your wardrobe?"
      description="This permanently deletes every piece, photo and look. It can't be undone."
      @update:open="vm.setClearOpen"
    >
      <p v-if="vm.clearError.value" role="alert" class="mb-4 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">{{ vm.clearError.value }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="h-11 rounded-full px-6 text-sm text-taupe transition-colors hover:text-ink" @click="vm.setClearOpen(false)">
          Keep my wardrobe
        </button>
        <button
          type="button"
          :disabled="vm.clearing.value"
          class="h-11 rounded-full bg-rose px-6 text-sm font-medium text-white transition-colors hover:bg-[#ad6b72] disabled:opacity-60"
          @click="vm.confirmClear"
        >
          {{ vm.clearing.value ? 'Deleting…' : 'Delete everything' }}
        </button>
      </div>
    </UiDialog>
  </div>
</template>
