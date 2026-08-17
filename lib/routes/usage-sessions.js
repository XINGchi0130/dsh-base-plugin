/**
 * 模型用量统计路由（扫描 + 价格表）与会话清单/删除路由。两域除
 * http 基础设施外互不共享。
 * @module dsh-base-plugin/lib/routes/usage-sessions
 */
import { savePrices, scanUsage } from '../usage.js'
import { deleteSession, listSessions } from '../sessions.js'
import { readJsonBody, sendJson } from './http.js'

export function usageRoutes(ctx, deps) {
  return [
    // GET /dsh-base-plugin/api/usage/debug —— 服务可见性诊断（排查用量
    // 页数据缺口时用：三个数据源各列多少条/是否报错）
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/usage/debug',
      handler: async (_req, res) => {
        const persistence = ctx.get('sessionPersistence')
        const sessionQuery = ctx.get('sessionQuery')
        const sessionsSvc = ctx.get('sessions')
        let persistedList = -1
        let queryList = -1
        let liveList = -1
        try { persistedList = persistence !== undefined ? (await persistence.list()).length : -1 } catch (e) { persistedList = 'err: ' + String(e.message).slice(0, 80) }
        try { queryList = sessionQuery !== undefined ? (await sessionQuery.listSessions()).length : -1 } catch (e) { queryList = 'err: ' + String(e.message).slice(0, 80) }
        try { liveList = sessionsSvc !== undefined ? sessionsSvc.list().length : -1 } catch (e) { liveList = 'err: ' + String(e.message).slice(0, 80) }
        sendJson(res, 200, {
          ok: true,
          value: {
            persistenceVisible: persistence !== undefined,
            sessionQueryVisible: sessionQuery !== undefined,
            sessionsVisible: sessionsSvc !== undefined,
            persistedList, queryList, liveList,
          },
        })
      },
    },
    // GET /dsh-base-plugin/api/usage?force=1&start=YYYY-MM-DD&end=YYYY-MM-DD
    // —— 聚合模型用量。增量扫描（每会话记录 last-seq 游标）；force=1
    // 从 seq 0 全量重扫；start/end 收窄 token 表与趋势序列的范围。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/usage',
      handler: async (_req, res, url) => {
        // 全量扫描与会话日志的增量游标缓存互斥：force=1 重扫期间并发
        // 请求会读到半新半旧的聚合，占锁直至扫描完成。
        if (!deps.acquireBusy('usage scan')) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const dayParam = name => {
            const raw = url.searchParams.get(name) ?? ''
            return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
          }
          const gran = url.searchParams.get('gran') ?? 'auto'
          const value = await scanUsage(ctx, {
            forceRescan: url.searchParams.get('force') === '1',
            startDay: dayParam('start'),
            endDay: dayParam('end'),
            granularity: ['auto', 'daily', 'hourly'].includes(gran) ? gran : 'auto',
          })
          sendJson(res, 200, { ok: true, value })
        } finally {
          deps.releaseBusy()
        }
      },
    },
    // POST /dsh-base-plugin/api/usage/prices { prices } —— 保存价格表
    // （USD/1M-token；保存后历史立即按新价重估）
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/usage/prices',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = savePrices(body.prices)
        sendJson(res, 200, { ok: true, value: { prices: value } })
      },
    },
  ]
}

export function sessionsRoutes(ctx) {
  return [
    // GET /dsh-base-plugin/api/sessions —— 完整会话清单（持久化 + 活跃 +
    // 归档集幽灵行），供设置页「会话管理」使用。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/sessions',
      handler: async (_req, res) => {
        const value = await listSessions(ctx)
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/sessions/delete { sessionId } —— 破坏性
    // 删除（含归档）；拒绝活跃会话（先关闭再删）。删除顺序见
    // sessions.js 的崩溃幂等设计说明。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/sessions/delete',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const value = await deleteSession(ctx, body?.sessionId)
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}
