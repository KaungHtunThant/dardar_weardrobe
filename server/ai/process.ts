import { spawn } from 'node:child_process'

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

export interface ProcessOptions {
  input?: string
  timeoutMs?: number
  cwd?: string
  /** Aborting kills the process and rejects with the signal's AbortError. */
  signal?: AbortSignal
  /** Receives stdout as it arrives (it is still collected into the result). */
  onStdout?: (chunk: string) => void
}

/** Runs a command with optional stdin; injectable so CLI providers can be tested with fakes. */
export type ProcessRunner = (command: string, args: string[], options: ProcessOptions) => Promise<ProcessResult>

export const runProcess: ProcessRunner = (command, args, { input, timeoutMs = 180_000, cwd, signal, onStdout }) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const finish = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const fail = (e: unknown) => {
      finish()
      child.kill('SIGTERM')
      reject(e)
    }
    const onAbort = () => fail(signal!.reason)
    const timer = setTimeout(() => fail(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
    signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (d: string) => {
      stdout += d
      onStdout?.(d)
    })
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      finish()
      reject(e)
    })
    child.on('close', (code) => {
      finish()
      resolve({ code, stdout, stderr })
    })
    child.stdin.on('error', () => {}) // the child may exit (or be killed) before reading stdin
    child.stdin.end(input ?? '')
  })
