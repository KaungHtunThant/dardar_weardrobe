<script setup lang="ts">
import type { CategoryId } from '#shared/models/category'
import type { CategoryFilter } from '#shared/utils/wardrobe'
import type { Ghost, PlacedPiece } from '~/services/pages/studio.service'
import { useDressForm } from '~/services/components/studio/DressForm.service'

const props = defineProps<{ placed: PlacedPiece[]; ghosts: Ghost[]; activeCategory: CategoryFilter }>()
const emit = defineEmits<{ focus: [id: CategoryId] }>()
const vm = useDressForm(props, emit)
// Template ref for the stage viewport (owned by the service).
const viewportEl = vm.viewportEl
</script>

<template>
  <div class="relative h-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_30%,#FFFDFB_0%,#F5EFEA_60%,#EEE5DD_100%)]">
    <div
      ref="viewportEl"
      class="absolute inset-0 touch-none select-none focus:outline-none"
      :class="vm.canScroll.value ? 'cursor-grab active:cursor-grabbing' : ''"
      tabindex="0"
      role="region"
      aria-label="Dress form — scroll to move, Ctrl + scroll to zoom"
      data-testid="dress-form"
      @pointerdown="vm.onPointerDown"
      @pointermove="vm.onPointerMove"
      @pointerup="vm.onPointerUp"
      @pointerleave="vm.onPointerUp"
      @keydown="vm.onKeydown"
    >
      <div class="absolute top-0 left-1/2 will-change-transform" :style="vm.figureStyle.value" data-testid="figure" :data-scale="vm.scale.value">
        <StudioMannequin />

        <button
          v-for="ghost in vm.ghostBoxes.value"
          :key="ghost.id"
          type="button"
          class="absolute flex flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed transition-colors duration-200"
          :class="ghost.active ? 'border-rose bg-blush-soft/50' : 'border-blush/70 bg-surface/30 hover:bg-blush-soft/40'"
          :style="ghost.style"
          :aria-label="`AI picks ${ghost.label.toLowerCase()} — browse ${ghost.label}`"
          data-testid="ai-slot"
          @click="vm.focus(ghost.id)"
        >
          <Icon name="lucide:sparkles" class="size-6 text-rose" />
          <span class="text-sm tracking-wide text-taupe">AI picks {{ ghost.label.toLowerCase() }}</span>
        </button>

        <button
          v-for="piece in vm.pieces.value"
          :key="piece.item.id"
          type="button"
          class="group absolute rounded-3xl"
          :style="piece.style"
          :aria-label="`${piece.item.name} — browse ${piece.item.category}`"
          :data-slot="piece.slot"
          :data-ai="piece.isAi"
          data-testid="worn-piece"
          @click="vm.focus(piece.item.category)"
        >
          <img
            :src="piece.item.cleanImage"
            :alt="piece.item.name"
            class="garment h-full w-full transition-[transform,filter] duration-300 ease-soft group-hover:scale-[1.03]"
            :class="piece.active ? '[filter:drop-shadow(0_0_14px_rgb(216_167_167/0.95))_drop-shadow(0_10px_14px_rgb(46_42_40/0.12))]' : ''"
            :style="{ objectPosition: piece.objectPosition }"
            draggable="false"
          >
          <span
            v-if="piece.isAi"
            class="absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs tracking-wide text-rose shadow-soft"
          >
            <Icon name="lucide:sparkles" class="size-3.5" /> AI
          </span>
        </button>
      </div>
    </div>

    <!-- Zoom controls -->
    <div class="absolute bottom-6 left-6 flex items-center gap-1 rounded-full bg-surface/90 p-1 shadow-soft backdrop-blur">
      <button type="button" aria-label="Zoom out" class="grid size-9 place-items-center rounded-full text-ink hover:bg-cream" @click="vm.zoomOut">
        <Icon name="lucide:minus" class="size-4" />
      </button>
      <span class="w-12 text-center text-xs tabular-nums text-taupe" data-testid="zoom-label">{{ vm.zoomLabel.value }}</span>
      <button type="button" aria-label="Zoom in" class="grid size-9 place-items-center rounded-full text-ink hover:bg-cream" @click="vm.zoomIn">
        <Icon name="lucide:plus" class="size-4" />
      </button>
      <button type="button" aria-label="Fit to screen" class="grid size-9 place-items-center rounded-full text-ink hover:bg-cream" @click="vm.fit">
        <Icon name="lucide:scan" class="size-4" />
      </button>
    </div>
    <p class="pointer-events-none absolute right-6 bottom-8 text-[0.7rem] tracking-wide text-taupe/80">
      Scroll to move · Ctrl + scroll to zoom · Click a piece to browse its category
    </p>
  </div>
</template>
