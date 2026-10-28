<script setup lang="ts">
// Two cream doors hinged on the outer edges. `peek` lets them fall ajar on hover (closet tiles).
defineProps<{ open: boolean; peek?: boolean; slow?: boolean }>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0 [perspective:2400px]">
    <div
      v-for="side in (['left', 'right'] as const)"
      :key="side"
      :data-door="side"
      class="door absolute inset-y-0 w-1/2 border border-blush/45 bg-[linear-gradient(165deg,#FEFBF8_0%,#F6EEE7_70%,#F0E6DD_100%)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.6)] ease-soft"
      :class="[
        side === 'left' ? 'left-0 origin-left rounded-l-[inherit]' : 'right-0 origin-right rounded-r-[inherit]',
        slow ? 'duration-[850ms]' : 'duration-500',
        open
          ? side === 'left' ? '[transform:rotateY(-104deg)]' : '[transform:rotateY(104deg)]'
          : peek
            ? side === 'left' ? 'group-hover:[transform:rotateY(-16deg)]' : 'group-hover:[transform:rotateY(16deg)]'
            : '',
      ]"
      style="transition-property: transform"
    >
      <div class="absolute inset-[9%] rounded-[0.6rem] border border-blush/30" />
      <div
        class="absolute top-1/2 h-12 w-[3px] -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,#E3CC9C,#C9A96E,#B08F55)] shadow-[0_1px_2px_rgb(0_0_0/0.15)]"
        :class="side === 'left' ? 'right-[7%]' : 'left-[7%]'"
      />
    </div>
  </div>
</template>
