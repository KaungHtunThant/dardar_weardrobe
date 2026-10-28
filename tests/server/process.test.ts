import { describe, expect, it } from 'vitest'
import { runProcess } from '../../server/ai/process'

const node = process.execPath

describe('runProcess', () => {
  it('pipes stdin and collects stdout and the exit code', async () => {
    const out = await runProcess(node, ['-e', 'process.stdin.pipe(process.stdout)'], { input: 'hello' })
    expect(out).toEqual({ code: 0, stdout: 'hello', stderr: '' })
  })

  it('streams stdout chunks as they arrive', async () => {
    const chunks: string[] = []
    const script = 'process.stdout.write("a\\n"); setTimeout(() => process.stdout.write("b\\n"), 50)'
    const out = await runProcess(node, ['-e', script], { onStdout: (c) => chunks.push(c) })
    expect(chunks.join('')).toBe('a\nb\n')
    expect(out.stdout).toBe('a\nb\n')
  })

  it('kills the process and rejects with an AbortError when aborted', async () => {
    const controller = new AbortController()
    const started = Date.now()
    const run = runProcess(node, ['-e', 'setInterval(() => {}, 1000)'], { signal: controller.signal })
    setTimeout(() => controller.abort(), 100)
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
    expect(Date.now() - started).toBeLessThan(3000)
  })

  it('does not start when already aborted', async () => {
    await expect(runProcess(node, ['-e', ''], { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
