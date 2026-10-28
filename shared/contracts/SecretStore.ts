/** Holds the Anthropic API key outside the database. */
export interface SecretStore {
  /** True when the OS keychain encrypts the secret. */
  readonly secure: boolean
  getApiKey(): Promise<string | null>
  setApiKey(key: string | null): Promise<void>
}
