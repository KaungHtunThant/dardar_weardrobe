<script setup lang="ts">
import { useStudioPage } from '~/services/pages/studio.service'

const vm = useStudioPage()
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Left: the current outfit, each piece floating in its body position -->
    <section class="relative min-w-0 flex-1" aria-label="Outfit">
      <StudioDressForm
        :placed="vm.placed.value"
        :ghosts="vm.ghosts.value"
        :active-category="vm.panelCategory.value"
        @focus="vm.focusCategory"
      />

      <div class="pointer-events-none absolute top-6 left-8 max-w-sm">
        <h1 class="font-display text-4xl font-medium text-ink">Style Studio</h1>
        <p v-if="!vm.result.value" class="mt-1 text-sm text-taupe">Build an outfit, let the AI fill the gaps — then hear the honest truth.</p>
        <template v-else>
          <p class="mt-2 font-display text-2xl text-ink" data-testid="look-title">{{ vm.result.value.title }}</p>
          <p class="text-sm text-taupe">
            <span class="lining-nums">{{ vm.scoreLabel.value }}</span>
            <span v-if="vm.stale.value"> · outfit changed since it was rated</span>
          </p>
        </template>
        <p class="mt-2 text-[0.7rem] tracking-wide text-taupe/80">Scroll to move · Ctrl + scroll to zoom · Click a piece to browse its category</p>
      </div>

      <button
        v-if="vm.placed.value.length"
        type="button"
        class="absolute top-6 right-6 flex items-center gap-1.5 rounded-full bg-surface/90 px-4 py-2 text-sm text-taupe shadow-soft backdrop-blur transition-colors hover:text-ink"
        @click="vm.clearOutfit"
      >
        <Icon name="lucide:rotate-ccw" class="size-4" /> Clear outfit
      </button>
    </section>

    <!-- Right: the wardrobe (or the verdict) and the AI controls -->
    <aside class="flex w-[440px] shrink-0 flex-col border-l border-line/70 bg-surface" aria-label="Wardrobe and styling">
      <div class="flex shrink-0 gap-1 px-4 pt-4" role="tablist" aria-label="Panel">
        <button
          type="button"
          role="tab"
          :aria-selected="vm.panelTab.value === 'wardrobe'"
          class="flex-1 rounded-full py-2 text-sm tracking-wide transition-colors"
          :class="vm.panelTab.value === 'wardrobe' ? 'bg-blush-soft text-ink' : 'text-taupe hover:text-ink'"
          @click="vm.setPanelTab('wardrobe')"
        >
          Wardrobe
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="vm.panelTab.value === 'verdict'"
          :disabled="!vm.result.value"
          class="flex-1 rounded-full py-2 text-sm tracking-wide transition-colors disabled:opacity-40"
          :class="vm.panelTab.value === 'verdict' ? 'bg-blush-soft text-ink' : 'text-taupe hover:text-ink'"
          @click="vm.setPanelTab('verdict')"
        >
          Verdict
        </button>
      </div>

      <p v-if="vm.error.value" role="alert" class="mx-4 mt-3 rounded-xl bg-blush-soft px-4 py-2 text-sm text-rose">{{ vm.error.value }}</p>

      <StudioWardrobePanel
        v-if="vm.panelTab.value === 'wardrobe' || !vm.result.value"
        :items="vm.panelItems.value"
        :category="vm.panelCategory.value"
        :worn-ids="vm.wornIds.value"
        :worn-categories="vm.wornCategories.value"
        @select-category="vm.selectPanelCategory"
        @toggle="vm.toggleWear"
        @details="vm.openItem"
      />

      <div v-else class="min-h-0 flex-1 overflow-y-auto p-4">
        <div class="mb-4 flex items-start justify-between gap-3 px-1">
          <div>
            <p class="font-display text-2xl text-ink">{{ vm.result.value.title }}</p>
            <p class="mt-1 text-xs leading-relaxed text-taupe">{{ vm.result.value.explanation }}</p>
          </div>
          <UiHeartButton
            :active="vm.result.value.isFavourite"
            :label="vm.result.value.isFavourite ? 'Remove from favourites' : 'Save to favourites'"
            class="shrink-0 border border-line"
            @click="vm.toggleFavourite"
          />
        </div>
        <p v-if="vm.stale.value" class="mb-3 rounded-xl bg-cream px-3 py-2 text-xs text-taupe">
          You've changed the outfit since this verdict. Rate it again to update.
        </p>
        <StudioRatingCard
          v-if="vm.result.value.rating"
          :rating="vm.result.value.rating"
          :score-label="vm.scoreLabel.value"
          :fixes="vm.fixes.value"
          :busy="vm.busy.value"
          class="!p-5 !shadow-none ring-1 ring-line/70"
          @apply-fix="vm.applyFix"
        />
      </div>

      <div class="shrink-0 space-y-3 border-t border-line/70 p-4">
        <div>
          <p class="mb-2 flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-taupe">
            <Icon name="lucide:sparkles" class="size-3 text-rose" /> Let the AI fill
          </p>
          <StudioFillToggles :options="vm.fillOptions.value" @toggle="vm.toggleFill" />
        </div>
        <label for="studio-prompt" class="sr-only">Describe the vibe (optional)</label>
        <input
          id="studio-prompt"
          v-model="vm.prompt.value"
          type="text"
          maxlength="500"
          placeholder="Describe the vibe — optional"
          class="h-10 w-full rounded-xl border border-line bg-ivory px-4 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
        >
        <button
          type="button"
          :disabled="!vm.canGenerate.value"
          class="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-rose text-sm font-medium tracking-wide text-white transition-colors hover:bg-[#ad6b72] disabled:cursor-not-allowed disabled:opacity-50"
          @click="vm.generate"
        >
          <Icon :name="vm.busy.value ? 'lucide:loader-circle' : 'lucide:sparkles'" class="size-4" :class="vm.busy.value ? 'animate-spin' : ''" />
          {{ vm.busy.value ? 'Styling… and judging' : 'Generate & rate' }}
        </button>
        <p v-if="vm.stylistLabel.value" class="text-center text-[0.7rem] tracking-wide text-taupe" data-testid="stylist-label">
          Styled by {{ vm.stylistLabel.value }} ·
          <NuxtLink to="/settings" class="underline underline-offset-2 hover:text-ink">change</NuxtLink>
        </p>
      </div>
    </aside>
    <ItemDetailSheet :item-id="vm.openItemId.value" @close="vm.closeItem" />
  </div>
</template>
