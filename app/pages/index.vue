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
      <section
        v-if="vm.welcome.value"
        aria-labelledby="welcome-title"
        class="mb-10 rounded-[2rem] bg-cream px-8 py-6"
        data-testid="stylist-welcome"
      >
        <div class="flex items-start gap-5">
          <Icon name="lucide:sparkles" class="mt-1.5 size-6 shrink-0 text-rose" />
          <div class="min-w-0 flex-1">
            <h2 id="welcome-title" class="font-display text-2xl text-ink">Meet {{ vm.welcome.value.name }}, your stylist</h2>
            <p class="mt-1 text-sm text-taupe">
              {{ vm.welcome.value.name }} was set up on this computer just for you. It cuts out every piece you add, fills in the details and styles your looks.
            </p>

            <div class="mt-5" data-testid="welcome-city">
              <p class="mb-2 text-[0.7rem] uppercase tracking-[0.2em] text-taupe">Where do you live?</p>
              <p v-if="vm.welcomeLocating.value" role="status" class="flex items-center gap-2 text-sm text-taupe">
                <Icon name="lucide:loader-circle" class="size-4 animate-spin text-rose" /> Finding your city…
              </p>
              <p v-else-if="vm.welcomePlace.value && !vm.pickingPlace.value" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                <span class="flex items-center gap-1.5">
                  <Icon name="lucide:map-pin" class="size-4 text-rose" />
                  <span data-testid="welcome-place">{{ vm.welcomePlace.value }}</span>
                </span>
                <button type="button" class="text-xs text-taupe underline underline-offset-2 hover:text-ink" @click="vm.changePlace">
                  Not here?
                </button>
              </p>
              <LocationPicker v-else class="max-w-xl" @pick="vm.pickPlace" />
              <p class="mt-2 text-xs text-taupe">
                {{ vm.welcome.value.name }} checks the weather there, so today's look and every look you style suit the day. Change it any time in Settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            class="h-10 shrink-0 rounded-full bg-rose px-5 text-sm font-medium text-white transition-colors hover:bg-[#ad6b72]"
            @click="vm.dismissWelcome"
          >
            Lovely
          </button>
        </div>
      </section>

      <HomeTodayHero
        v-if="vm.today.value"
        :entry="vm.today.value"
        :date-label="vm.todayLabel"
        :weather="vm.todayWeather.value"
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

      <p v-if="vm.askForCity.value" class="mt-6 flex items-center gap-2 pl-2 text-xs text-taupe" data-testid="ask-for-city">
        <Icon name="lucide:cloud-sun" class="size-4 text-rose" />
        Tell Dardar where you live and today's look will suit the weather.
        <NuxtLink to="/settings" class="underline underline-offset-2 hover:text-ink">Add your city</NuxtLink>
      </p>

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
