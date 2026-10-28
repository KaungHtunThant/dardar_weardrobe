<script setup lang="ts">
import type { Item } from '#shared/models/item'
import { useItemCard } from '~/services/components/wardrobe/ItemCard.service'

const props = defineProps<{ item: Item }>()
const vm = useItemCard(props)
</script>

<template>
  <article class="group" data-testid="item-card">
    <div class="aspect-[4/5] rounded-2xl bg-surface p-[12%] shadow-soft transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-14px_rgb(46_42_40/0.25)]">
      <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full transition-transform duration-500 ease-soft group-hover:scale-[1.03]" draggable="false" >
    </div>
    <h3 class="mt-3 truncate px-1 text-sm text-ink">{{ item.name }}</h3>
    <p class="truncate px-1 text-xs text-taupe">{{ vm.meta.value }}</p>
  </article>
</template>
