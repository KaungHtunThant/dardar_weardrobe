<script setup lang="ts">
defineProps<{ active: boolean; label: string }>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :aria-pressed="active"
    class="grid size-9 place-items-center rounded-full transition-colors duration-200 hover:bg-blush-soft"
  >
    <Icon
      name="lucide:heart"
      class="size-[18px] transition-colors duration-200"
      :class="active ? 'text-rose [&_path]:fill-current' : 'text-taupe'"
    />
  </button>
</template>
