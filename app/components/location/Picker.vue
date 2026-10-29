<script setup lang="ts">
import type { Place } from '#shared/models/weather'
import { useLocationPicker } from '~/services/components/location/Picker.service'

const emit = defineEmits<{ pick: [place: Place] }>()
const vm = useLocationPicker(emit)
</script>

<template>
  <div class="w-full" data-testid="location-picker">
    <form class="flex gap-2" role="search" @submit.prevent="vm.search">
      <label for="city-search" class="sr-only">Search for your city</label>
      <div class="relative flex-1">
        <Icon name="lucide:search" class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-taupe" />
        <input
          id="city-search"
          v-model="vm.query.value"
          type="text"
          enterkeyhint="search"
          autocomplete="off"
          maxlength="100"
          placeholder="Search for your city"
          class="h-11 w-full rounded-xl border border-line bg-surface pr-4 pl-10 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
        >
      </div>
      <button
        type="button"
        :disabled="vm.locating.value"
        class="flex h-11 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-sm text-taupe transition-colors hover:border-blush hover:text-ink disabled:opacity-60"
        @click="vm.useCurrentLocation"
      >
        <Icon :name="vm.locating.value ? 'lucide:loader-circle' : 'lucide:locate-fixed'" class="size-4" :class="{ 'animate-spin': vm.locating.value }" />
        Use my location
      </button>
    </form>

    <p v-if="vm.error.value" role="alert" class="mt-2 text-sm text-rose">{{ vm.error.value }}</p>
    <p v-else-if="vm.searching.value" role="status" class="mt-2 text-sm text-taupe">Looking…</p>
    <p v-else-if="vm.empty.value" role="status" class="mt-2 text-sm text-taupe">No city by that name. Try the English spelling.</p>

    <ul v-if="vm.options.value.length" class="mt-2 overflow-hidden rounded-xl border border-line bg-surface" aria-label="Cities">
      <li v-for="option in vm.options.value" :key="option.key" class="border-b border-line/60 last:border-b-0">
        <button
          type="button"
          class="flex w-full items-baseline gap-2 px-4 py-2.5 text-left transition-colors hover:bg-blush-soft"
          @click="vm.choose(option.place)"
        >
          <span class="text-sm text-ink">{{ option.title }}</span>
          <span class="truncate text-xs text-taupe">{{ option.detail }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
