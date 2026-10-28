<script setup lang="ts">
import { useLookCard } from '~/services/components/home/LookCard.service'
import type { LookWithItems } from '~/services/pages/index.service'

const props = defineProps<{ entry: LookWithItems }>()
defineEmits<{ 'toggle-favourite': [id: string] }>()
const vm = useLookCard(props)
</script>

<template>
  <article class="group flex flex-col" data-testid="look-card">
    <div class="aspect-[4/5] overflow-hidden rounded-2xl bg-surface p-3 shadow-soft transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-14px_rgb(46_42_40/0.25)]">
      <HomeLookCollage :items="entry.items" />
    </div>
    <div class="mt-3 flex items-start justify-between gap-2 px-1">
      <div class="min-w-0">
        <h3 class="truncate font-display text-xl leading-tight text-ink">{{ entry.look.title }}</h3>
        <p class="mt-0.5 text-xs text-taupe">
          {{ vm.piecesLabel.value }} · {{ vm.dateLabel.value }}<template v-if="vm.scoreLabel.value"> · <span class="text-ink">{{ vm.scoreLabel.value }}</span></template>
        </p>
      </div>
      <UiHeartButton
        :active="entry.look.isFavourite"
        :label="entry.look.isFavourite ? `Remove ${entry.look.title} from favourites` : `Add ${entry.look.title} to favourites`"
        class="-mt-1 shrink-0"
        @click="$emit('toggle-favourite', entry.look.id)"
      />
    </div>
  </article>
</template>
