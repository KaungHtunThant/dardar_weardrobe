import { createServer, type Server } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createApp, toNodeListener } from 'h3'
import type { Item } from '#shared/models/item'
import type { StyleMatch } from '#shared/models/styleMatch'
import { createContainer, type ContainerOptions } from '../../server/container'
import { createApiRouter } from '../../server/http/routes'

/** Runs the real API (same route table as Nitro) on a random local port. */
export async function startApi(seed?: { items: Item[]; styleMatches: StyleMatch[] }, options: Partial<ContainerOptions> = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'dardar-api-'))
  const container = await createContainer({
    databasePath: ':memory:',
    imagesDir: join(dataDir, 'images'),
    dataDir,
    seed,
    // Never spawn the real Claude CLI or read a real key in tests.
    runner: async () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
    envApiKey: () => null,
    defaultAdvisor: 'offline',
    ...options,
  })
  const app = createApp().use(createApiRouter(container))
  const server: Server = createServer(toNodeListener(app))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    baseURL,
    container,
    async stop() {
      await new Promise((resolve) => server.close(resolve))
      await container.close()
      rmSync(dataDir, { recursive: true, force: true })
    },
  }
}
