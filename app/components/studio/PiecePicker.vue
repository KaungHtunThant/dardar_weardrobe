<script setup lang="ts">
import type { Item } from '#shared/models/item'
import { usePiecePicker } from '~/services/components/studio/PiecePicker.service'

const props = defineProps<{ items: Item[]; pinnedIds: string[] }>()
const emit = defineEmits<{ toggle: [id: string] }>()
const vm = usePiecePicker(props, emit)
</script>

<template>
  <div>
    <div role="tablist" aria-label="Browse your pieces" class="mb-5 flex flex-wrap gap-2">
      <UiChip
        v-for="tab in vm.tabs.value"
        :key="tab.id"
        role="tab"
        :aria-selected="vm.category.value === tab.id"
        :selected="vm.category.value === tab.id"
        @click="vm.setCategory(tab.id)"
      >
        {{ tab.label }}
        <span v-if="tab.picked" class="grid size-5 place-items-center rounded-full bg-rose text-[0.65rem] text-white">{{ tab.picked }}</span>
      </UiChip>
    </div>

    <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4" data-testid="piece-grid">
      <button
        v-for="item in vm.visible.value"
        :key="item.id"
        type="button"
        :aria-pressed="vm.isPicked(item.id)"
        :aria-label="`${vm.isPicked(item.id) ? 'Unpick' : 'Pick'} ${item.name}`"
        class="group relative flex flex-col text-left"
        @click="vm.toggle(item.id)"
      >
        <div
          class="aspect-[4/5] w-full rounded-2xl bg-surface p-[14%] shadow-soft ring-2 transition-all duration-200"
          :class="vm.isPicked(item.id) ? 'ring-rose' : 'ring-transparent group-hover:ring-blush/50'"
        >
          <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full" draggable="false" >
        </div>
        <span
          class="absolute top-2 right-2 grid size-6 place-items-center rounded-full transition-all duration-200"
          :class="vm.isPicked(item.id) ? 'bg-rose text-white' : 'bg-surface/90 text-transparent ring-1 ring-line'"
        >
          <Icon name="lucide:check" class="size-3.5" />
        </span>
        <span class="mt-2 truncate px-1 text-xs text-ink">{{ item.name }}</span>
      </button>
    </div>
  </div>
</template>
