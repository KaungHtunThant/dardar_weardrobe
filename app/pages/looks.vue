<script setup lang="ts">
import { useLooksPage } from '~/services/pages/looks.service'

const vm = useLooksPage()
</script>

<template>
  <div class="mx-auto max-w-6xl px-10 pt-8 pb-24">
    <header class="mb-6 flex items-end justify-between gap-6">
      <div>
        <h1 class="font-display text-4xl font-medium text-ink">Looks</h1>
        <p class="mt-1 text-sm text-taupe">Every look you and your stylist have put together.</p>
      </div>
      <UiSegmented label="Sort looks" :model-value="vm.sort.value" :options="vm.sorts" @update:model-value="vm.setSort" />
    </header>

    <div role="toolbar" aria-label="Filter looks" class="mb-8 flex flex-wrap gap-2">
      <UiChip v-for="f in vm.filters.value" :key="f.value" :selected="vm.filter.value === f.value" @click="vm.setFilter(f.value)">
        {{ f.label }} <span class="text-xs text-taupe/80">{{ f.count }}</span>
      </UiChip>
    </div>

    <div v-if="vm.entries.value.length" class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-10" data-testid="looks-grid">
      <HomeLookCard
        v-for="entry in vm.entries.value"
        :key="entry.look.id"
        :entry="entry"
        actions
        @toggle-favourite="vm.toggleFavourite"
        @open="vm.openInStudio"
        @delete="vm.askDelete"
      />
    </div>
    <UiEmptyState v-else-if="!vm.loading.value" icon="lucide:images" title="Nothing here yet" :text="vm.emptyText.value" />

    <UiDialog
      :open="vm.deleteTarget.value !== null"
      size="sm"
      :title="`Delete ${vm.deleteTarget.value?.title ?? 'this look'}?`"
      :description="vm.deleteDescription.value"
      @update:open="vm.setDeleteOpen"
    >
      <div class="flex justify-end gap-3">
        <button type="button" class="h-11 rounded-full px-6 text-sm text-taupe hover:text-ink" @click="vm.setDeleteOpen(false)">Keep it</button>
        <button
          type="button"
          :disabled="vm.deleting.value"
          class="h-11 rounded-full bg-rose px-6 text-sm font-medium text-white hover:bg-[#ad6b72] disabled:opacity-60"
          @click="vm.confirmDelete"
        >
          {{ vm.deleting.value ? 'Deleting…' : 'Delete look' }}
        </button>
      </div>
    </UiDialog>
  </div>
</template>
