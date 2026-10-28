<script setup lang="ts">
import type { StyleRating } from '#shared/models/styleMatch'
import type { ResolvedFix } from '~/services/pages/studio.service'

defineProps<{ rating: StyleRating; scoreLabel: string; fixes: ResolvedFix[]; busy: boolean }>()
defineEmits<{ 'apply-fix': [fix: ResolvedFix] }>()
</script>

<template>
  <section aria-labelledby="rating-title" class="rounded-3xl bg-surface p-7 shadow-soft" data-testid="rating-card">
    <p id="rating-title" class="text-[0.7rem] uppercase tracking-[0.25em] text-taupe">The honest verdict</p>
    <div class="mt-3 flex items-end gap-4">
      <p class="font-display text-7xl leading-none font-medium text-ink lining-nums" data-testid="score">{{ scoreLabel }}</p>
    </div>
    <p class="mt-3 font-display text-2xl leading-snug text-ink" data-testid="verdict">{{ rating.verdict }}</p>

    <div class="mt-6 grid gap-5">
      <div v-if="rating.works.length">
        <h3 class="mb-2 text-xs uppercase tracking-[0.2em] text-taupe">What works</h3>
        <ul class="space-y-1.5">
          <li v-for="line in rating.works" :key="line" class="flex gap-2 text-sm text-ink">
            <Icon name="lucide:check" class="mt-0.5 size-4 shrink-0 text-taupe" /> {{ line }}
          </li>
        </ul>
      </div>
      <div v-if="rating.fails.length">
        <h3 class="mb-2 text-xs uppercase tracking-[0.2em] text-taupe">What doesn't</h3>
        <ul class="space-y-1.5">
          <li v-for="line in rating.fails" :key="line" class="flex gap-2 text-sm text-ink">
            <Icon name="lucide:x" class="mt-0.5 size-4 shrink-0 text-rose" /> {{ line }}
          </li>
        </ul>
      </div>
      <div v-if="fixes.length">
        <h3 class="mb-2 text-xs uppercase tracking-[0.2em] text-taupe">Fix it with what you own</h3>
        <ul class="space-y-2">
          <li v-for="fix in fixes" :key="fix.note" class="flex items-center gap-3 rounded-2xl bg-ivory p-2.5 pr-3">
            <div class="flex shrink-0 items-center gap-1">
              <img v-if="fix.removeItem" :src="fix.removeItem.cleanImage" :alt="fix.removeItem.name" class="garment size-10 opacity-50 grayscale" >
              <Icon v-if="fix.removeItem && fix.addItem" name="lucide:arrow-right" class="size-3.5 text-taupe" />
              <img v-if="fix.addItem" :src="fix.addItem.cleanImage" :alt="fix.addItem.name" class="garment size-10" >
            </div>
            <p class="flex-1 text-sm text-ink">{{ fix.note }}</p>
            <button
              type="button"
              :disabled="busy"
              class="shrink-0 rounded-full border border-blush px-3 py-1 text-xs text-rose transition-colors hover:bg-blush-soft disabled:opacity-50"
              @click="$emit('apply-fix', fix)"
            >
              Try it
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
