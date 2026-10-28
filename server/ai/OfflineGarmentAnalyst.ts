import { NO_ANALYSIS, type GarmentAnalysis, type GarmentAnalyst } from '#shared/contracts/GarmentAnalyst'

/** Without AI nothing is known about the photo: the whole frame is used and the details are left to the user. */
export class OfflineGarmentAnalyst implements GarmentAnalyst {
  async analyze(_image: unknown, { signal }: { signal?: AbortSignal } = {}): Promise<GarmentAnalysis> {
    signal?.throwIfAborted()
    return NO_ANALYSIS
  }
}
