/**
 * dsh-base-plugin — pnpm subprocess runner.
 *
 * All package mutations in the web profile go through here: stdout+stderr are
 * captured (trimmed), failures resolve with a non-zero code instead of
 * throwing, and a hard timeout kills a hung child.
 * @module dsh-base-plugin/lib/pnpm
 */
import { spawn } from 'node:child_process'

/** Run `pnpm <args>` in a directory; resolves { code, out } (out = trimmed stdout+stderr).
 * 输出封顶 4 MiB（runGit 同标准）：大依赖树的 verbose 输出可达数十 MB，
 * 15 分钟超时窗口内无界累积是纯内存尖峰；错误信息调用方只取尾部
 * slice(-4000)，封顶不影响诊断。 */
const MAX_OUTPUT_CHARS = 4 * 1024 * 1024

export function runPnpm(args, cwd, timeoutMs = 15 * 60 * 1000) {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    const child = spawn('pnpm', args, {
      cwd,
      env: process.env,
      shell: process.platform === 'win32',
    })
    const finish = (code, suffix = '') => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code, out: out.trim() + suffix })
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      finish(-1, '\n[dsh-base-plugin] pnpm timed out')
    }, timeoutMs)
    const onData = (chunk) => {
      out += String(chunk)
      if (out.length <= MAX_OUTPUT_CHARS) return
      // 封顶：丢弃后续输出（子进程照常跑完拿退出码），标记可见。
      out = out.slice(0, MAX_OUTPUT_CHARS) + '\n[dsh-base-plugin] output truncated (size limit reached)'
      child.stdout.removeListener('data', onData)
      child.stderr.removeListener('data', onData)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      finish(-1, `\n[dsh-base-plugin] failed to spawn pnpm: ${error.message}`)
    })
    child.on('close', (code) => {
      finish(code ?? -1)
    })
  })
}
