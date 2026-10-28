import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { canGoBack } from '~/services/navigation'

/** The piece open in the detail sheet lives in the URL (`?item=<id>`), so Back closes the sheet. */
export function useItemSheetRoute() {
  const route = useRoute()
  const router = useRouter()

  const openItemId = computed(() => {
    const id = (route.query as Record<string, string | undefined>).item
    return typeof id === 'string' && id ? id : null
  })

  function openItem(id: string) {
    router.push({ query: { ...route.query, item: id } })
  }

  function closeItem() {
    if (canGoBack()) {
      router.back()
      return
    }
    const { item: _closed, ...rest } = route.query
    router.replace({ query: rest })
  }

  return { openItemId, openItem, closeItem }
}
