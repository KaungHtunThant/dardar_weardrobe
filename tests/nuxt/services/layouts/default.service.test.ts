import { describe, expect, it } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useDefaultLayout } from '~/services/layouts/default.service'

const route = { path: '/wardrobe' }
mockNuxtImport('useRoute', () => () => route)

describe('default layout service', () => {
  it('lists Home, Studio and Wardrobe', () => {
    const vm = useDefaultLayout()
    expect(vm.navItems.map((n) => n.label)).toEqual(['Home', 'Studio', 'Wardrobe'])
  })

  it('marks the current section active, including nested paths', () => {
    const vm = useDefaultLayout()
    expect(vm.isActive('/wardrobe')).toBe(true)
    expect(vm.isActive('/')).toBe(false)
    route.path = '/'
    expect(vm.isActive('/')).toBe(true)
  })
})
