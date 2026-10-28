<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { Upload } from '#shared/models/upload'
import { useAddDialog } from '~/services/components/item/AddDialog.service'

const props = defineProps<{ open: boolean; defaultCategory?: CategoryId; upload?: Upload | null }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; saved: [item: Item]; queued: [count: number] }>()
const vm = useAddDialog(props, emit)
</script>

<template>
  <UiDialog
    :open="open"
    title="Add to your wardrobe"
    :description="vm.description.value"
    @update:open="$emit('update:open', $event)"
  >
    <!-- Step 1: choose photos (they are prepared in the background) -->
    <div v-if="vm.step.value === 'pick'">
      <label
        class="flex h-[360px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors duration-200"
        :class="vm.dragging.value ? 'border-rose bg-blush-soft/60' : 'border-blush/60 bg-surface hover:bg-blush-soft/30'"
        data-testid="photo-drop"
        @dragover.prevent="vm.setDragging(true)"
        @dragleave="vm.setDragging(false)"
        @drop.prevent="vm.onDrop"
      >
        <template v-if="vm.queuing.value">
          <Icon name="lucide:loader-circle" class="size-8 animate-spin text-rose" />
          <span class="font-display text-2xl text-ink">Handing them to Dardar…</span>
        </template>
        <template v-else>
          <Icon name="lucide:image-plus" class="size-8 text-rose" />
          <span class="font-display text-2xl text-ink">Drop photos of your pieces</span>
          <span class="text-sm text-taupe">or <span class="text-rose underline underline-offset-4">browse your files</span> — add as many as you like</span>
        </template>
        <input type="file" accept="image/*" multiple class="sr-only" aria-label="Choose photos" @change="vm.onInputChange" >
      </label>
      <p v-if="vm.photoError.value" role="alert" class="mt-3 text-sm text-rose">{{ vm.photoError.value }}</p>
    </div>

    <!-- Step 2: review a prepared photo -->
    <form v-else class="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8" novalidate @submit.prevent="vm.submit">
      <div class="flex flex-col">
        <div class="flex min-h-[340px] flex-1 items-center justify-center rounded-2xl bg-surface p-8">
          <img :src="vm.cleanImage.value" alt="Your garment, cut out" class="garment max-h-[360px] w-full" data-testid="clean-preview" >
        </div>
        <button type="button" class="mt-3 self-start text-sm text-taupe underline-offset-4 hover:text-ink hover:underline" @click="vm.discardPhoto">
          Discard this photo
        </button>
        <p v-if="vm.photoError.value" class="mt-2 text-xs text-rose">{{ vm.photoError.value }}</p>
      </div>

      <div class="flex flex-col gap-4">
        <p v-if="vm.suggestionNote.value" class="flex items-center gap-2 text-xs text-rose" aria-live="polite" data-testid="suggestion-note">
          <Icon name="lucide:sparkles" class="size-3.5" /> {{ vm.suggestionNote.value }}
        </p>
        <ItemDetailsForm :form="vm.itemForm" />

        <div class="sticky -bottom-8 -mx-1 -mb-8 flex justify-end gap-3 bg-ivory/95 px-1 pt-3 pb-8 backdrop-blur">
          <button type="button" class="h-11 rounded-full px-6 text-sm text-taupe transition-colors hover:text-ink" @click="vm.close">Cancel</button>
          <button
            type="submit"
            :disabled="vm.saving.value"
            class="h-11 rounded-full bg-rose px-7 text-sm font-medium tracking-wide text-white transition-colors hover:bg-[#ad6b72] disabled:opacity-60"
          >
            {{ vm.saving.value ? 'Saving…' : 'Save to wardrobe' }}
          </button>
        </div>
      </div>
    </form>
  </UiDialog>
</template>
