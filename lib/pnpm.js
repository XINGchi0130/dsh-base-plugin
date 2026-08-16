/**
 * dsh-base-plugin — pnpm subprocess runner.
 *
 * All package mutations in the web profile go through here: stdout+stderr are
 * captured (trimmed), failures resolve with a non-zero code instead of
 * throwing, and a hard timeout kills a hung child.
 * @module dsh-base-plugin/lib/pnpm
 */
import { spawn } from 'node:child_process'

/** Run `pnpm <args>` in a directory; resolves { code, out } (out = trimmed stdout+stderr). */
export function runPnpm(args, cwd, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    const child = spawn('pnpm', args, {
      cwd,
      env: process.env,
      shell: process.platform === 'win32',
    })
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      resolve({ code: -1, out: `${out}\n[dsh-base-plugin] pnpm ${args.join(' ')} timed out` })
    }, timeoutMs)
    const onData = (chunk) => { out += String(chunk) }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code: -1, out: `${out}\n[dsh-base-plugin] failed to spawn pnpm: ${error.message}` })
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code: code ?? -1, out: out.trim() })
    })
  })
}
