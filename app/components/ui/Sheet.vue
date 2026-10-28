<script setup lang="ts">
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

defineProps<{ open: boolean; title: string }>()
defineEmits<{ 'update:open': [open: boolean] }>()
</script>

<template>
  <DialogRoot :open="open" @update:open="$emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px] data-[state=open]:animate-[fade-in_250ms_ease-out]" />
      <DialogContent
        class="fixed inset-y-0 right-0 z-50 flex w-[min(480px,100vw)] flex-col bg-ivory shadow-[-20px_0_60px_-20px_rgb(46_42_40/0.3)] focus:outline-none data-[state=open]:animate-[sheet-in_350ms_var(--ease-soft)]"
      >
        <div class="flex shrink-0 items-center justify-between gap-4 px-7 pt-6 pb-2">
          <DialogTitle class="truncate font-display text-3xl font-medium text-ink">{{ title }}</DialogTitle>
          <DialogClose aria-label="Close" class="grid size-9 shrink-0 place-items-center rounded-full text-taupe transition-colors hover:bg-cream hover:text-ink">
            <Icon name="lucide:x" class="size-5" />
          </DialogClose>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-7 pb-8">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
