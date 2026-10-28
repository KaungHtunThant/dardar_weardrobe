<script setup lang="ts">
import { useDetailSheet } from '~/services/components/item/DetailSheet.service'

const props = defineProps<{ itemId: string | null }>()
const emit = defineEmits<{ close: [] }>()
const vm = useDetailSheet(props, emit)
// The photo upload state is owned by the service.
const upload = vm.upload
</script>

<template>
  <UiSheet :open="vm.open.value" :title="vm.item.value?.name ?? ''" @update:open="vm.setOpen">
    <template v-if="vm.item.value">
      <p v-if="vm.error.value" role="alert" class="mb-4 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">{{ vm.error.value }}</p>

      <!-- View -->
      <template v-if="vm.mode.value === 'view'">
        <div class="mt-2 flex h-[42vh] items-center justify-center rounded-3xl bg-surface p-[9%]" data-testid="sheet-image">
          <img :src="vm.item.value.cleanImage" :alt="vm.item.value.name" class="garment max-h-full max-w-full" draggable="false" >
        </div>
        <dl class="mt-6 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5 text-sm">
          <template v-for="fact in vm.facts.value" :key="fact.label">
            <dt class="text-xs uppercase tracking-[0.18em] text-taupe">{{ fact.label }}</dt>
            <dd class="text-ink">{{ fact.value }}</dd>
          </template>
        </dl>
        <p v-if="vm.item.value.notes" class="mt-4 rounded-2xl bg-cream px-4 py-3 text-sm text-ink">{{ vm.item.value.notes }}</p>
        <p class="mt-4 text-xs text-taupe" data-testid="looks-count">
          In {{ vm.looksCount.value }} {{ vm.looksCount.value === 1 ? 'look' : 'looks' }}
        </p>
        <div class="mt-6 flex flex-wrap gap-2">
          <button type="button" class="h-10 rounded-full bg-rose px-5 text-sm font-medium text-white transition-colors hover:bg-[#ad6b72]" @click="vm.edit">
            Edit details
          </button>
          <button type="button" class="h-10 rounded-full border border-line bg-surface px-5 text-sm text-ink transition-colors hover:border-blush" @click="vm.startReplacePhoto">
            Replace photo
          </button>
          <button type="button" class="h-10 rounded-full px-5 text-sm text-rose transition-colors hover:bg-blush-soft" @click="vm.askDelete">
            Delete
          </button>
        </div>
      </template>

      <!-- Edit -->
      <form v-else-if="vm.mode.value === 'edit'" class="mt-2" novalidate @submit.prevent="vm.save">
        <ItemDetailsForm :form="vm.itemForm" />
        <div class="sticky -bottom-8 -mx-1 mt-6 flex justify-end gap-3 bg-ivory/95 px-1 py-4 backdrop-blur">
          <button type="button" class="h-10 rounded-full px-5 text-sm text-taupe hover:text-ink" @click="vm.cancel">Cancel</button>
          <button type="submit" :disabled="vm.busy.value" class="h-10 rounded-full bg-rose px-6 text-sm font-medium text-white hover:bg-[#ad6b72] disabled:opacity-60">
            {{ vm.busy.value ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </form>

      <!-- Replace photo -->
      <div v-else class="mt-2">
        <label
          v-if="upload.stage.value === 'pick'"
          class="flex h-[42vh] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed text-center transition-colors"
          :class="upload.dragging.value ? 'border-rose bg-blush-soft/60' : 'border-blush/60 bg-surface hover:bg-blush-soft/30'"
          @dragover.prevent="upload.setDragging(true)"
          @dragleave="upload.setDragging(false)"
          @drop.prevent="upload.onDrop"
        >
          <Icon name="lucide:image-plus" class="size-8 text-rose" />
          <span class="font-display text-2xl text-ink">Drop a new photo</span>
          <span class="text-sm text-taupe">or <span class="text-rose underline underline-offset-4">browse your files</span></span>
          <input type="file" accept="image/*" class="sr-only" aria-label="Choose a new photo" @change="upload.onInputChange" >
        </label>
        <div v-else-if="upload.stage.value === 'processing'" class="grid h-[42vh] place-items-center rounded-3xl bg-surface" aria-live="polite">
          <p class="flex items-center gap-2 font-display text-2xl text-ink">
            <Icon name="lucide:loader-circle" class="size-5 animate-spin text-rose" /> Removing background…
          </p>
        </div>
        <div v-else class="flex h-[42vh] items-center justify-center rounded-3xl bg-surface p-[9%]">
          <img :src="upload.cleanImage.value" alt="New photo, background removed" class="garment max-h-full max-w-full" data-testid="new-photo" >
        </div>
        <p v-if="upload.photoError.value" class="mt-2 text-xs text-rose">{{ upload.photoError.value }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="h-10 rounded-full px-5 text-sm text-taupe hover:text-ink" @click="vm.cancel">Cancel</button>
          <button
            type="button"
            :disabled="upload.stage.value !== 'ready' || vm.busy.value"
            class="h-10 rounded-full bg-rose px-6 text-sm font-medium text-white hover:bg-[#ad6b72] disabled:opacity-50"
            @click="vm.confirmPhoto"
          >
            Use this photo
          </button>
        </div>
      </div>
    </template>

    <UiDialog :open="vm.deleteOpen.value" size="sm" :title="`Delete ${vm.item.value?.name ?? 'this piece'}?`" :description="vm.deleteMessage.value" @update:open="vm.setDeleteOpen">
      <div class="flex justify-end gap-3">
        <button type="button" class="h-11 rounded-full px-6 text-sm text-taupe hover:text-ink" @click="vm.setDeleteOpen(false)">Keep it</button>
        <button
          type="button"
          :disabled="vm.busy.value"
          class="h-11 rounded-full bg-rose px-6 text-sm font-medium text-white hover:bg-[#ad6b72] disabled:opacity-60"
          @click="vm.confirmDelete"
        >
          {{ vm.busy.value ? 'Deleting…' : 'Delete piece' }}
        </button>
      </div>
    </UiDialog>
  </UiSheet>
</template>
