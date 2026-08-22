/**
 * dsh-base-plugin — node half (host plugin): the data and mutation plane behind the
 * browser half's three settings pages (Plugin Market, MCP, Skills).
 *
 * Feature modules live in `lib/`:
 * - `lib/routes.js` — the `/dsh-base-plugin/api/*` HTTP surface on the web server
 * - `lib/market.js` — GitHub market search (cache + ordering modes)
 * - `lib/git.js` — git availability/status/diff for the Changes tab
 *   (auto `git init` + baseline commit on un-initialized workspaces)
 * - `lib/installer.js` — pnpm add/remove + DSH-plugin validation
 * - `lib/patch.js` — the managed block in `~/.dsh/cordis.patch.yml`
 *   (regenerated from `$DSH_HOME/dsh-base-plugin.json`; hot-watched by dsh)
 * - `lib/skills-io.js` — user skill create/edit/delete under `~/.dsh/skills/`
 * - `lib/status.js` — loader/MCP/skill live status readers
 * - `lib/env.js` / `lib/state.js` / `lib/pnpm.js` — shared plumbing
 *
 * The browser half ships from `exports["./client"]` (client.js — a single
 * file by protocol constraint: the web boot loader materializes exactly one
 * factory per package), discovered through the package.json `dsh.client`
 * declaration. All user-visible text lives there in ZH/EN dictionaries
 * following the DSH locale setting.
 *
 * @module dsh-base-plugin
 */
import { chmodSync, existsSync, mkdirSync } from 'node:fs'
import { dshHome, statePath } from './lib/env.js'
import { commit } from './lib/patch.js'
import { installNotifyBridge, notifyFrom } from './lib/notify.js'
import { registerRoutes } from './lib/routes.js'
import { loadState, saveState } from './lib/state.js'
import { MobileAuth } from './lib/mobile/auth.js'
import { startMobileProxy } from './lib/mobile/server.js'

export const name = 'dsh-base-plugin'

/**
 * One MobileAuth per process, bound to ONE long-lived mobile section object.
 * loadState() mints a fresh object graph per call, so rebinding per request
 * would rebuild the auth machine (wiping the live pairing code and backoff)
 * and desync it from the proxy's captured instance — hence the singleton.
 * Persistence goes through persistMobile(): fresh-read the OTHER state
 * fields, swap in the live mobile section, save. Rotation/revocation reach
 * the running proxy immediately because both share this instance.
 */
let authInstance = null
let ctxRef = null
function ensureAuth() {
  if (authInstance === null) {
    const state = loadState()
    const section = state.mobile ?? { enabled: false, port: 8787, secret: '', devices: [] }
    authInstance = new MobileAuth(section)
  }
  if (authInstance.ensureSecret()) persistMobile()
  return authInstance
}

/** Merge the live mobile AUTH fields into a fresh state read and persist.
 * Field ownership: the singleton auth owns `secret` + `devices` (it mutates
 * them); the routes own `enabled` + `port` (toggle writes them). Syncing
 * only the auth fields means a later persist can never resurrect a stale
 * enabled/port over the toggle's fresh write (which would silently re-arm
 * the proxy on next boot). */
function persistMobile() {
  if (authInstance === null) return
  try {
    const state = loadState()
    const live = authInstance.state
    if (state.mobile === null) {
      state.mobile = { enabled: false, port: live.port, secret: live.secret, devices: live.devices }
    } else {
      state.mobile.secret = live.secret
      state.mobile.devices = live.devices
    }
    saveState(state)
  } catch (error) {
    ctxRef.logger.warn(`dsh-base-plugin: mobile state persist failed: ${String(error)}`)
  }
}

// Hard dependency: routes must register the moment the web server exists.
// A boot-time race (dsh-base-plugin mounting before webServer) otherwise leaves the
// HTTP API permanently unregistered and the settings pages get SPA HTML.
export const inject = ['webServer']

export function apply(ctx) {
  ctxRef = ctx
  // Migrate/seed the state file on first load: loadState falls back to the
  // legacy `dsh-hub.json`, so persisting ITS result (never an empty literal)
  // keeps migrated plugins/MCP/persona instead of clobbering them.
  if (!existsSync(statePath())) {
    try {
      mkdirSync(dshHome(), { recursive: true })
      saveState(loadState())
    } catch (error) {
      ctx.logger.warn(`dsh-base-plugin: cannot seed state file: ${String(error)}`)
    }
  }
  // One-time tightening for files created before atomicWrite went 0o600:
  // the state carries the mobile HMAC secret and must not stay world-readable.
  try {
    chmodSync(statePath(), 0o600)
  } catch { /* absent or already gone — the seed above owns fresh files */ }
  // Reconcile the managed block at boot, after one external-terminal check:
  // if some OTHER row already composes @deepseek-ai/dsh-terminal (ids
  // without our `dsh-base-plugin-terminal` prefix), our insert rows would
  // register the `terminals` service twice and fail the NEXT boot — set
  // `skipTerminalRows` and let the rewrite below drop them. Own rows are
  // recognized by the prefix even through include-subtree id prefixes.
  try {
    const state = loadState()
    const loader = ctx.get('loader')
    if (loader !== undefined && typeof loader.entries === 'function') {
      let external = false
      for (const entry of loader.entries()) {
        if (entry.options.group) continue
        const moduleName = entry.options.name
        if ((moduleName === '@deepseek-ai/dsh-terminal' || moduleName === '@deepseek-ai/dsh-terminal-bash')
          && !String(entry.id).includes('dsh-base-plugin-terminal')) {
          external = true
          break
        }
      }
      if (external !== state.skipTerminalRows) {
        state.skipTerminalRows = external
        if (external) ctx.logger.info('dsh-base-plugin: external terminals composition detected — skipping own PTY rows')
      }
    }
    // The persona override row (empty by default) must exist even before
    // the first user mutation. An identical regeneration writes nothing.
    commit(state)
  } catch (error) {
    ctx.logger.warn(`dsh-base-plugin: cannot reconcile the managed patch block: ${String(error)}`)
  }
  // Mobile-access proxy: honor the persisted enabled flag at boot; the
  // settings page toggles it later through the control routes (lib/mobile).
  // The server handle is owned by this fiber — stop() tears the listener
  // down with the plugin.
  let mobileHandle = null
  const stopMobile = async () => {
    if (mobileHandle === null) return
    const handle = mobileHandle
    mobileHandle = null
    try {
      await handle.close()
    } catch (error) {
      ctx.logger.warn(`dsh-base-plugin: mobile proxy close failed: ${String(error)}`)
    }
  }
  ctx.effect(() => () => { void stopMobile() }, 'dsh-base-plugin: mobile server')

  const startMobile = async () => {
    if (mobileHandle !== null) return
    const mobile = loadState().mobile
    if (mobile === null || mobile.enabled !== true) return
    try {
      mobileHandle = await startMobileProxy({
        port: mobile.port,
        auth: ensureAuth(),
        onStateChange: persistMobile,
        version: 'dsh-base-plugin',
      })
      ctx.logger.info(`dsh-base-plugin: mobile access listening on 0.0.0.0:${mobileHandle.port}`)
    } catch (error) {
      ctx.logger.warn(`dsh-base-plugin: mobile proxy failed to start: ${String(error)}`)
    }
  }

  registerRoutes(ctx, {
    startMobile,
    stopMobile,
    ensureAuth,
    persistMobile,
    mobileStatus: () => ({
      running: mobileHandle !== null,
      port: mobileHandle !== null ? mobileHandle.port : (loadState().mobile?.port ?? 8787),
    }),
  })

  // 通知桥：监听器挂在当前 fiber 上（ctx.on/jobs.onJobDone），插件停止
  // 即全部回收；配置逐事件现读（保存/静音改完即生效，无需重装）。
  ctx.effect(
    () => installNotifyBridge(
      ctx,
      () => notifyFrom(loadState().notify ?? {}),
      message => ctx.logger.warn(`dsh-base-plugin: ${message}`),
    ),
    'dsh-base-plugin: notify bridge',
  )

  void startMobile()
}
