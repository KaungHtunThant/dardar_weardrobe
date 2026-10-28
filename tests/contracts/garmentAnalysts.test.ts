import { describe, expect, it } from 'vitest'
import type { StructuredMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeApiGarmentAnalyst } from '../../server/ai/ClaudeApiGarmentAnalyst'
import { ClaudeCliGarmentAnalyst } from '../../server/ai/ClaudeCliGarmentAnalyst'
import { OfflineGarmentAnalyst } from '../../server/ai/OfflineGarmentAnalyst'
import type { ProcessRunner } from '../../server/ai/process'
import { garmentAnalystContract, photo } from './garmentAnalyst.contract'

/** What a model might answer: a box that spills over the edge and a category outside our vocabulary. */
const noisy = {
  box: { x: 0.2, y: -0.05, width: 0.9, height: 0.6 },
  worn: true,
  garment: { name: ' Red Tee ', category: 'tops', colors: ['Red'], seasons: ['summer'], occasions: ['casual'] },
}

const cliRunner: ProcessRunner = async (_cmd, _args, { signal }) => {
  signal?.throwIfAborted()
  return { code: 0, stdout: JSON.stringify({ type: 'result', is_error: false, structured_output: noisy }), stderr: '' }
}
const apiMessages: StructuredMessages = {
  async parse() {
    return { stop_reason: 'end_turn', parsed_output: noisy }
  },
}

garmentAnalystContract('ClaudeCliGarmentAnalyst (fake process)', () => new ClaudeCliGarmentAnalyst({ runner: cliRunner }))
garmentAnalystContract('ClaudeApiGarmentAnalyst (fake client)', () => new ClaudeApiGarmentAnalyst({ messages: apiMessages }))
garmentAnalystContract('OfflineGarmentAnalyst', () => new OfflineGarmentAnalyst())

describe('Claude garment analysts', () => {
  it('CLI reads the original photo from its folder, as the stylist', async () => {
    let args: string[] = []
    let input = ''
    const runner: ProcessRunner = async (c, a, o) => {
      args = a
      input = o.input ?? ''
      return cliRunner(c, a, o)
    }
    const a = await new ClaudeCliGarmentAnalyst({ runner }).analyze(photo)
    expect(a).toEqual({
      focus: { x: 0.2, y: 0, w: 0.8, h: 0.55 },
      worn: true,
      details: { name: 'Red Tee', category: 'tops', colors: ['red'], seasons: ['summer'], occasions: ['casual'] },
    })
    expect(args).toEqual(expect.arrayContaining(['--tools', 'Read', '--add-dir', '/data/images']))
    expect(input).toContain('/data/images/original.png')
    expect(input).toMatch(/Task: find the garment/)
  })

  it('CLI needs the photo on disk', async () => {
    const runner: ProcessRunner = async () => Promise.reject(new Error('should not run'))
    expect(await new ClaudeCliGarmentAnalyst({ runner }).analyze({ ...photo, path: null })).toEqual({ focus: null, worn: false, details: {} })
  })

  it('API sends the photo as base64 and passes the signal on', async () => {
    let params: Parameters<StructuredMessages['parse']>[0] | undefined
    const messages: StructuredMessages = {
      async parse(p) {
        params = p
        return { stop_reason: 'end_turn', parsed_output: noisy }
      },
    }
    const a = await new ClaudeApiGarmentAnalyst({ messages }).analyze(photo)
    expect(a.focus).toEqual({ x: 0.2, y: 0, w: 0.8, h: 0.55 })
    expect(params!.messages[0]!.content).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'image', source: expect.objectContaining({ type: 'base64', media_type: 'image/png' }) })]),
    )
  })

  it('API treats a refusal as nothing found', async () => {
    const messages: StructuredMessages = { parse: async () => ({ stop_reason: 'refusal', parsed_output: null }) }
    expect(await new ClaudeApiGarmentAnalyst({ messages }).analyze(photo)).toEqual({ focus: null, worn: false, details: {} })
  })
})
