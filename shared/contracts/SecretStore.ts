/** Where the API key is kept: encrypted by the OS keychain, a private 0600 file (development), or nowhere safe. */
export type KeyStorage = 'keychain' | 'private-file' | 'unavailable'

/** Holds the Anthropic API key outside the database. */
export interface SecretStore {
  storage(): Promise<KeyStorage>
  getApiKey(): Promise<string | null>
  /** Rejects with a ValidationError when the key can't be stored safely. */
  setApiKey(key: string | null): Promise<void>
}
