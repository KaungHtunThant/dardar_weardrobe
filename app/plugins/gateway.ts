import { createGateway, type GatewayKind } from '~/gateways/createGateway'
import { provideGateway } from '~/gateways/provider'

export default defineNuxtPlugin(() => {
  provideGateway(createGateway(useRuntimeConfig().public.gateway as GatewayKind))
})
