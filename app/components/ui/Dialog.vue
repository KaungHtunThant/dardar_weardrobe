<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

defineProps<{ open: boolean; title: string; description?: string }>()
defineEmits<{ 'update:open': [open: boolean] }>()
</script>

<template>
  <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_250ms_ease-out]" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(960px,calc(100vw-4rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-ivory p-8 shadow-[0_30px_80px_-20px_rgb(46_42_40/0.35)] focus:outline-none data-[state=open]:animate-[dialog-in_300ms_var(--ease-soft)]"
      >
        <div class="mb-6 flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="font-display text-3xl font-medium text-ink">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-taupe">{{ description }}</DialogDescription>
          </div>
          <DialogClose aria-label="Close" class="grid size-9 place-items-center rounded-full text-taupe transition-colors hover:bg-cream hover:text-ink">
            <Icon name="lucide:x" class="size-5" />
          </DialogClose>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
