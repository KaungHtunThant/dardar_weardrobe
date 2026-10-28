<script setup lang="ts">
import type { Item } from '#shared/models/item'
import { useItemCard } from '~/services/components/wardrobe/ItemCard.service'

const props = defineProps<{ item: Item }>()
defineEmits<{ open: [id: string] }>()
const vm = useItemCard(props)
</script>

<template>
  <article class="group relative" data-testid="item-card">
    <button type="button" class="absolute inset-0 z-10 rounded-2xl" :aria-label="`Open ${item.name}`" @click="$emit('open', item.id)" />
    <div class="aspect-[4/5] rounded-2xl bg-surface p-[12%] shadow-soft transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-14px_rgb(46_42_40/0.25)]">
      <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full transition-transform duration-500 ease-soft group-hover:scale-[1.03]" draggable="false" >
    </div>
    <h3 class="mt-3 truncate px-1 text-sm text-ink">{{ item.name }}</h3>
    <p class="truncate px-1 text-xs text-taupe">{{ vm.meta.value }}</p>
  </article>
</template>
