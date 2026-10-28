<script setup lang="ts">
import type { Item } from '#shared/models/item'
import { useLookCollage } from '~/services/components/home/LookCollage.service'

const props = defineProps<{ items: Item[] }>()
const vm = useLookCollage(props)
</script>

<template>
  <div class="grid h-full w-full gap-1" :class="vm.layout.value.grid">
    <div
      v-for="(item, i) in vm.ordered.value"
      :key="item.id"
      class="flex min-h-0 min-w-0 items-center justify-center p-[5%]"
      :class="vm.layout.value.tiles[i]"
    >
      <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full" draggable="false" >
    </div>
  </div>
</template>
