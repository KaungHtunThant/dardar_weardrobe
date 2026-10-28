import { getCurrentInstance, onMounted, onUnmounted } from 'vue'

/** Runs `fn` on mount when used inside a component; services stay callable from plain tests. */
export function onViewMounted(fn: () => unknown) {
  if (getCurrentInstance()) onMounted(fn)
}

/** Runs `fn` on unmount when used inside a component. */
export function onViewUnmounted(fn: () => unknown) {
  if (getCurrentInstance()) onUnmounted(fn)
}
