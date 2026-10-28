import { join, resolve } from 'node:path'
import { seedItems, seedStyleMatches } from '#shared/fixtures/seed'
import type { AdvisorMode } from '#shared/models/settings'
import { createContainer } from './container'
import { createApiRouter } from './http/routes'
import { ElectronSecretStore, type ParentPort } from './settings/ElectronSecretStore'

export interface ServerConfig {
  /** Where dardar.db and images/ live (Electron passes its userData folder). */
  dataDir: string
  demoSeed: boolean
  allowReset: boolean
  /** First-run stylist: 'auto' (CLI → API → Offline) or a fixed mode (e2e uses 'offline'). */
  defaultAdvisor: 'auto' | AdvisorMode
}

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort

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
      dataDir,
      defaultAdvisor: config.defaultAdvisor,
      imaging: 'studio',
      // Inside the packaged app the server runs as an Electron utility process: keep the key in the OS keychain.
      secrets: parentPort ? new ElectronSecretStore(parentPort) : undefined,
    })
    return createApiRouter(container)
  })()
  return api
}
