<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { FillOption } from '~/services/pages/studio.service'

defineProps<{ options: FillOption[] }>()
defineEmits<{ toggle: [id: CategoryId] }>()
</script>

<template>
  <div role="group" aria-label="Let the AI fill" class="flex flex-wrap gap-2">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :aria-pressed="option.on"
      :aria-label="`AI fills ${option.label}`"
      :disabled="option.coveredByYou"
      class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm tracking-wide transition-colors duration-200 disabled:cursor-default"
      :class="
        option.coveredByYou
          ? 'border-line bg-cream text-taupe/70'
          : option.on
            ? 'border-blush bg-blush-soft text-ink'
            : 'border-line bg-surface text-taupe hover:border-blush/60 hover:text-ink'
      "
      @click="$emit('toggle', option.id)"
    >
      <Icon :name="option.coveredByYou ? 'lucide:check' : option.on ? 'lucide:sparkles' : 'lucide:plus'" class="size-3.5" :class="option.on && !option.coveredByYou ? 'text-rose' : ''" />
      {{ option.label }}
      <span v-if="option.coveredByYou" class="text-[0.65rem] uppercase tracking-widest">yours</span>
    </button>
  </div>
</template>
