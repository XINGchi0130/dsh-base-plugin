/**
 * 会话面板的路由：终端面板（官方 `terminals` 服务上的 PTY）、文件
 * 变更面板（git）与监控面板（官方 sessionStats 投影 + token 折叠）。
 * 各域共用 deps 里的会话-cwd 围栏。
 * @module dsh-base-plugin/lib/routes/panels
 */
import { gitAvailable, gitFileDiff, gitStatus } from '../git.js'
import { fileOps, fileOpsAvailable } from '../file-ops.js'
import { monitorAvailable, sessionMonitor } from '../monitor.js'
import { systemResources } from '../sysres.js'
import { readJsonBody, sendJson } from './http.js'

export function terminalsRoutes(ctx, deps) {
  const terminalApi = deps.terminalApi
  return [
    // GET /dsh-base-plugin/api/terminal/available —— terminals 服务是否挂载（决定 ⋯ 菜单是否显示终端入口）
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/terminal/available',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: { available: terminalApi.available() } })
      },
    },
    // POST /dsh-base-plugin/api/terminal/open { sessionId, name, cwd }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/open',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const cwd = String(body.cwd ?? '')
        if (cwd !== '') deps.assertCwd(cwd)
        const value = await terminalApi.open(String(body.sessionId ?? ''), String(body.name ?? ''), cwd)
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/terminal/list { sessionId }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/list',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await terminalApi.list(String(body.sessionId ?? ''))
        sendJson(res, 200, { ok: true, value: { terminals: value } })
      },
    },
    // POST /dsh-base-plugin/api/terminal/send
    // { sessionId, terminalId, opKey, text, submit }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/send',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await terminalApi.send(
          String(body.sessionId ?? ''),
          String(body.terminalId ?? ''),
          String(body.opKey ?? ''),
          typeof body.text === 'string' ? body.text : '',
          body.submit === true,
        )
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/terminal/read { sessionId, terminalId, opKey }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/read',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await terminalApi.read(String(body.sessionId ?? ''), String(body.terminalId ?? ''), String(body.opKey ?? ''))
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/terminal/interrupt { sessionId, opKey }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/interrupt',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await terminalApi.interrupt(String(body.sessionId ?? ''), String(body.opKey ?? ''))
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/terminal/kill { sessionId, terminalId }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/terminal/kill',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await terminalApi.kill(String(body.sessionId ?? ''), String(body.terminalId ?? ''))
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}

export function gitRoutes(ctx, deps) {
  return [
    // GET /dsh-base-plugin/api/git/available —— 宿主是否存在 git 二进制
    // （为 true 时 ⋯ 菜单才注册文件变更入口）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/available',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: { available: await gitAvailable() } })
      },
    },
    // GET /dsh-base-plugin/api/git/status?cwd=... —— 工作区变更；未初始化
    // 仓库时自动 init 并打基线提交（见 git.js）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/status',
      handler: async (_req, res, url) => {
        // cwd 必须命中会话存储里的真实工作区（http.js 的围栏）：否则本
        // 端点可在任意绝对路径上 init 仓库/读 diff——等于远程文件探测。
        const cwd = url.searchParams.get('cwd') ?? ''
        deps.assertCwd(cwd)
        const value = await gitStatus(cwd)
        sendJson(res, 200, { ok: true, value })
      },
    },
    // GET /dsh-base-plugin/api/git/diff?cwd=...&file=... —— 单文件的
    // unified diff（未跟踪文件回退到 --no-index 全量增行展示）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/diff',
      handler: async (_req, res, url) => {
        const cwd = url.searchParams.get('cwd') ?? ''
        const file = url.searchParams.get('file') ?? ''
        deps.assertCwd(cwd)
        const value = await gitFileDiff(cwd, file)
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}

export function fileOpsRoutes(ctx) {
  return [
    // GET /dsh-base-plugin/api/fileops/available —— 数据源是否在场。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/fileops/available',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: { available: fileOpsAvailable(ctx) } })
      },
    },
    // GET /dsh-base-plugin/api/fileops?sessionId=... —— 该会话的操作
    // 轨迹（write/edit/read/bash；按目标分组、最新在前，±行数来自
    // 官方 meta.diffs 的形状折叠——不存 diff 文本）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/fileops',
      handler: async (_req, res, url) => {
        const value = await fileOps(ctx, url.searchParams.get('sessionId') ?? '')
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}

export function monitorRoutes(ctx) {
  return [
    // GET /dsh-base-plugin/api/monitor/available —— 数据源（sessionStats
    // 投影 + 会话持久化）是否在场（决定 ⋯ 菜单是否显示监控入口）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/monitor/available',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: { available: monitorAvailable(ctx) } })
      },
    },
    // GET /dsh-base-plugin/api/sysres —— 系统资源快照（CPU 差分采样、
    // 内存、负载；CPU 首答为 null，第二次起有真值——见 sysres.js）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/sysres',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: systemResources() })
      },
    },
    // GET /dsh-base-plugin/api/monitor?sessionId=... —— 一个会话的运行
    // 概况：官方整日志统计投影 + 增量折叠的 token 用量。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/monitor',
      handler: async (_req, res, url) => {
        const value = await sessionMonitor(ctx, url.searchParams.get('sessionId') ?? '')
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}
