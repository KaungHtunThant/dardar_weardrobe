<script setup lang="ts">
import type { Item } from '#shared/models/item'
import type { FillOption } from '~/services/pages/studio.service'

defineProps<{ pinned: Item[]; aiSlots: FillOption[] }>()
defineEmits<{ unpin: [id: string] }>()
</script>

<template>
  <div class="grid grid-cols-3 gap-3" data-testid="look-board">
    <div v-for="item in pinned" :key="item.id" class="group relative aspect-square rounded-2xl bg-cream p-3">
      <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full" draggable="false" >
      <button
        type="button"
        :aria-label="`Remove ${item.name}`"
        class="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-surface/90 text-taupe opacity-0 shadow-soft transition-opacity group-hover:opacity-100 hover:text-ink focus:opacity-100"
        @click="$emit('unpin', item.id)"
      >
        <Icon name="lucide:x" class="size-3.5" />
      </button>
    </div>
    <div
      v-for="slot in aiSlots"
      :key="slot.id"
      class="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-blush/70 text-center"
      data-testid="ai-slot"
    >
      <Icon name="lucide:sparkles" class="size-4 text-rose" />
      <span class="text-[0.7rem] tracking-wide text-taupe">AI picks<br>{{ slot.label.toLowerCase() }}</span>
    </div>
    <p v-if="!pinned.length && !aiSlots.length" class="col-span-3 py-8 text-center text-sm text-taupe">
      Pick a piece or let the AI fill a category.
    </p>
  </div>
</template>
