<script setup lang="ts">
defineProps<{ modelValue: string; options: { value: string; label: string; icon: string }[]; label: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex rounded-full border border-line bg-surface p-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="flex h-8 items-center gap-1.5 rounded-full px-4 text-sm tracking-wide transition-colors duration-200"
      :class="modelValue === option.value ? 'bg-blush-soft text-ink' : 'text-taupe hover:text-ink'"
      @click="$emit('update:modelValue', option.value)"
    >
      <Icon :name="option.icon" class="size-4" />
      {{ option.label }}
    </button>
  </div>
</template>
