<script setup lang="ts">
import type { ClosetSummary } from '~/services/pages/wardrobe/index.service'

defineProps<{ closet: ClosetSummary }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    class="group flex h-full min-h-0 flex-col text-left"
    :aria-label="`Open ${closet.category.label} closet, ${closet.count} pieces`"
    data-testid="closet-tile"
    @click="$emit('open')"
  >
    <div class="relative min-h-0 w-full flex-1 rounded-2xl bg-[linear-gradient(180deg,#EFE6DE,#E9DFD6)] shadow-soft">
      <!-- What you glimpse when the doors fall ajar -->
      <div class="absolute inset-x-[18%] top-[8%] h-[2px] rounded-full bg-taupe/40" />
      <div class="absolute inset-x-[10%] top-[12%] bottom-[10%] flex items-start justify-center gap-1 overflow-hidden">
        <img
          v-for="item in closet.preview"
          :key="item.id"
          :src="item.cleanImage"
          alt=""
          class="garment h-[45%] w-1/3"
          draggable="false"
        >
      </div>
      <WardrobeClosetDoors :open="false" peek class="rounded-2xl" />
      <span class="pointer-events-none absolute top-[5%] left-1/2 -translate-x-1/2 rounded-sm border border-gold/50 bg-[linear-gradient(180deg,#F7EEDC,#E9D8B4)] px-2.5 py-0.5 font-display text-[0.8rem] tracking-wide whitespace-nowrap text-ink/80 shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
        {{ closet.category.label }}
      </span>
    </div>
    <div class="mt-3 px-1">
      <p class="font-display text-xl leading-tight text-ink">{{ closet.category.label }}</p>
      <p class="text-xs text-taupe">{{ closet.countLabel }}</p>
    </div>
  </button>
</template>
