<script setup lang="ts">
import { useWardrobePage } from '~/services/pages/wardrobe/index.service'

const vm = useWardrobePage()
</script>

<template>
  <div
    class="px-10 pt-8"
    :class="vm.view.value === 'closet' ? 'flex h-full flex-col overflow-hidden pb-8' : 'pb-32'"
    :data-view="vm.view.value"
  >
    <header class="mb-6 flex shrink-0 items-end justify-between gap-6">
      <div>
        <h1 class="font-display text-4xl font-medium text-ink">Wardrobe</h1>
        <p class="mt-1 text-sm text-taupe">{{ vm.totalLabel.value }}</p>
      </div>
      <UiSegmented label="Wardrobe view" :model-value="vm.view.value" :options="vm.viewOptions" @update:model-value="vm.setView" />
    </header>

    <p v-if="vm.error.value" role="alert" class="mb-6 rounded-xl bg-blush-soft px-4 py-3 text-sm text-rose">{{ vm.error.value }}</p>

    <!-- Closet view: a wall of closets; one opens to a rail you browse sideways. Never scrolls vertically. -->
    <template v-if="vm.view.value === 'closet'">
      <WardrobeClosetStage
        v-if="vm.openCloset.value"
        :key="vm.openCloset.value.id"
        :category="vm.openCloset.value.id"
        :items="vm.closetItems.value"
        class="min-h-0 flex-1"
        @close="vm.closeCloset"
        @open-item="vm.openItem"
      />
      <div v-else class="grid min-h-0 flex-1 grid-cols-7 gap-4" data-testid="closet-wall">
        <WardrobeClosetTile
          v-for="closet in vm.closets.value"
          :key="closet.category.id"
          :closet="closet"
          @open="vm.openClosetFor(closet.category.id)"
        />
      </div>
    </template>

    <!-- List view: choose a category, scroll vertically. -->
    <template v-else>
      <div class="sticky top-0 z-10 -mx-10 mb-6 bg-ivory/90 px-10 py-3 backdrop-blur">
        <WardrobeCategoryBar :counts="vm.counts.value" :selected="vm.listFilter.value" @select="vm.setFilter" />
      </div>
      <div v-if="vm.listItems.value.length" class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-6 gap-y-10" data-testid="item-grid">
        <WardrobeItemCard v-for="item in vm.listItems.value" :key="item.id" :item="item" @open="vm.openItem" />
      </div>
      <UiEmptyState
        v-else-if="!vm.loading.value"
        icon="lucide:shirt"
        title="Nothing here yet"
        text="Add your first piece in this category with the button below."
      />
    </template>

    <UiFab label="Add item" @click="vm.openAdd" />
    <ItemDetailSheet :item-id="vm.openItemId.value" @close="vm.closeItem" />
    <ItemAddDialog :open="vm.isAddOpen.value" :default-category="vm.addDefaultCategory.value" @update:open="vm.setAddOpen" />
  </div>
</template>
