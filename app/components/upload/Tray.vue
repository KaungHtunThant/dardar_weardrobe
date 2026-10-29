<script setup lang="ts">
import { useUploadTray } from '~/services/components/upload/Tray.service'

const vm = useUploadTray()
</script>

<template>
  <div v-if="vm.visible.value" class="upload-dock pointer-events-none fixed right-8 z-40 flex flex-col items-end gap-3">
    <section
      v-if="vm.open.value"
      id="upload-tray-panel"
      aria-label="Pieces being added"
      class="pointer-events-auto w-80 overflow-hidden rounded-3xl border border-line/70 bg-ivory shadow-[0_18px_40px_rgb(46_42_40/0.12)]"
      data-testid="upload-tray-panel"
    >
      <ul class="max-h-96 divide-y divide-line/60 overflow-y-auto">
        <li v-for="entry in vm.entries.value" :key="entry.id" class="flex items-center gap-3 px-4 py-3" data-testid="upload-entry">
          <span class="grid size-14 shrink-0 place-items-center rounded-xl bg-surface p-1.5">
            <img :src="entry.image" alt="" class="garment h-full w-full" :class="entry.canReview ? '' : 'opacity-60'" >
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm" :class="entry.canRetry ? 'text-rose' : 'text-ink'">{{ entry.status }}</span>
            <span class="mt-1 flex gap-3 text-xs">
              <button v-if="entry.canReview" type="button" class="text-rose underline-offset-4 hover:underline" @click="vm.review(entry.id)">Review</button>
              <button v-if="entry.canRetry" type="button" class="text-rose underline-offset-4 hover:underline" @click="vm.retry(entry.id)">Try again</button>
              <button type="button" class="text-taupe underline-offset-4 hover:text-ink hover:underline" @click="vm.discard(entry.id)">Discard</button>
            </span>
          </span>
          <Icon v-if="entry.state === 'processing'" name="lucide:loader-circle" class="size-4 shrink-0 animate-spin text-rose" />
        </li>
      </ul>
    </section>

    <button
      type="button"
      class="pointer-events-auto flex h-12 items-center gap-3 rounded-full border border-line/70 bg-ivory px-5 text-sm text-ink shadow-[0_10px_24px_rgb(46_42_40/0.10)] transition-colors hover:border-blush"
      :aria-expanded="vm.open.value"
      aria-controls="upload-tray-panel"
      data-testid="upload-tray"
      @click="vm.toggle"
    >
      <Icon v-if="vm.busy.value" name="lucide:loader-circle" class="size-4 animate-spin text-rose" />
      <Icon v-else name="lucide:sparkles" class="size-4 text-rose" />
      <span role="status">{{ vm.summary.value }}</span>
      <span v-if="vm.readyCount.value" class="size-2 rounded-full bg-blush" aria-hidden="true" />
    </button>

    <ItemAddDialog :open="vm.reviewing.value !== null" :upload="vm.reviewing.value" @update:open="vm.setReviewOpen" />
  </div>
</template>
