import { getCurrentInstance, onMounted } from 'vue'

/** Runs `fn` on mount when used inside a component; services stay callable from plain tests. */
export function onViewMounted(fn: () => unknown) {
  if (getCurrentInstance()) onMounted(fn)
}
