/**
 * 会话面板的路由：终端面板（官方 `terminals` 服务上的 PTY）、文件
 * 变更面板（git）与监控面板（官方 sessionStats 投影 + token 折叠）。
 * 各域共用 deps 里的会话-cwd 围栏。
 * @module dsh-base-plugin/lib/routes/panels
 */
import { accessSync, constants, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { gitAvailable, gitCommitDiff, gitFileDiff, gitLog, gitStatus } from '../git.js'
import { fileOps, fileOpsAvailable } from '../file-ops.js'
import { optimizePrompt, promptOptimizerAvailable } from '../prompt-optimizer.js'
import { monitorAvailable, sessionMonitor } from '../monitor.js'
import { systemResources } from '../sysres.js'
import { readJsonBody, sameOrigin, sendJson } from './http.js'

/** PATH 二进制名缓存（扫描全 PATH 代价不小，5 分钟复用）。 */
let pathBinaryCache = { at: 0, names: [] }

function pathBinaries() {
  if (Date.now() - pathBinaryCache.at < 300_000) return pathBinaryCache.names
  const names = new Set()
  for (const dir of String(process.env.PATH ?? '').split(':')) {
    if (dir === '') continue
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      continue // 不可读/不存在的 PATH 目录
    }
    for (const entry of entries) {
      const full = join(dir, entry)
      try {
        if (statSync(full).isFile() && accessSync(full, constants.X_OK) === undefined) names.add(entry)
      } catch {
        // 非可执行/竞态消失——跳过
      }
    }
  }
  pathBinaryCache = { at: Date.now(), names: [...names].sort() }
  return pathBinaryCache.names
}

/** 路径候选：token 解析为「目录前缀 + 文件名碎片」，readdir 过滤。
 * 越界围栏：只补会话 cwd 子树与用户主目录下的路径——补全端点不该
 * 变成任意目录列举器（同源页+Host 白名单之外再加一层）。 */
function pathCandidates(token, cwd) {
  const home = homedir()
  const tilde = token.startsWith('~/')
  const expanded = tilde ? join(home, token.slice(2)) : token
  const base = resolve(cwd, expanded)
  if (base !== cwd && base !== home && !base.startsWith(cwd + '/') && !base.startsWith(home + '/')) return []
  const parent = dirname(base)
  const frag = basename(base)
  let entries
  try {
    entries = readdirSync(parent, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const entry of entries) {
    const name = entry.name
    if (frag !== '' && !name.startsWith(frag)) continue
    let isDir = false
    try {
      isDir = entry.isDirectory() || statSync(join(parent, name)).isDirectory()
    } catch { /* 竞态消失——按文件处理 */ }
    out.push({ text: (tilde ? '~/' + relativizeHome(join(parent, name), home) : join(parent, name)) + (isDir ? '/' : ''), isDir })
  }
  out.sort((a, b) => a.text.localeCompare(b.text))
  return out.slice(0, 20)
}

function relativizeHome(path, home) {
  return path.startsWith(home + '/') ? path.slice(home.length + 1) : path
}

export function terminalsRoutes(ctx, deps) {
  const terminalApi = deps.terminalApi
  return [
    // GET /dsh-base-plugin/api/terminal/complete?cwd=..&text=.. —— shell 级
    // 补全：命令位补 PATH 二进制（前缀），参数位补文件路径（目录+前缀，
    // 围栏限 cwd 子树与主目录）。只读；cwd 过会话围栏。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/terminal/complete',
      handler: async (_req, res, url) => {
        const cwd = url.searchParams.get('cwd') ?? ''
        deps.assertCwd(cwd)
        const text = url.searchParams.get('text') ?? ''
        const token = text.split(/\s+/).pop() ?? ''
        const commandPosition = text.trim().indexOf(' ') === -1
        const candidates = []
        if (commandPosition && token !== '') {
          const lower = token.toLowerCase()
          for (const name of pathBinaries()) {
            if (name.toLowerCase().startsWith(lower)) candidates.push({ text: name, isDir: false })
            if (candidates.length >= 20) break
          }
        } else if (token !== '') {
          for (const entry of pathCandidates(token, cwd)) candidates.push({ text: entry.text, isDir: entry.isDir })
        }
        sendJson(res, 200, { ok: true, value: { commandPosition, candidates } })
      },
    },
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
        // cwd 必填且必须过围栏：空值曾跳过校验、由官方服务取默认目录——
        // 与"terminal cwd 必须命中会话存储"的文档承诺不符。
        if (cwd === '') throw new Error('dsh-base-plugin: cwd is required')
        deps.assertCwd(cwd)
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
    // 仓库时自动 init 并打基线提交（见 git.js）。副作用 GET：strict
    // 同源——无 Origin 的 no-cors/img 盲请求不得触发 init+提交。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/status',
      handler: async (req, res, url) => {
        if (!sameOrigin(req, true)) {
          sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
          return
        }
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
    // GET /dsh-base-plugin/api/git/log?cwd=...&scope=local|remote&limit&offset
    // —— 提交历史（本地=HEAD 未推送部分；远程=上游/远程跟踪引用），
    // 分页跳过靠 --skip。与 status 同一 cwd 围栏（assertCwd）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/log',
      handler: async (_req, res, url) => {
        const cwd = url.searchParams.get('cwd') ?? ''
        deps.assertCwd(cwd)
        const value = await gitLog(cwd, {
          scope: url.searchParams.get('scope') === 'remote' ? 'remote' : 'local',
          limit: Number(url.searchParams.get('limit')),
          offset: Number(url.searchParams.get('offset')),
        })
        sendJson(res, 200, { ok: true, value })
      },
    },
    // GET /dsh-base-plugin/api/git/commit-diff?cwd=...&ref=<sha> —— 单个
    // 提交的 unified diff（ref 白名单：十六进制哈希，见 git.js）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/git/commit-diff',
      handler: async (_req, res, url) => {
        const cwd = url.searchParams.get('cwd') ?? ''
        deps.assertCwd(cwd)
        const value = await gitCommitDiff(cwd, url.searchParams.get('ref') ?? '')
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}

export function promptOptimizerRoutes(ctx, deps) {
  return [
    // GET /dsh-base-plugin/api/prompt-opt/available —— llm 服务与默认模型
    // 选择是否在场（决定 ⋯ 菜单是否显示提示词入口）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/prompt-opt/available',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: { available: promptOptimizerAvailable(ctx) } })
      },
    },
    // POST /dsh-base-plugin/api/prompt-opt { input } —— 用默认模型优化提示词
    //（一次性应答；无会话、无工具、不落盘）。busy 单飞锁：模型调用是
    // 十秒级长操作，并发多个会同时打满模型配额。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/prompt-opt',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        if (!deps.acquireBusy('prompt optimize')) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const value = await optimizePrompt(ctx, body?.input)
          sendJson(res, 200, { ok: true, value })
        } finally {
          deps.releaseBusy()
        }
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
