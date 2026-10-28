import { afterAll } from 'vitest'
import { HttpWardrobeGateway } from '~/gateways/HttpWardrobeGateway'
import { startApi } from '../server/harness'
import { wardrobeGatewayContract } from './wardrobeGateway.contract'

const running: { stop(): Promise<void> }[] = []
afterAll(async () => {
  await Promise.all(running.map((api) => api.stop()))
})

wardrobeGatewayContract('HttpWardrobeGateway', async (seed) => {
  const api = await startApi(seed)
  running.push(api)
  return new HttpWardrobeGateway(api.baseURL)
})
