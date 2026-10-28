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
      </div>

      <div class="flex flex-col gap-4">
        <div>
          <label for="item-name" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Name</label>
          <input
            id="item-name"
            v-model="vm.form.name"
            type="text"
            placeholder="e.g. Blush Silk Blouse"
            class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
            :aria-invalid="Boolean(vm.errors.value.name)"
          >
          <p v-if="vm.errors.value.name" class="mt-1 text-xs text-rose">{{ vm.errors.value.name }}</p>
        </div>

        <fieldset>
          <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Category</legend>
          <div class="flex flex-wrap gap-2">
            <UiChip
              v-for="option in vm.options.categories"
              :key="option.value"
              :selected="vm.form.category === option.value"
              @click="vm.setCategory(option.value)"
            >
              {{ option.label }}
            </UiChip>
          </div>
          <p v-if="vm.errors.value.category" class="mt-1 text-xs text-rose">{{ vm.errors.value.category }}</p>
        </fieldset>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-1">
            <label for="item-colors" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Colours</label>
            <input id="item-colors" v-model="vm.form.colors" type="text" placeholder="blush, cream" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
          </div>
          <div>
            <label for="item-brand" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Brand</label>
            <input id="item-brand" v-model="vm.form.brand" type="text" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
          </div>
          <div>
            <label for="item-size" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Size</label>
            <input id="item-size" v-model="vm.form.size" type="text" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
          </div>
        </div>

        <fieldset>
          <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Seasons</legend>
          <div class="flex flex-wrap gap-2">
            <UiChip
              v-for="option in vm.options.seasons"
              :key="option.value"
              :selected="vm.form.seasons.includes(option.value)"
              @click="vm.toggle('seasons', option.value)"
            >
              {{ option.label }}
            </UiChip>
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Occasions</legend>
          <div class="flex flex-wrap gap-2">
            <UiChip
              v-for="option in vm.options.occasions"
              :key="option.value"
              :selected="vm.form.occasions.includes(option.value)"
              @click="vm.toggle('occasions', option.value)"
            >
              {{ option.label }}
            </UiChip>
          </div>
        </fieldset>

        <div>
          <label for="item-notes" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Notes</label>
          <textarea id="item-notes" v-model="vm.form.notes" rows="2" class="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm focus:border-blush focus:outline-none" />
        </div>

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
