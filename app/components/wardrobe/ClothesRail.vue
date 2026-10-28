<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import { useClothesRail } from '~/services/components/wardrobe/ClothesRail.service'

const props = defineProps<{ items: Item[]; category: CategoryId }>()
defineEmits<{ open: [id: string] }>()
const vm = useClothesRail(props)
// Template ref for the carousel viewport (owned by the service).
const emblaRef = vm.emblaRef
</script>

<template>
  <div
    class="relative h-full"
    role="region"
    aria-roledescription="carousel"
    aria-label="Clothes in this closet"
    tabindex="0"
    @keydown="vm.onKeydown"
  >
    <!-- Rail or shelf -->
    <div
      v-if="vm.storage.value === 'hang'"
      class="absolute inset-x-6 top-10 h-[5px] rounded-full bg-[linear-gradient(180deg,#E8D7B3,#C9A96E_60%,#A88B52)] shadow-[0_2px_4px_rgb(0_0_0/0.12)]"
      data-testid="rail"
    />
    <div
      v-else
      class="absolute inset-x-0 bottom-[84px] h-3 bg-[linear-gradient(180deg,#F6EFE8,#E2D6CB)] shadow-[0_8px_14px_-6px_rgb(46_42_40/0.25)]"
      data-testid="shelf"
    />

    <div ref="emblaRef" class="h-full cursor-grab overflow-hidden active:cursor-grabbing" data-testid="rail-viewport">
      <div class="flex h-full px-10">
        <div
          v-for="item in items"
          :key="item.id"
          class="relative flex h-full w-[280px] shrink-0 flex-col items-center select-none"
          :class="vm.storage.value === 'hang' ? 'pt-[38px]' : 'justify-end pb-[96px]'"
          data-testid="rail-item"
        >
          <WardrobeHanger v-if="vm.storage.value === 'hang'" class="-mb-1 shrink-0" />
          <button type="button" class="contents" :aria-label="`Open ${item.name}`" @click="$emit('open', item.id)">
          <img
            :src="item.cleanImage"
            :alt="item.name"
            class="garment h-auto"
            :class="vm.storage.value === 'hang' ? 'max-h-[min(56vh,460px)] w-[250px]' : 'max-h-[min(32vh,260px)] w-[210px]'"
            draggable="false"
          >
          </button>
          <p
            class="max-w-[200px] truncate text-center text-xs tracking-wide text-taupe"
            :class="vm.storage.value === 'hang' ? 'mt-3' : 'absolute bottom-[56px]'"
          >
            {{ item.name }}
          </p>
        </div>
      </div>
    </div>

    <button
      v-if="vm.canPrev.value"
      type="button"
      aria-label="Previous clothes"
      class="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-soft transition hover:bg-surface"
      @click="vm.prev"
    >
      <Icon name="lucide:chevron-left" class="size-5" />
    </button>
    <button
      v-if="vm.canNext.value"
      type="button"
      aria-label="Next clothes"
      class="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-ink shadow-soft transition hover:bg-surface"
      @click="vm.next"
    >
      <Icon name="lucide:chevron-right" class="size-5" />
    </button>
  </div>
</template>
