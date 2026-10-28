import type { WardrobeGateway } from '#shared/contracts/WardrobeGateway'

// The single seam between stores and whichever gateway is configured (mock now, HTTP later).
let current: WardrobeGateway | null = null

export function provideGateway(gateway: WardrobeGateway) {
  current = gateway
}

export function useGateway(): WardrobeGateway {
  if (!current) throw new Error('No WardrobeGateway provided. Is the gateway plugin registered?')
  return current
}
