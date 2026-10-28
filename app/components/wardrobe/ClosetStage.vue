<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import { useClosetStage } from '~/services/components/wardrobe/ClosetStage.service'

const props = defineProps<{ category: CategoryId; items: Item[] }>()
const emit = defineEmits<{ close: [] }>()
const vm = useClosetStage(props, emit)
</script>

<template>
  <section class="flex h-full min-h-0 flex-col" :aria-label="`${vm.title.value} closet`" data-testid="closet-stage">
    <div class="mb-4 flex items-center justify-between">
      <button type="button" class="flex items-center gap-1.5 text-sm text-taupe transition-colors hover:text-ink" @click="vm.requestClose">
        <Icon name="lucide:arrow-left" class="size-4" /> All closets
      </button>
      <div class="text-right">
        <h2 class="font-display text-3xl leading-none text-ink">{{ vm.title.value }}</h2>
        <p class="mt-1 text-xs text-taupe">{{ vm.countLabel.value }}</p>
      </div>
    </div>

    <div
      class="relative min-h-0 flex-1 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,#FFFDFB_0%,#F3ECE5_55%,#EDE3DA_100%)] shadow-[inset_0_0_60px_rgb(46_42_40/0.05)]"
    >
      <div
        class="absolute inset-0 transition-[opacity,transform] delay-150 duration-700 ease-soft"
        :class="vm.doorsOpen.value ? 'scale-100 opacity-100' : 'scale-[0.97] opacity-0'"
      >
        <WardrobeClothesRail v-if="items.length" :items="items" :category="category" />
        <div v-else class="grid h-full place-items-center text-center">
          <div>
            <p class="font-display text-2xl text-ink">This closet is empty</p>
            <p class="mt-1 text-sm text-taupe">Add a piece with the button below.</p>
          </div>
        </div>
        <p v-if="items.length" class="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[0.7rem] uppercase tracking-[0.25em] text-taupe/70">
          Drag, swipe or scroll to browse
        </p>
      </div>
      <WardrobeClosetDoors :open="vm.doorsOpen.value" slow class="rounded-[2rem]" />
    </div>
  </section>
</template>
