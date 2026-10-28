<script setup lang="ts">
defineProps<{ label: string; icon?: string }>()
</script>

<template>
  <button
    type="button"
    class="group fixed right-8 bottom-8 z-30 flex h-14 items-center gap-2 rounded-full bg-rose pr-6 pl-5 text-sm font-medium tracking-wide text-white shadow-[0_10px_30px_-8px_rgb(185_120_126/0.6)] transition-all duration-300 ease-soft hover:-translate-y-0.5 hover:bg-[#ad6b72]"
  >
    <Icon :name="icon ?? 'lucide:plus'" class="size-5 transition-transform duration-300 group-hover:rotate-90" />
    {{ label }}
  </button>
</template>
