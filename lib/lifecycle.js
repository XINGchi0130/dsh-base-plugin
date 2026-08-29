/**
 * dsh-base-plugin — dsh process lifecycle: stop and restart.
 *
 * STOP asks the launcher's bounded exit (`ctx.appExit`) for a graceful
 * shutdown — the tree is disposed first, so session logs flush — and falls
 * back to `process.exit(0)` only when no launcher provided it.
 *
 * RESTART cannot be an in-process action: the web server must release its
 * port. Instead a detached node helper is spawned that polls the old pid
 * every 300ms (bounded to 60s); once the old process is gone it re-execs
 * the SAME invocation — `process.execArgv` included, so `--import tsx/esm`
 * source-checkout launches work — detached, with the same cwd and a clean
 * environment (the helper's own handshake vars stripped). The old process
 * then exits gracefully; the client polls until the new one answers and
 * reloads itself.
 * @module dsh-base-plugin/lib/lifecycle
 */
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { dshHome } from './env.js'

/** Exit-delay window: let the HTTP response flush before disposal. */
const EXIT_DELAY_MS = 400

/** Helper poll interval / bound while waiting for the old pid to die. */
const RESTART_POLL_MS = 300
const RESTART_WAIT_LIMIT_MS = 60_000

/** Process facts for the settings UI. */
export function serviceInfo() {
  return {
    pid: process.pid,
    uptimeSec: Math.round(process.uptime()),
    command: [process.execPath, ...process.execArgv, ...process.argv.slice(1)].join(' '),
  }
}

/** Graceful exit now (response already flushed by the caller's delay). */
function exitGracefully(ctx) {
  // Optional service read: the launcher provides 'appExit'; a composition
  // without it falls back to a hard exit. Property access (ctx.appExit)
  // would demand an inject declaration this plugin must not make.
  const exit = ctx.get('appExit')
  if (typeof exit === 'function') exit(0)
  else process.exit(0)
}

/**
 * Stop the dsh service: dispose the tree (session flush) then exit.
 * @returns acknowledgement for the response body.
 */
export function stopService(ctx) {
  setTimeout(() => exitGracefully(ctx), EXIT_DELAY_MS)
  return { stopping: true }
}

/**
 * Restart the dsh service: detached helper re-execs this invocation once
 * this pid is gone; then this process stops gracefully.
 *
 * The re-exec'd argv APPENDS `--no-open`: the official `dsh web` startup
 * hands the URL to the default browser (openBrowser defaults true; only the
 * `--no-open` flag or an SSH launch suppresses it). The user's page is
 * already open and polls to reload itself, so a browser handoff on restart
 * just opens a duplicate tab. Appending the official flag is idempotent
 * (an argv already carrying it keeps working) and lets a user who WANTS the
 * re-open simply not rely on restart for it.
 * @returns acknowledgement for the response body.
 */
export function restartService(ctx) {
  const env = { ...process.env }
  env.DSH_BP_RESTART_PID = String(process.pid)
  env.DSH_BP_RESTART_LOG = join(dshHome(), 'dsh-base-plugin-restart.log')
  // Idempotent append: never add a second --no-open when the invocation
  // already carries one (a repeated negation flag is tolerated by commander,
  // but a clean argv needs no tolerance).
  const originalArgv = [...process.execArgv, ...process.argv.slice(1)]
  const reexecArgv = originalArgv.includes('--no-open') ? originalArgv : [...originalArgv, '--no-open']
  env.DSH_BP_RESTART_ARGV = JSON.stringify([
    process.execPath,
    reexecArgv,
    process.cwd(),
  ])
  const helper = [
    'const { spawn } = require("node:child_process");',
    'const fs = require("node:fs");',
    'const pid = Number(process.env.DSH_BP_RESTART_PID);',
    'const argv = JSON.parse(process.env.DSH_BP_RESTART_ARGV);',
    `const limit = ${RESTART_WAIT_LIMIT_MS};`,
    `const step = ${RESTART_POLL_MS};`,
    'const env = { ...process.env };',
    'delete env.DSH_BP_RESTART_PID; delete env.DSH_BP_RESTART_ARGV;',
    'let waited = 0;',
    '(function tick() {',
    '  try { process.kill(pid, 0) } catch {',
    // The re-exec must NOT inherit this dying process\'s stdio (it goes away
    // with the plugin fiber), but "ignore" swallowed the child\'s own startup
    // banner — including the per-process token URL "dsh web" prints. Bind the
    // child\'s stdio to the restart log instead, so a restart\'s token (and
    // any startup error) is always discoverable on disk.
    '    let stdio = "ignore";',
    '    try {',
    '      const fd = fs.openSync(String(process.env.DSH_BP_RESTART_LOG || ""), "a");',
    '      stdio = [fd, fd, fd];',
    '      fs.appendFileSync(fd, `--- dsh web restart ${new Date().toISOString()} ---\\n`);',
    '    } catch (e) { /* log unavailable — fall back to ignore */ }',
    '    spawn(argv[0], argv[1], { detached: true, stdio, cwd: argv[2], env }).unref();',
    '    return',
    '  }',
    '  if ((waited += step) > limit) {',
    '    try { require("node:fs").appendFileSync(String(process.env.DSH_BP_RESTART_LOG || ""), `${new Date().toISOString()} restart helper: old pid ${pid} still alive after ${limit}ms — gave up\n`) } catch (e) {}',
    '    return',
    '  }',
    '  setTimeout(tick, step)',
    '})()',
  ].join('\n')
  spawn(process.execPath, ['-e', helper], { detached: true, stdio: 'ignore', env }).unref()
  setTimeout(() => exitGracefully(ctx), EXIT_DELAY_MS)
  return { restarting: true }
}
