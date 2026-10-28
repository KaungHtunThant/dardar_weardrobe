import { useApi } from '../bootstrap'

/** Every /api/* request goes through the route table in server/http/routes.ts. */
export default defineEventHandler(async (event) => {
  const { dataDir, demoSeed, allowReset } = useRuntimeConfig(event)
  const router = await useApi({ dataDir, demoSeed: Boolean(demoSeed), allowReset: Boolean(allowReset) })
  return router.handler(event)
})
