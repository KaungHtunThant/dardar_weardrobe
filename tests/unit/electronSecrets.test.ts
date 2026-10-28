import { describe, expect, it } from 'vitest'
import { createSecretHandler, type SecretDeps } from '../../electron/secrets'

/** Fake keychain: "encrypts" by reversing, keeps the file in memory. */
function deps(available = true): SecretDeps & { file: Buffer | null } {
  const d = {
    file: null as Buffer | null,
    available: async () => available,
    encrypt: async (s: string) => Buffer.from([...s].reverse().join('')),
    decrypt: async (b: Buffer) => [...b.toString()].reverse().join(''),
    read: () => d.file,
    write: (b: Buffer) => void (d.file = b),
    remove: () => void (d.file = null),
  }
  return d
}

describe('createSecretHandler (Electron main process)', () => {
  it('stores the key encrypted and reads it back', async () => {
    const d = deps()
    const handle = createSecretHandler(d)
    expect(await handle({ type: 'secret:get', id: 1 })).toEqual({ type: 'secret:result', id: 1, value: null })
    expect(await handle({ type: 'secret:set', id: 2, value: 'sk-ant-1234' })).toEqual({ type: 'secret:result', id: 2, value: 'sk-ant-1234' })
    expect(d.file!.toString()).not.toContain('sk-ant')
    expect(await handle({ type: 'secret:get', id: 3 })).toEqual({ type: 'secret:result', id: 3, value: 'sk-ant-1234' })
    await handle({ type: 'secret:set', id: 4, value: null })
    expect(d.file).toBeNull()
  })

  it('reports whether the OS keychain is there', async () => {
    expect(await createSecretHandler(deps(true))({ type: 'secret:status', id: 1 })).toEqual({ type: 'secret:result', id: 1, value: 'keychain' })
    expect(await createSecretHandler(deps(false))({ type: 'secret:status', id: 1 })).toEqual({ type: 'secret:result', id: 1, value: 'unavailable' })
  })

  it('never writes the key without a keychain', async () => {
    const d = deps(false)
    expect(await createSecretHandler(d)({ type: 'secret:set', id: 1, value: 'sk-ant-1234' })).toMatchObject({ id: 1, value: null, error: 'unavailable' })
    expect(d.file).toBeNull()
  })

  it('treats an unreadable key as no key, and ignores other messages', async () => {
    const d = deps()
    d.file = Buffer.from('garbage')
    d.decrypt = async () => Promise.reject(new Error('bad'))
    expect(await createSecretHandler(d)({ type: 'secret:get', id: 1 })).toEqual({ type: 'secret:result', id: 1, value: null })
    expect(await createSecretHandler(d)({ type: 'something-else', id: 2 })).toBeNull()
  })
})
