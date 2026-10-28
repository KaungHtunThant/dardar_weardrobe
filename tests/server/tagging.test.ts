import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GarmentTagger } from '#shared/contracts/GarmentTagger'
import { ValidationError } from '#shared/errors'
import { ClaudeApiTagger } from '../../server/ai/ClaudeApiTagger'
import type { StructuredMessages } from '../../server/ai/ClaudeApiStyleAdvisor'
import { ClaudeCliTagger } from '../../server/ai/ClaudeCliTagger'
import type { ProcessRunner } from '../../server/ai/process'
import { toDetailsSuggestion } from '../../server/ai/tagPrompt'
import { FsImageStore } from '../../server/infrastructure/FsImageStore'
import { TaggingService } from '../../server/services/TaggingService'

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const raw = { name: '  Blush Silk Blouse ', category: 'tops', colors: ['Blush', 'blush', 'cream'], seasons: ['spring', 'summer'], occasions: ['work'] }

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-tag-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('toDetailsSuggestion', () => {
  it('trims, lower-cases and de-duplicates colours', () => {
    expect(toDetailsSuggestion(raw as never)).toEqual({
      name: 'Blush Silk Blouse',
      category: 'tops',
      colors: ['blush', 'cream'],
      seasons: ['spring', 'summer'],
      occasions: ['work'],
    })
  })

  it('drops anything invalid instead of failing', () => {
    expect(toDetailsSuggestion({ name: '', category: 'hats', colors: [], seasons: ['monsoon'], occasions: ['gala'] } as never)).toEqual({})
  })
})

describe('ClaudeApiTagger', () => {
  it('sends the image as base64 and returns the cleaned suggestion', async () => {
    let content: unknown
    const messages: StructuredMessages = {
      async parse(p) {
        content = p.messages[0]!.content
        return { stop_reason: 'end_turn', parsed_output: raw }
      },
    }
    const s = await new ClaudeApiTagger({ messages }).suggestDetails({ bytes: PNG, mimeType: 'image/png', path: null })
    expect(s.category).toBe('tops')
    expect(content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'image', source: expect.objectContaining({ type: 'base64', media_type: 'image/png' }) })]))
  })

  it('skips formats Claude cannot see (SVG)', async () => {
    const messages: StructuredMessages = { parse: async () => Promise.reject(new Error('should not be called')) }
    expect(await new ClaudeApiTagger({ messages }).suggestDetails({ bytes: PNG, mimeType: 'image/svg+xml', path: null })).toEqual({})
  })
})

describe('ClaudeCliTagger', () => {
  it('lets the CLI read only the image folder and returns the suggestion', async () => {
    let args: string[] = []
    let input = ''
    const runner: ProcessRunner = async (_c, a, o) => {
      args = a
      input = o.input ?? ''
      return { code: 0, stdout: JSON.stringify({ type: 'result', is_error: false, structured_output: raw }), stderr: '' }
    }
    const s = await new ClaudeCliTagger({ runner }).suggestDetails({ bytes: PNG, mimeType: 'image/png', path: '/data/images/a.png' })
    expect(s.name).toBe('Blush Silk Blouse')
    expect(args).toEqual(expect.arrayContaining(['--tools', 'Read', '--allowedTools', '--add-dir', '/data/images']))
    expect(input).toContain('/data/images/a.png')
  })

  it('returns nothing when the image is not on disk', async () => {
    const runner: ProcessRunner = async () => Promise.reject(new Error('should not run'))
    expect(await new ClaudeCliTagger({ runner }).suggestDetails({ bytes: PNG, mimeType: 'image/png', path: null })).toEqual({})
  })
})

describe('TaggingService', () => {
  it('reads the stored clean image and asks the current tagger', async () => {
    const images = new FsImageStore(dir)
    const ref = await images.save(PNG, 'image/png')
    let seen: { mimeType: string; path: string | null } | undefined
    const tagger: GarmentTagger = {
      async suggestDetails(img) {
        seen = img
        return { category: 'tops' }
      },
    }
    const s = await new TaggingService(images, async () => tagger).suggest({ image: ref })
    expect(s).toEqual({ category: 'tops' })
    expect(seen!.path).toBe(images.pathOf(ref))
  })

  it('rejects images that are not in the store', async () => {
    const service = new TaggingService(new FsImageStore(dir), async () => ({ suggestDetails: async () => ({}) }))
    await expect(service.suggest({ image: '/garments/linen-tee.svg' })).rejects.toBeInstanceOf(ValidationError)
  })
})
