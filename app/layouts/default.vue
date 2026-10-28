<script setup lang="ts">
import { useDefaultLayout } from '~/services/layouts/default.service'

const vm = useDefaultLayout()
</script>

<template>
  <div class="flex h-dvh flex-col bg-ivory">
    <header class="flex h-16 shrink-0 items-center justify-between border-b border-line/70 px-10">
      <NuxtLink to="/" class="flex items-baseline gap-2">
        <span class="font-display text-[1.75rem] font-medium leading-none tracking-wide text-ink">Dardar</span>
        <span class="text-[0.65rem] uppercase tracking-[0.3em] text-taupe">wardrobe</span>
      </NuxtLink>

      <nav aria-label="Main" class="flex items-center gap-8">
        <NuxtLink
          v-for="item in vm.navItems"
          :key="item.to"
          :to="item.to"
          :aria-current="vm.isActive(item.to) ? 'page' : undefined"
          class="relative py-5 text-sm tracking-wide transition-colors duration-200"
          :class="vm.isActive(item.to) ? 'text-ink' : 'text-taupe hover:text-ink'"
        >
          {{ item.label }}
          <span
            class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blush transition-opacity duration-300"
            :class="vm.isActive(item.to) ? 'opacity-100' : 'opacity-0'"
          />
        </NuxtLink>
      </nav>
    </header>

    <main id="main" class="relative min-h-0 flex-1 overflow-y-auto">
      <slot />
    </main>

    <UploadTray />
  </div>
</template>
