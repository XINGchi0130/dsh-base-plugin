/**
 * 市场包安装/卸载路由（单飞锁下的 pnpm 变更）与 MCP 服务器配置路由
 * （整表 YAML 保存 + 旧版单条增删）。
 * @module dsh-base-plugin/lib/routes/packages-mcp
 */
import { getYaml } from '../env.js'
import { installPackage, uninstallPackage } from '../installer.js'
import { mcpHealth } from '../mcp-health.js'
import { commit } from '../patch.js'
import { loadState } from '../state.js'
import { readJsonBody, sendJson } from './http.js'

const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** 校验并规范化一条 MCP 服务器配置（stdio 或 streamable-http）。
 * 抛出的错误信息直接面向设置页用户，需可读。 */
export function normalizeMcpServer(input) {
  if (input === null || typeof input !== 'object') throw new Error('dsh-base-plugin: body must be an object')
  const serverName = String(input.serverName ?? '').trim()
  if (!SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error('dsh-base-plugin: serverName must match [A-Za-z0-9_-]{1,32}')
  }
  const transport = input.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  if (transport === 'stdio') {
    const command = String(input.command ?? '').trim()
    if (command === '') throw new Error('dsh-base-plugin: command is required for stdio transport')
    const server = { transport, serverName, command }
    if (Array.isArray(input.args)) server.args = input.args.map(a => String(a))
    if (server.args !== undefined && server.args.length === 0) delete server.args
    if (input.env !== null && typeof input.env === 'object' && !Array.isArray(input.env)) {
      const env = {}
      for (const [k, v] of Object.entries(input.env)) env[String(k)] = String(v)
      if (Object.keys(env).length > 0) server.env = env
    }
    return server
  }
  const url = String(input.url ?? '').trim()
  if (!/^https?:\/\//.test(url)) throw new Error('dsh-base-plugin: url must start with http:// or https://')
  const server = { transport, serverName, url }
  if (input.headers !== null && typeof input.headers === 'object' && !Array.isArray(input.headers)) {
    const headers = {}
    for (const [k, v] of Object.entries(input.headers)) headers[String(k)] = String(v)
    if (Object.keys(headers).length > 0) server.headers = headers
  }
  return server
}

export function packageRoutes(ctx, deps) {
  return [
    // POST /dsh-base-plugin/api/install { spec }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/install',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const spec = String(body.spec ?? '').trim()
        if (spec === '') throw new Error('dsh-base-plugin: spec is required')
        // 抢锁失败 = 已有安装/卸载/全量扫描在跑；finally 释放保证异常路径
        // 也不会永久占锁（见 routes.js 的单飞锁说明）。
        if (!deps.acquireBusy(`install ${spec}`)) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const state = loadState()
          const result = await installPackage(ctx, state, spec)
          sendJson(res, 200, { ok: true, value: result })
        } finally {
          deps.releaseBusy()
        }
      },
    },
    // POST /dsh-base-plugin/api/uninstall { name }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/uninstall',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const pkgName = String(body.name ?? '').trim()
        if (pkgName === '') throw new Error('dsh-base-plugin: name is required')
        if (!deps.acquireBusy(`uninstall ${pkgName}`)) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const state = loadState()
          const result = await uninstallPackage(ctx, state, pkgName)
          sendJson(res, 200, { ok: true, value: result })
        } finally {
          deps.releaseBusy()
        }
      },
    },
  ]
}

export function mcpRoutes(ctx) {
  return [
    // POST /dsh-base-plugin/api/mcp/save { yaml } —— 整表替换受管服务器
    // 列表（设置页的 YAML 编辑器全量保存）。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mcp/save',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const text = typeof body.yaml === 'string' ? body.yaml : ''
        const yaml = getYaml()
        if (yaml === null) throw new Error('dsh-base-plugin: the yaml package is not resolvable — cannot save MCP configuration')
        // YAML 语法错误要包装成带行号的友好信息（yaml 包的 message 自带），
        // 让设置页的编辑器里能直接看出哪行写坏了。
        let parsed
        try {
          parsed = yaml.parse(text)
        } catch (error) {
          throw new Error(`dsh-base-plugin: YAML syntax error: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (parsed === null || parsed === undefined) parsed = []
        if (!Array.isArray(parsed)) throw new Error('dsh-base-plugin: the document must be a YAML list of server entries (or an empty list)')
        const servers = parsed.map((item, index) => {
          try {
            return normalizeMcpServer(item)
          } catch (error) {
            throw new Error(`dsh-base-plugin: server #${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
          }
        })
        const seen = new Set()
        for (const server of servers) {
          if (seen.has(server.serverName)) throw new Error(`dsh-base-plugin: duplicate serverName "${server.serverName}"`)
          seen.add(server.serverName)
        }
        const state = loadState()
        state.mcpServers = servers
        commit(state)
        sendJson(res, 200, { ok: true, value: { count: servers.length } })
      },
    },
    // POST /dsh-base-plugin/api/mcp/add { transport, serverName, ... }（旧版单条表单，保留兼容）
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mcp/add',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const server = normalizeMcpServer(body)
        const state = loadState()
        if (state.mcpServers.some(s => s.serverName === server.serverName)) {
          throw new Error(`dsh-base-plugin: server name "${server.serverName}" already exists`)
        }
        state.mcpServers.push(server)
        commit(state)
        sendJson(res, 200, { ok: true, value: { serverName: server.serverName } })
      },
    },
    // POST /dsh-base-plugin/api/mcp/remove { serverName }（旧版单条删除；不在受管列表则报错指引手改）
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mcp/remove',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const serverName = String(body.serverName ?? '').trim()
        const state = loadState()
        const before = state.mcpServers.length
        state.mcpServers = state.mcpServers.filter(s => s.serverName !== serverName)
        if (state.mcpServers.length === before) {
          throw new Error(`dsh-base-plugin: server "${serverName}" is not managed by dsh-base-plugin (hand-added row — edit cordis.patch.yml directly)`)
        }
        commit(state)
        sendJson(res, 200, { ok: true, value: { serverName } })
      },
    },
    // GET /dsh-base-plugin/api/mcp/health —— 每服务器调用量/失败率/平均
    // 延迟/最近使用（全部会话日志的 tool 流量按 mcp__<server>__ 前缀
    // 聚合，增量游标；打开 MCP 页时刷新）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/mcp/health',
      handler: async (_req, res) => {
        const value = await mcpHealth(ctx)
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}
