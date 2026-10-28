<script setup lang="ts">
defineProps<{ icon: string; title: string; text?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
    <Icon :name="icon" class="size-6 text-blush" />
    <p class="font-display text-xl text-ink">{{ title }}</p>
    <p v-if="text" class="max-w-xs text-sm text-taupe">{{ text }}</p>
  </div>
</template>
