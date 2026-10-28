<script setup lang="ts">
import type { ItemForm } from '~/services/shared/itemForm'
import { useDetailsForm } from '~/services/components/item/DetailsForm.service'

// The garment details fields, shared by Add item and Edit.
const props = defineProps<{ form: ItemForm }>()
const vm = useDetailsForm(props)
</script>

<template>
  <div class="flex flex-col gap-4">
      <div>
        <label for="item-name" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Name</label>
        <input
          id="item-name"
          v-model="vm.values.name"
          type="text"
          placeholder="e.g. Blush Silk Blouse"
          class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-ink placeholder:text-taupe/60 focus:border-blush focus:outline-none"
          :aria-invalid="Boolean(vm.errors.value.name)"
        >
        <p v-if="vm.errors.value.name" class="mt-1 text-xs text-rose">{{ vm.errors.value.name }}</p>
      </div>

      <fieldset>
        <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Category</legend>
        <div class="flex flex-wrap gap-2">
          <UiChip
            v-for="option in vm.options.categories"
            :key="option.value"
            :selected="vm.values.category === option.value"
            @click="vm.setCategory(option.value)"
          >
            {{ option.label }}
          </UiChip>
        </div>
        <p v-if="vm.errors.value.category" class="mt-1 text-xs text-rose">{{ vm.errors.value.category }}</p>
      </fieldset>

      <div class="grid grid-cols-3 gap-3">
        <div class="col-span-1">
          <label for="item-colors" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Colours</label>
          <input id="item-colors" v-model="vm.values.colors" type="text" placeholder="blush, cream" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
        </div>
        <div>
          <label for="item-brand" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Brand</label>
          <input id="item-brand" v-model="vm.values.brand" type="text" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
        </div>
        <div>
          <label for="item-size" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Size</label>
          <input id="item-size" v-model="vm.values.size" type="text" class="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm focus:border-blush focus:outline-none" >
        </div>
      </div>

      <fieldset>
        <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Seasons</legend>
        <div class="flex flex-wrap gap-2">
          <UiChip
            v-for="option in vm.options.seasons"
            :key="option.value"
            :selected="vm.values.seasons.includes(option.value)"
            @click="vm.toggle('seasons', option.value)"
          >
            {{ option.label }}
          </UiChip>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-1.5 text-xs uppercase tracking-[0.2em] text-taupe">Occasions</legend>
        <div class="flex flex-wrap gap-2">
          <UiChip
            v-for="option in vm.options.occasions"
            :key="option.value"
            :selected="vm.values.occasions.includes(option.value)"
            @click="vm.toggle('occasions', option.value)"
          >
            {{ option.label }}
          </UiChip>
        </div>
      </fieldset>

      <div>
        <label for="item-notes" class="mb-1.5 block text-xs uppercase tracking-[0.2em] text-taupe">Notes</label>
        <textarea id="item-notes" v-model="vm.values.notes" rows="2" class="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm focus:border-blush focus:outline-none" />
      </div>
  </div>
</template>
