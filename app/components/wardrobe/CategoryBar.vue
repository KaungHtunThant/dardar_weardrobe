<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import { useCategoryBar } from '~/services/components/wardrobe/CategoryBar.service'

const props = defineProps<{ counts: Record<CategoryId, number>; selected: CategoryFilter }>()
const emit = defineEmits<{ select: [id: CategoryFilter] }>()
const vm = useCategoryBar(props, emit)
</script>

<template>
  <div role="toolbar" aria-label="Filter by category" class="flex gap-2 overflow-x-auto">
    <UiChip v-for="option in vm.options.value" :key="option.id" :selected="selected === option.id" @click="vm.select(option.id)">
      {{ option.label }}
      <span class="text-xs text-taupe/80">{{ option.count }}</span>
    </UiChip>
  </div>
</template>
