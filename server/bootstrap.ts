import { join, resolve } from 'node:path'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import { createContainer } from './container'
import { createApiRouter } from './http/routes'

export interface ServerConfig {
  /** Where dardar.db and images/ live (Electron passes its userData folder). */
  dataDir: string
  demoSeed: boolean
  allowReset: boolean
}

let api: Promise<ReturnType<typeof createApiRouter>> | undefined

/** Builds the container and router once per server process. */
export function useApi(config: ServerConfig) {
  api ??= (async () => {
    const dataDir = resolve(config.dataDir)
    const container = await createContainer({
      databasePath: join(dataDir, 'dardar.db'),
      imagesDir: join(dataDir, 'images'),
      seed: config.demoSeed ? { items: seedItems, styleMatches: seedStyleMatches } : undefined,
      allowReset: config.allowReset,
    })
    return createApiRouter(container)
  })()
  return api
}
