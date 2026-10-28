<script setup lang="ts">
import { useHomePage } from '~/services/pages/index.service'

const vm = useHomePage()
</script>

<template>
  <div class="mx-auto max-w-6xl px-10 pt-12 pb-24">
    <p v-if="vm.error.value" role="alert" class="mb-6 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">
      {{ vm.error.value }}
    </p>

    <div v-if="vm.loading.value" class="grid h-[440px] place-items-center text-sm text-taupe" aria-busy="true">
      Dressing up your day…
    </div>

    <template v-else>
      <HomeTodayHero
        v-if="vm.today.value"
        :entry="vm.today.value"
        :date-label="vm.todayLabel"
        @toggle-favourite="vm.toggleFavourite"
      />
      <div
        v-else-if="vm.todayLoading.value"
        class="grid h-[440px] place-items-center rounded-[2rem] bg-cream text-center"
        aria-busy="true"
        data-testid="today-loading"
      >
        <div>
          <Icon name="lucide:sparkles" class="mx-auto size-6 animate-pulse text-rose" />
          <p class="mt-3 font-display text-2xl text-ink">Your stylist is putting today's look together…</p>
          <p role="status" class="mt-2 text-sm text-taupe" data-testid="today-stage">{{ vm.todayStage.value }}</p>
        </div>
      </div>
      <UiEmptyState
        v-else
        icon="lucide:sparkles"
        title="No recommendation yet"
        text="Add a few pieces to your wardrobe and a look will be waiting for you here."
      />

      <section aria-labelledby="recent-title" class="mt-20">
        <UiSectionHeader id="recent-title" eyebrow="Style matches" title="Recently styled" />
        <div v-if="vm.recent.value.length" class="-mx-2 flex snap-x gap-6 overflow-x-auto px-2 pb-4">
          <HomeLookCard
            v-for="entry in vm.recent.value"
            :key="entry.look.id"
            :entry="entry"
            class="w-60 shrink-0 snap-start"
            @toggle-favourite="vm.toggleFavourite"
          />
        </div>
        <UiEmptyState v-else icon="lucide:wand-sparkles" title="No style matches yet" />
      </section>

      <section aria-labelledby="favourites-title" class="mt-16">
        <UiSectionHeader id="favourites-title" eyebrow="Saved" title="Favourite looks" />
        <div v-if="vm.favourites.value.length" class="grid grid-cols-4 gap-6">
          <HomeLookCard
            v-for="entry in vm.favourites.value"
            :key="entry.look.id"
            :entry="entry"
            @toggle-favourite="vm.toggleFavourite"
          />
        </div>
        <UiEmptyState v-else icon="lucide:heart" title="No favourites yet" text="Tap the heart on any look to keep it here." />
      </section>
    </template>
  </div>
</template>
