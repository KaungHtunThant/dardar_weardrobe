import { spawn } from 'node:child_process'

export interface ProcessResult {
  code: number | null
  stdout: string
  stderr: string
}

/** Runs a command with optional stdin; injectable so CLI providers can be tested with fakes. */
export type ProcessRunner = (
  command: string,
  args: string[],
  options: { input?: string; timeoutMs?: number; cwd?: string },
) => Promise<ProcessResult>

export const runProcess: ProcessRunner = (command, args, { input, timeoutMs = 180_000, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
    child.stdin.end(input ?? '')
  })
