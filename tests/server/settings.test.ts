import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { StyleAdvisor } from '#shared/contracts/StyleAdvisor'
import { ValidationError } from '#shared/errors'
import { ElectronSecretStore, type ParentPort } from '../../server/settings/ElectronSecretStore'
import { createSecretHandler } from '../../electron/secrets'
import { FileSecretStore } from '../../server/settings/FileSecretStore'
import { SettingsService, type AdvisorFactory } from '../../server/settings/SettingsService'
import { SettingsStore } from '../../server/settings/SettingsStore'
import type { ProcessRunner } from '../../server/ai/process'
import { LocalStylistAgent } from '../../server/agent/LocalStylistAgent'

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

function service(opts: { runner?: ProcessRunner; env?: string; defaultAdvisor?: 'auto' | 'offline'; agent?: LocalStylistAgent } = {}) {
  return new SettingsService({
    agent: opts.agent,
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
    // POSIX permissions; Windows keeps the file private through the user's profile ACL instead.
    if (process.platform !== 'win32') expect(statSync(join(dir, 'secrets.json')).mode & 0o777).toBe(0o600)
    expect(view.keyStorage).toBe('private-file')
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

  it('sets up on first launch: creates the stylist agent and saves the stylist it picked', async () => {
    const agent = new LocalStylistAgent(join(dir, 'agent'), { now: () => new Date('2026-10-28T10:00:00Z'), newId: () => 'x' })
    const s = service({ runner: cliPresent, agent })
    await s.setUp()
    expect(agent.cliAgentsFile()).not.toBeNull()
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')).advisor).toBe('claude-cli')
    // A later start keeps the saved choice even if the CLI has gone.
    await service({ runner: cliMissing, agent }).setUp()
    const view = await service({ runner: cliMissing, agent }).get()
    expect(view.advisor).toBe('claude-cli')
    expect(view.agent).toMatchObject({ name: 'dardar-stylist', displayName: 'Dardar', createdAt: '2026-10-28T10:00:00.000Z' })
  })

  it('remembers that the user has met their stylist', async () => {
    expect((await service().get()).welcomed).toBe(false)
    expect((await service().update({ welcomed: true })).welcomed).toBe(true)
  })

  it('recreates the stylist agent on request', async () => {
    let now = '2026-10-28T10:00:00Z'
    const agent = new LocalStylistAgent(join(dir, 'agent'), { now: () => new Date(now), newId: () => 'x' })
    const s = service({ agent })
    await s.setUp()
    now = '2026-11-01T09:00:00Z'
    expect((await s.recreateAgent()).agent?.createdAt).toBe('2026-11-01T09:00:00.000Z')
    expect((await service().get()).agent).toBeNull()
  })

  it('explains what to do when API mode has no key', async () => {
    const s = service()
    await s.update({ advisor: 'claude-api' })
    await expect(s.resolveAdvisor()).rejects.toThrow(/API key/)
  })
})

describe('ElectronSecretStore', () => {
  /** A parent port wired to the real main-process handler with a fake keychain. */
  function portTo(available: boolean) {
    const listeners: ((e: { data: unknown }) => void)[] = []
    let file: Buffer | null = null
    const handle = createSecretHandler({
      available: async () => available,
      encrypt: async (s) => Buffer.from(s, 'utf8').reverse(),
      decrypt: async (b) => Buffer.from(b).reverse().toString('utf8'),
      read: () => file,
      write: (b) => void (file = b),
      remove: () => void (file = null),
    })
    const port: ParentPort = {
      on: (_event, fn) => listeners.push(fn),
      postMessage(msg) {
        void handle(msg).then((reply) => reply && listeners.forEach((l) => l({ data: reply })))
      },
    }
    return port
  }

  it('asks the Electron main process (safeStorage) over the parent port', async () => {
    const store = new ElectronSecretStore(portTo(true))
    expect(await store.storage()).toBe('keychain')
    await store.setApiKey('sk-x')
    expect(await store.getApiKey()).toBe('sk-x')
  })

  it('refuses to store a key when the computer has no keychain, and says what to do instead', async () => {
    const store = new ElectronSecretStore(portTo(false))
    expect(await store.storage()).toBe('unavailable')
    await expect(store.setApiKey('sk-x')).rejects.toThrow(ValidationError)
    await expect(store.setApiKey('sk-x')).rejects.toThrow(/keychain.*ANTHROPIC_API_KEY/s)
    expect(await store.getApiKey()).toBeNull()
  })

  it('shows the settings page where the key is kept', async () => {
    const view = await new SettingsService({
      store: new SettingsStore(join(dir, 'settings.json')),
      secrets: new ElectronSecretStore(portTo(false)),
      runner: cliMissing,
      advisors: factory,
      envApiKey: () => null,
      defaultAdvisor: 'auto',
    }).get()
    expect(view.keyStorage).toBe('unavailable')
  })
})
