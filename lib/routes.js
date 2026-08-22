/**
 * dsh-base-plugin —— DSH web 服务器上的 `/dsh-base-plugin/api/*` HTTP 接口层。
 *
 * 表驱动分发器：各功能域放在 `lib/routes/` 下，导出路由行
 * （`{ method, path, handler }[]`）；本模块负责注册、共享单飞锁、
 * 按请求守卫（变更类请求做同源检查）与错误框定。
 *
 * 域模块清单：
 * - `routes/http.js` —— 读 body / JSON 应答 / 同源检查 / 会话-cwd 围栏
 * - `routes/state.js` —— state / market / skills / persona（设置页）
 * - `routes/panels.js` —— 终端（PTY 面板）+ git（文件变更面板）
 * - `routes/usage-sessions.js` —— 用量统计/价格 + 会话清单/删除
 * - `routes/mobile-service.js` —— 手机访问控制 + 服务停止/重启
 * - `routes/packages-mcp.js` —— 市场安装/卸载 + MCP 配置
 * @module dsh-base-plugin/lib/routes
 */
import { createTerminalsApi } from './terminals-api.js'
import { assertSessionCwd, sameOrigin, sendJson } from './routes/http.js'
import { marketRoutes, promptRoutes, skillsRoutes, stateRoutes } from './routes/state.js'
import { gitRoutes, monitorRoutes, terminalsRoutes } from './routes/panels.js'
import { sessionsRoutes, usageRoutes } from './routes/usage-sessions.js'
import { mobileRoutes, serviceRoutes } from './routes/mobile-service.js'
import { mcpRoutes, packageRoutes } from './routes/packages-mcp.js'

// ── 单飞锁（长时包操作串行化）──────────────────────────────────────────
// pnpm 安装/卸载与用量全量扫描都是分钟级操作且共享同一资源（web profile
// 目录 / 会话日志），并发第二个会互相破坏；用模块级单飞锁串行化。
// 抢锁失败直接抛错——分发器统一框成 400，前端 busy 字段显示占用中的操作。

let busy = { op: null, since: 0 }

function acquireBusy(op) {
  if (busy.op !== null) return false
  busy = { op, since: Date.now() }
  return true
}

function releaseBusy() {
  busy = { op: null, since: 0 }
}

// ── 路由注册 ─────────────────────────────────────────────────────────────

/**
 * 在 web 服务器上注册 `/dsh-base-plugin/api/*` 路由。webServer 是硬
 * inject 依赖（见 index.js），调用时它必然存在。
 */
export function registerRoutes(ctx, mobileControls) {
  const webServer = ctx.webServer
  const terminalApi = createTerminalsApi(ctx)

  // 交给各域模块的共享上下文。单飞锁与会话-cwd 围栏只在本模块持有
  // 一份真身（闭包/函数引用），域模块不各自复制。
  const deps = {
    ensureAuth: mobileControls.ensureAuth,
    mobileControls,
    terminalApi,
    acquireBusy,
    releaseBusy,
    busyOp: () => busy.op,
    assertCwd: (cwd) => assertSessionCwd(ctx, cwd),
  }

  // 汇总各域的路由行为一张 O(1) 查找表：键 "METHOD path"。不支持路径
  // 参数——全部路由都是字面量路径，旧 if 链与之严格一一对应。
  const groups = [
    stateRoutes(ctx, deps),
    marketRoutes(ctx, deps),
    skillsRoutes(ctx, deps),
    promptRoutes(ctx, deps),
    terminalsRoutes(ctx, deps),
    gitRoutes(ctx, deps),
    monitorRoutes(ctx),
    usageRoutes(ctx, deps),
    sessionsRoutes(ctx),
    mobileRoutes(ctx, deps),
    serviceRoutes(ctx),
    packageRoutes(ctx, deps),
    mcpRoutes(),
  ]
  const table = new Map()
  for (const group of groups) {
    for (const route of group) table.set(`${route.method} ${route.path}`, route.handler)
  }

  // 单一请求入口：前缀不匹配返回 false（外层 webServer 回 404）；
  // 变更类请求先过同源检查；查表分发；handler 抛出的任何异常统一
  // 框成 400 JSON——域模块因此只需 throw，不必各自 try/catch。
  const handled = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const path = url.pathname
    const method = req.method ?? 'GET'

    if (!path.startsWith('/dsh-base-plugin/api/')) return false

    // Origin 头存在且跨源 → 403。同源 fetch 与 curl（无 Origin）放行。
    // 这是防 CSRF 的最低门槛，不是鉴权；各端点的自身鉴权另行负责。
    if (method !== 'GET' && !sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
      return true
    }

    const handler = table.get(`${method} ${path}`)
    try {
      if (handler === undefined) {
        sendJson(res, 404, { ok: false, error: `unknown route ${method} ${path}` })
        return true
      }
      await handler(req, res, url)
      return true
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return true
    }
  }

  ctx.effect(
    () => webServer.register({
      kind: 'prefix',
      path: '/dsh-base-plugin',
      handler: async (req, res) => {
        const claimed = await handled(req, res)
        if (!claimed) sendJson(res, 404, { ok: false, error: 'not found' })
      },
    }),
    'dsh-base-plugin: api routes',
  )

  ctx.logger.info('dsh-base-plugin: HTTP API ready at /dsh-base-plugin/api/*')
}
