<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import { useAddDialog } from '~/services/components/item/AddDialog.service'

const props = defineProps<{ open: boolean; defaultCategory?: CategoryId }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; saved: [item: Item] }>()
const vm = useAddDialog(props, emit)
</script>

<template>
  <UiDialog
    :open="open"
    title="Add to your wardrobe"
    description="Upload a photo — we'll lift the piece off its background so only the garment remains."
    @update:open="$emit('update:open', $event)"
  >
    <!-- Step 1: choose a photo -->
    <div v-if="vm.step.value === 'pick'">
      <label
        class="flex h-[360px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-colors duration-200"
        :class="vm.dragging.value ? 'border-rose bg-blush-soft/60' : 'border-blush/60 bg-surface hover:bg-blush-soft/30'"
        data-testid="photo-drop"
        @dragover.prevent="vm.setDragging(true)"
        @dragleave="vm.setDragging(false)"
        @drop.prevent="vm.onDrop"
      >
        <Icon name="lucide:image-plus" class="size-8 text-rose" />
        <span class="font-display text-2xl text-ink">Drop a photo of your piece</span>
        <span class="text-sm text-taupe">or <span class="text-rose underline underline-offset-4">browse your files</span></span>
        <input type="file" accept="image/*" class="sr-only" aria-label="Choose a photo" @change="vm.onInputChange" >
      </label>
      <p v-if="vm.photoError.value" role="alert" class="mt-3 text-sm text-rose">{{ vm.photoError.value }}</p>
    </div>

    <!-- Step 2: background removal -->
    <div v-else-if="vm.step.value === 'processing'" class="flex h-[360px] flex-col items-center justify-center gap-4" aria-live="polite">
      <div class="relative size-56 overflow-hidden rounded-2xl bg-surface p-4">
        <img v-if="vm.originalImage.value" :src="vm.originalImage.value" alt="" class="h-full w-full object-contain opacity-70" >
        <Icon v-else name="lucide:shirt" class="absolute inset-0 m-auto size-14 text-blush" />
        <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgb(243_227_225/0.9),transparent)] animate-[shimmer_1.4s_ease-in-out_infinite]" />
      </div>
      <p class="flex items-center gap-2 font-display text-2xl text-ink">
        <Icon name="lucide:loader-circle" class="size-5 animate-spin text-rose" /> Removing background…
      </p>
      <p class="text-sm text-taupe">Isolating your garment</p>
    </div>

    <!-- Step 3: details -->
    <form v-else class="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8" novalidate @submit.prevent="vm.submit">
      <div class="flex flex-col">
        <div class="flex min-h-[340px] flex-1 items-center justify-center rounded-2xl bg-surface p-8">
          <img :src="vm.cleanImage.value" alt="Your garment, background removed" class="garment max-h-[360px] w-full" data-testid="clean-preview" >
        </div>
        <button type="button" class="mt-3 self-start text-sm text-taupe underline-offset-4 hover:text-ink hover:underline" @click="vm.startOver">
          Use a different photo
        </button>
        <p v-if="vm.photoError.value" class="mt-2 text-xs text-rose">{{ vm.photoError.value }}</p>
      </div>

      <div class="flex flex-col gap-4">
        <p v-if="vm.suggesting.value" class="flex items-center gap-2 text-xs text-taupe" aria-live="polite" data-testid="suggesting">
          <Icon name="lucide:sparkles" class="size-3.5 animate-pulse text-rose" /> Your stylist is looking at this piece…
        </p>
        <p
          v-else-if="vm.suggestionNote.value"
          class="flex items-center gap-2 text-xs"
          :class="vm.suggested.value ? 'text-rose' : 'text-taupe'"
          aria-live="polite"
          data-testid="suggestion-note"
        >
          <Icon :name="vm.suggested.value ? 'lucide:sparkles' : 'lucide:info'" class="size-3.5" /> {{ vm.suggestionNote.value }}
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
