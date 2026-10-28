<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { Item } from '#shared/models/item'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import { useWardrobePanel } from '~/services/components/studio/WardrobePanel.service'

const props = defineProps<{ items: Item[]; category: CategoryFilter; wornIds: string[]; wornCategories: CategoryId[] }>()
const emit = defineEmits<{ 'select-category': [id: CategoryFilter]; toggle: [id: string] }>()
const vm = useWardrobePanel(props, emit)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div role="tablist" aria-label="Wardrobe categories" class="grid shrink-0 grid-cols-8 gap-1 border-b border-line/70 px-3 py-2">
      <button
        v-for="tab in vm.tabs.value"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="category === tab.id"
        :aria-label="tab.label"
        :title="tab.label"
        class="relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors duration-200"
        :class="category === tab.id ? 'bg-blush-soft text-ink' : 'text-taupe hover:bg-cream hover:text-ink'"
        @click="vm.select(tab.id)"
      >
        <Icon :name="tab.icon" class="size-[18px]" />
        <span class="text-[0.6rem] tracking-wide">{{ tab.label }}</span>
        <span v-if="tab.worn" class="absolute top-1 right-2 size-1.5 rounded-full bg-rose" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-3 gap-3" data-testid="panel-grid">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          :aria-pressed="vm.isWorn(item.id)"
          :aria-label="`${vm.isWorn(item.id) ? 'Take off' : 'Wear'} ${item.name}`"
          class="group relative flex flex-col text-left"
          @click="vm.toggle(item.id)"
        >
          <div
            class="aspect-square w-full rounded-2xl bg-ivory p-[14%] ring-2 transition-all duration-200"
            :class="vm.isWorn(item.id) ? 'ring-rose' : 'ring-transparent group-hover:ring-blush/50'"
          >
            <img :src="item.cleanImage" :alt="item.name" class="garment h-full w-full" draggable="false" >
          </div>
          <span
            v-if="vm.isWorn(item.id)"
            class="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-rose text-white"
          >
            <Icon name="lucide:check" class="size-3" />
          </span>
          <span class="mt-1.5 truncate px-0.5 text-[0.7rem] text-ink">{{ item.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
