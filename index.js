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
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHome, statePath } from './lib/env.js'
import { commit, mutateState } from './lib/patch.js'
import { installNotifyBridge, notifyFrom } from './lib/notify.js'
import { registerRoutes } from './lib/routes.js'
import { loadState, saveState } from './lib/state.js'
import { MobileAuth } from './lib/mobile/auth.js'
import { startMobileProxy } from './lib/mobile/server.js'
import { secretFromRecord } from './lib/mobile/upstream-auth.js'

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
 * the proxy on next boot). 经 mutateState 互斥临界区：与 install 的
 * commit 窗口并发时同步直写会被旧快照覆盖（secret/devices 静默回滚）。 */
function persistMobile() {
  if (authInstance === null) return Promise.resolve()
  return mutateState(function (state) {
    const live = authInstance.state
    if (state.mobile === null) {
      state.mobile = { enabled: false, port: live.port, secret: live.secret, devices: live.devices }
    } else {
      state.mobile.secret = live.secret
      state.mobile.devices = live.devices
    }
  }).catch(function (error) {
    if (ctxRef !== null) ctxRef.logger.warn(`dsh-base-plugin: mobile state persist failed: ${String(error)}`)
  })
}

// Hard dependency: routes must register the moment the web server exists.
// A boot-time race (dsh-base-plugin mounting before webServer) otherwise leaves the
// HTTP API permanently unregistered and the settings pages get SPA HTML.
export const inject = ['webServer']

export async function apply(ctx) {
  ctxRef = ctx
  // fiber 停止时释放模块级引用：HMR/插件更新会先装新 fiber 再停旧
  // fiber，无此释放时旧 fiber 的 ctx 可能残留，persistMobile 的告警
  // 会写向已销毁 fiber 的 logger。只清属于自己的赋值（新 fiber 已
  // 覆写时不误伤）。
  ctx.effect(() => () => { if (ctxRef === ctx) ctxRef = null }, 'dsh-base-plugin: ctxRef release')
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
    // await（apply 是 async）：writeHomePatch 的失败曾完全静默。
    await commit(state)
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

  // dsh ≥ 0.1.2-alpha.1 的浏览器鉴权：每次启动生成进程级 launch token，
  // 出现在 dsh web 的启动横幅里；进程一死 token 即作废。浏览器完成一次
  // token → cookie 交换后 30 天内免疫重启，但"token 无处可寻"曾让多次
  // 重启之间反复 401。这里在 connection 服务就绪后把当前进程的完整
  // token URL 持久化到固定文件（0600，与状态文件同标准），任何时候
  // `cat ~/.dsh/dsh-web-url.txt` 都能拿到属于当前进程的 URL。
  // cookie 按访问域名分别绑定（127.0.0.1 与 localhost 互不通用——第 4 次
  // 401 风暴的根因），因此两个域名各写一行，别再用错入口。
  ctx.inject(['connection'], (connectionCtx) => {
    try {
      const port = typeof connectionCtx.webServer?.port === 'number' ? connectionCtx.webServer.port : 3080
      const urls = [
        connectionCtx.connection.authenticatedUrl(`http://127.0.0.1:${String(port)}`),
        connectionCtx.connection.authenticatedUrl(`http://localhost:${String(port)}`),
      ]
      writeFileSync(join(dshHome(), 'dsh-web-url.txt'), `${urls.join('\n')}\n`, { mode: 0o600 })
      ctx.logger.info?.('dsh-base-plugin: launch URLs (127.0.0.1 + localhost) persisted to ~/.dsh/dsh-web-url.txt')
    } catch (error) {
      ctx.logger.warn?.(`dsh-base-plugin: cannot persist the launch URL: ${String(error)}`)
    }
  })


  const startMobile = async () => {
    if (mobileHandle !== null) return
    const mobile = loadState().mobile
    if (mobile === null || mobile.enabled !== true) return
    try {
      mobileHandle = await startMobileProxy({
        port: mobile.port,
        upstreamPort: typeof ctx.webServer?.port === 'number' ? ctx.webServer.port : undefined,
        auth: ensureAuth(),
        onStateChange: persistMobile,
        version: 'dsh-base-plugin',
        // dsh ≥ 0.1.2-alpha.1 signs browser sessions with a persistent
        // credential record the upstream Connection plugin owns; both run in
        // this process, so the proxy can mint the same cookie for its hop.
        readUpstreamSecret: async () => {
          const credentials = ctx.get('credentials')
          if (credentials === undefined || typeof credentials.readRecord !== 'function') return undefined
          const record = await credentials.readRecord('client-connection/browser-session')
          return secretFromRecord(record)
        },
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
