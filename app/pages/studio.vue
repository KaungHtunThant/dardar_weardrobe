<script setup lang="ts">
import { useStudioPage } from '~/services/pages/studio.service'

const vm = useStudioPage()
</script>

<template>
  <div class="mx-auto max-w-6xl px-10 pt-8 pb-24">
    <header class="mb-8">
      <h1 class="font-display text-4xl font-medium text-ink">Style Studio</h1>
      <p class="mt-1 max-w-xl text-sm text-taupe">Pick what you love, let the AI fill the gaps — then hear the honest truth.</p>
    </header>

    <p v-if="vm.error.value" role="alert" class="mb-6 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">{{ vm.error.value }}</p>

    <!-- Result -->
    <div v-if="vm.stage.value === 'result' && vm.result.value" class="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-10">
      <section aria-labelledby="look-title">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-[0.7rem] uppercase tracking-[0.25em] text-taupe">Your look</p>
            <h2 id="look-title" class="mt-1 font-display text-5xl leading-tight font-medium text-ink">{{ vm.result.value.title }}</h2>
            <p class="mt-3 max-w-lg text-sm leading-relaxed text-taupe">{{ vm.result.value.explanation }}</p>
          </div>
          <UiHeartButton
            :active="vm.result.value.isFavourite"
            :label="vm.result.value.isFavourite ? 'Remove from favourites' : 'Save to favourites'"
            class="shrink-0 border border-line"
            @click="vm.toggleFavourite"
          />
        </div>
        <StudioResultLook :items="vm.resultItems.value" />
        <div class="mt-8 flex gap-3">
          <button type="button" class="h-11 rounded-full border border-line bg-surface px-6 text-sm text-ink transition-colors hover:border-blush" @click="vm.tweak">
            Tweak picks
          </button>
          <button type="button" class="h-11 rounded-full px-6 text-sm text-taupe transition-colors hover:text-ink" @click="vm.reset">
            Start fresh
          </button>
        </div>
      </section>
      <StudioRatingCard
        v-if="vm.result.value.rating"
        :rating="vm.result.value.rating"
        :score-label="vm.scoreLabel.value"
        :fixes="vm.fixes.value"
        :busy="vm.busy.value"
        @apply-fix="vm.applyFix"
      />
    </div>

    <!-- Compose -->
    <div v-else class="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-10">
      <section aria-labelledby="pick-title">
        <h2 id="pick-title" class="mb-4 font-display text-2xl text-ink">
          1. Pick your pieces <span class="font-sans text-sm text-taupe">— optional</span>
        </h2>
        <StudioPiecePicker :items="vm.items.value" :pinned-ids="vm.pinnedIds.value" @toggle="vm.togglePin" />
      </section>

      <aside class="sticky top-6 rounded-3xl bg-surface p-6 shadow-soft" aria-label="Your look so far">
        <h2 class="mb-3 font-display text-2xl text-ink">Your look</h2>
        <StudioLookBoard :pinned="vm.pinnedItems.value" :ai-slots="vm.aiSlots.value" @unpin="vm.togglePin" />

        <h3 class="mt-6 mb-2 text-xs uppercase tracking-[0.2em] text-taupe">2. Let the AI fill</h3>
        <StudioFillToggles :options="vm.fillOptions.value" @toggle="vm.toggleFill" />

        <label for="studio-prompt" class="mt-6 mb-2 block text-xs uppercase tracking-[0.2em] text-taupe">3. Describe the vibe — optional</label>
        <input
          id="studio-prompt"
          v-model="vm.prompt.value"
          type="text"
          maxlength="500"
          placeholder="e.g. brunch with a bit of edge"
          class="h-11 w-full rounded-xl border border-line bg-ivory px-4 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
        >

        <button
          type="button"
          :disabled="!vm.canGenerate.value"
          class="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rose text-sm font-medium tracking-wide text-white transition-colors hover:bg-[#ad6b72] disabled:cursor-not-allowed disabled:opacity-50"
          @click="vm.generate"
        >
          <Icon :name="vm.stage.value === 'generating' ? 'lucide:loader-circle' : 'lucide:sparkles'" class="size-4" :class="vm.stage.value === 'generating' ? 'animate-spin' : ''" />
          {{ vm.stage.value === 'generating' ? 'Styling… and judging' : 'Generate & rate' }}
        </button>
      </aside>
    </div>
  </div>
</template>
