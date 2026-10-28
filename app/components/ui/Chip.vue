<script setup lang="ts">
defineProps<{ selected?: boolean }>()
</script>

<template>
  <button
    type="button"
    :aria-pressed="selected"
    class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm tracking-wide transition-colors duration-200"
    :class="selected ? 'border-blush bg-blush-soft text-ink' : 'border-line bg-surface text-taupe hover:border-blush/60 hover:text-ink'"
  >
    <slot />
  </button>
</template>
