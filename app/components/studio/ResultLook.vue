<script setup lang="ts">
import type { Item } from '#shared/models/item'

defineProps<{ items: { item: Item; isAi: boolean }[] }>()
</script>

<template>
  <ul class="grid grid-cols-3 gap-4" data-testid="result-look">
    <li v-for="{ item, isAi } in items" :key="item.id" class="relative" :data-ai="isAi">
      <div class="aspect-[4/5] rounded-2xl bg-cream p-[12%]">
        <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full" draggable="false" >
      </div>
      <span
        v-if="isAi"
        class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[0.65rem] tracking-wide text-rose shadow-soft"
      >
        <Icon name="lucide:sparkles" class="size-3" /> AI pick
      </span>
      <p class="mt-2 truncate px-1 text-xs text-ink">{{ item.name }}</p>
    </li>
  </ul>
</template>
