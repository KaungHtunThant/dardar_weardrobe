<script setup lang="ts">
import type { LookWithItems } from '~/services/pages/index.service'

defineProps<{ entry: LookWithItems; dateLabel: string }>()
defineEmits<{ 'toggle-favourite': [id: string] }>()
</script>

<template>
  <section aria-labelledby="today-title" class="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center gap-12">
    <div class="pl-2">
      <p class="text-[0.7rem] uppercase tracking-[0.25em] text-taupe">Today's recommendation</p>
      <p class="mt-1 font-display text-lg italic text-taupe">{{ dateLabel }}</p>
      <h1 id="today-title" class="mt-3 font-display text-6xl leading-[1.05] font-medium text-ink">{{ entry.look.title }}</h1>
      <p class="mt-5 max-w-md text-[0.95rem] leading-relaxed text-taupe">{{ entry.look.explanation }}</p>
      <p v-if="entry.look.prompt" class="mt-4 inline-flex items-center gap-2 rounded-full bg-blush-soft px-3 py-1 text-xs text-rose">
        <Icon name="lucide:quote" class="size-3" /> {{ entry.look.prompt }}
      </p>
      <div class="mt-8 flex items-center gap-3">
        <UiHeartButton
          :active="entry.look.isFavourite"
          :label="entry.look.isFavourite ? 'Remove from favourites' : 'Save to favourites'"
          class="border border-line"
          @click="$emit('toggle-favourite', entry.look.id)"
        />
        <ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-taupe">
          <li v-for="item in entry.items" :key="item.id">{{ item.name }}</li>
        </ul>
      </div>
    </div>
    <div class="h-[440px] rounded-[2rem] bg-cream p-6" data-testid="today-collage">
      <HomeLookCollage :items="entry.items" />
    </div>
  </section>
</template>
