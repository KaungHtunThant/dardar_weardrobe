<script setup lang="ts">
import { useLookCard } from '~/services/components/home/LookCard.service'
import type { LookWithItems } from '~/services/pages/index.service'

const props = defineProps<{ entry: LookWithItems; actions?: boolean }>()
defineEmits<{ 'toggle-favourite': [id: string]; open: [id: string]; delete: [id: string] }>()
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
    <div v-if="actions" class="mt-2 flex gap-1 px-1">
      <button
        type="button"
        class="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs text-ink transition-colors hover:border-blush"
        :aria-label="`Open ${entry.look.title} in the Studio`"
        @click="$emit('open', entry.look.id)"
      >
        <Icon name="lucide:wand-sparkles" class="size-3.5 text-rose" /> Open in Studio
      </button>
      <button
        type="button"
        class="h-8 rounded-full px-3 text-xs text-taupe transition-colors hover:bg-blush-soft hover:text-rose"
        :aria-label="`Delete ${entry.look.title}`"
        @click="$emit('delete', entry.look.id)"
      >
        Delete
      </button>
    </div>
  </article>
</template>
