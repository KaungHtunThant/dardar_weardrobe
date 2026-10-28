import { useRoute } from '#imports'

export interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'lucide:house' },
  { to: '/studio', label: 'Studio', icon: 'lucide:wand-sparkles' },
  { to: '/wardrobe', label: 'Wardrobe', icon: 'lucide:shirt' },
  { to: '/settings', label: 'Settings', icon: 'lucide:settings' },
]

export function useDefaultLayout() {
  const route = useRoute()

  function isActive(to: string) {
    return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)
  }

  return { navItems: NAV, isActive }
}
