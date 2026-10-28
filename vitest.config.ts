import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '#shared': r('./shared'), '~': r('./app') } },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/contracts/**/*.test.ts', 'tests/server/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['fake-indexeddb/auto'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          setupFiles: ['fake-indexeddb/auto'],
          environmentOptions: { nuxt: { domEnvironment: 'happy-dom' } },
        },
      }),
    ],
  },
})
