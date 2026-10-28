import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import { ValidationError } from '#shared/errors'
import { ElectronSecretStore, type ParentPort } from '../../server/settings/ElectronSecretStore'
import { FileSecretStore } from '../../server/settings/FileSecretStore'
import { SettingsService, type AdvisorFactory } from '../../server/settings/SettingsService'
import { SettingsStore } from '../../server/settings/SettingsStore'
import type { ProcessRunner } from '../../server/ai/process'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dardar-settings-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const named = (name: string): StyleAdvisor => ({ suggestLook: async () => ({ title: name }) as never })
const factory: AdvisorFactory = {
  offline: () => named('offline'),
  cli: (s) => named(`cli:${s.model}`),
  api: (s, key) => named(`api:${s.model}:${s.effort}:${key}`),
}
const cliPresent: ProcessRunner = async () => ({ code: 0, stdout: '2.1.312 (Claude Code)\n', stderr: '' })
const cliMissing: ProcessRunner = async () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

function service(opts: { runner?: ProcessRunner; env?: string; defaultAdvisor?: 'auto' | 'offline' } = {}) {
  return new SettingsService({
    store: new SettingsStore(join(dir, 'settings.json')),
    secrets: new FileSecretStore(join(dir, 'secrets.json')),
    runner: opts.runner ?? cliMissing,
    advisors: factory,
    envApiKey: () => opts.env ?? null,
    defaultAdvisor: opts.defaultAdvisor ?? 'auto',
  })
}
const nameOf = async (a: StyleAdvisor) => ((await a.suggestLook({} as never)) as unknown as { title: string }).title

describe('SettingsService', () => {
  it('defaults to the CLI when it is installed, else the API with a key, else offline', async () => {
    expect((await service({ runner: cliPresent }).get()).advisor).toBe('claude-cli')
    expect((await service({ env: 'sk-env' }).get()).advisor).toBe('claude-api')
    expect((await service().get()).advisor).toBe('offline')
    expect((await service({ runner: cliPresent, defaultAdvisor: 'offline' }).get()).advisor).toBe('offline')
  })

  it('reports CLI availability and version', async () => {
    expect((await service({ runner: cliPresent }).get()).cli).toEqual({ available: true, version: '2.1.312' })
    expect((await service().get()).cli).toEqual({ available: false, version: null })
  })

  it('persists choices and validates them', async () => {
    await service().update({ advisor: 'claude-api', model: 'claude-sonnet-5-5', effort: 'high' })
    const view = await service().get()
    expect(view).toMatchObject({ advisor: 'claude-api', model: 'claude-sonnet-5-5', effort: 'high' })
    await expect(service().update({ advisor: 'gpt' as never })).rejects.toBeInstanceOf(ValidationError)
  })

  it('stores the API key privately and never returns it', async () => {
    const view = await service().update({ apiKey: 'sk-ant-secret-1234' })
    expect(view.apiKey).toEqual({ present: true, source: 'stored', last4: '1234' })
    expect(JSON.stringify(view)).not.toContain('secret')
    expect(statSync(join(dir, 'secrets.json')).mode & 0o777).toBe(0o600)
    expect(readFileSync(join(dir, 'settings.json'), 'utf8')).not.toContain('sk-ant')
    expect((await service().update({ apiKey: null })).apiKey.present).toBe(false)
  })

  it('lets an environment key win over the stored one', async () => {
    await service().update({ apiKey: 'sk-stored-0000' })
    expect((await service({ env: 'sk-env-9999' }).get()).apiKey).toEqual({ present: true, source: 'env', last4: '9999' })
  })

  it('resolves the advisor from the current settings', async () => {
    const s = service()
    expect(await nameOf(await s.resolveAdvisor())).toBe('offline')
    await s.update({ advisor: 'claude-cli', model: 'claude-opus-5-5' })
    expect(await nameOf(await s.resolveAdvisor())).toBe('cli:claude-opus-5-5')
    await s.update({ advisor: 'claude-api', apiKey: 'sk-1', effort: 'low' })
    expect(await nameOf(await s.resolveAdvisor())).toBe('api:claude-opus-5-5:low:sk-1')
  })

  it('explains what to do when API mode has no key', async () => {
    const s = service()
    await s.update({ advisor: 'claude-api' })
    await expect(s.resolveAdvisor()).rejects.toThrow(/API key/)
  })
})

describe('ElectronSecretStore', () => {
  it('asks the Electron main process (safeStorage) over the parent port', async () => {
    const listeners: ((e: { data: unknown }) => void)[] = []
    let stored: string | null = null
    const port: ParentPort = {
      on: (_event, fn) => listeners.push(fn),
      postMessage(msg: { id: number; type: string; value?: string | null }) {
        if (msg.type === 'secret:set') stored = msg.value ?? null
        queueMicrotask(() => listeners.forEach((l) => l({ data: { type: 'secret:result', id: msg.id, value: stored } })))
      },
    }
    const store = new ElectronSecretStore(port)
    expect(store.secure).toBe(true)
    await store.setApiKey('sk-x')
    expect(await store.getApiKey()).toBe('sk-x')
  })
})
