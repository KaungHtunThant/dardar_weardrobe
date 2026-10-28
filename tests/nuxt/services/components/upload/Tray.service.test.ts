import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Upload } from '#shared/models/upload'
import { useUploadTray } from '~/services/components/upload/Tray.service'
import { useUploadsStore } from '~/stores/uploads'
import { setupTestGateway } from '../../../helpers'

const upload = (id: string, over: Partial<Upload> = {}): Upload => ({
  id,
  originalImage: `data:image/png;base64,${id}`,
  cleanImage: null,
  state: 'queued',
  stage: null,
  categoryHint: null,
  suggestion: null,
  backgroundRemoved: false,
  error: null,
  createdAt: '2026-10-29T10:00:00.000Z',
  ...over,
})

describe('upload tray service', () => {
  let gateway: ReturnType<typeof setupTestGateway>
  beforeEach(() => {
    gateway = setupTestGateway()
  })
  afterEach(() => useUploadsStore().stop())

  function withUploads(list: Upload[]) {
    vi.spyOn(gateway, 'listUploads').mockResolvedValue(list)
  }

  it('stays hidden when nothing is being added', async () => {
    withUploads([])
    const vm = useUploadTray()
    await vm.init()
    expect(vm.visible.value).toBe(false)
  })

  it('sums up what Dardar is doing and what is ready', async () => {
    withUploads([
      upload('a', { state: 'processing', stage: 'isolating' }),
      upload('b'),
      upload('c', { state: 'ready', cleanImage: 'data:image/png;base64,clean' }),
      upload('d', { state: 'failed', error: 'Upload a photo first.' }),
    ])
    const vm = useUploadTray()
    await vm.init()
    expect(vm.visible.value).toBe(true)
    expect(vm.summary.value).toBe('Preparing 2 pieces · 1 ready to add · 1 needs a look')
    expect(vm.readyCount.value).toBe(1)
    expect(vm.entries.value.map((e) => e.status)).toEqual(['Cutting it out…', 'Waiting…', 'Ready to add', 'Upload a photo first.'])
    expect(vm.entries.value[2]).toMatchObject({ image: 'data:image/png;base64,clean', canReview: true, canRetry: false })
    expect(vm.entries.value[3]).toMatchObject({ canReview: false, canRetry: true })
  })

  it('says "Dardar is looking" while the stylist studies a photo', async () => {
    withUploads([upload('a', { state: 'processing', stage: 'analyzing' })])
    const vm = useUploadTray()
    await vm.init()
    expect(vm.entries.value[0]!.status).toBe('Dardar is looking…')
    expect(vm.summary.value).toBe('Preparing 1 piece')
  })

  it('opens a ready photo for review and closes it again', async () => {
    withUploads([upload('c', { state: 'ready', cleanImage: 'x' })])
    const vm = useUploadTray()
    await vm.init()
    vm.toggle()
    expect(vm.open.value).toBe(true)
    vm.review('c')
    expect(vm.reviewing.value?.id).toBe('c')
    expect(vm.open.value).toBe(false)
    vm.setReviewOpen(false)
    expect(vm.reviewing.value).toBeNull()
  })

  it('retries and discards photos', async () => {
    withUploads([upload('d', { state: 'failed' })])
    const retry = vi.spyOn(gateway, 'retryUpload').mockResolvedValue(upload('d'))
    const discard = vi.spyOn(gateway, 'discardUpload').mockResolvedValue()
    const vm = useUploadTray()
    await vm.init()
    await vm.retry('d')
    expect(retry).toHaveBeenCalledWith('d')
    await vm.discard('d')
    expect(discard).toHaveBeenCalledWith('d')
  })
})
