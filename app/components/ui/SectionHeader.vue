<script setup lang="ts">
defineProps<{ title: string; eyebrow?: string; id?: string }>()
</script>

<template>
  <div class="mb-5 flex items-end justify-between gap-4">
    <div>
      <p v-if="eyebrow" class="mb-1 text-[0.7rem] uppercase tracking-[0.25em] text-taupe">{{ eyebrow }}</p>
      <h2 :id="id" class="font-display text-3xl font-medium text-ink">{{ title }}</h2>
    </div>
    <slot />
  </div>
</template>
