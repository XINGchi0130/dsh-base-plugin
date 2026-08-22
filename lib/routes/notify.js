/**
 * 通知桥路由（设置页「通知」节的数据面）：读取/保存配置、发送测试、
 * 静音窗口。notify 段经字段合并持久化（与 mobile 段同模式），任何
 * 其他写盘都不会丢失它。
 * @module dsh-base-plugin/lib/routes/notify
 */
import { emptyNotifySection, notifyEvents, notifyFrom, testNotification } from '../notify.js'
import { loadState, saveState } from '../state.js'
import { readJsonBody, sendJson } from './http.js'

/** Merge the live notify section into a fresh state read and persist. */
function persistNotify(section) {
  const state = loadState()
  state.notify = section
  saveState(state)
}

export function notifyRoutes() {
  return [
    // GET /dsh-base-plugin/api/notify —— 当前配置（缺省段补齐默认值）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/notify',
      handler: async (_req, res) => {
        const state = loadState()
        sendJson(res, 200, { ok: true, value: notifyFrom(state.notify ?? emptyNotifySection()) })
      },
    },
    // POST /dsh-base-plugin/api/notify { enabled, channel, url, barkKey,
    // ntfyTopic, turnEnd, jobs, approvals } —— 保存配置。字段级校验，
    // bark/ntfy 必填项缺失时拒绝启用。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/notify',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const current = notifyFrom(loadState().notify ?? emptyNotifySection())
        const next = notifyFrom({ ...current, ...body })
        if (next.url.trim() !== '') {
          try {
            const scheme = new URL(next.url.trim()).protocol
            if (scheme !== 'http:' && scheme !== 'https:') throw new Error('bad scheme')
          } catch {
            throw new Error('dsh-base-plugin: 服务器 URL 必须是合法的 http(s) 地址')
          }
        }
        if (next.enabled === true && next.channel !== 'browser') {
          if (next.channel === 'bark' && next.barkKey.trim() === '' && next.url.trim() === '') {
            throw new Error('dsh-base-plugin: Bark 渠道需要设备 key（或自建服务 URL）')
          }
          if (next.channel === 'ntfy' && next.ntfyTopic.trim() === '') {
            throw new Error('dsh-base-plugin: ntfy 渠道需要 topic')
          }
          if (next.channel === 'webhook' && next.url.trim() === '') {
            throw new Error('dsh-base-plugin: webhook 渠道需要 URL')
          }
        }
        persistNotify(next)
        sendJson(res, 200, { ok: true, value: next })
      },
    },
    // GET /dsh-base-plugin/api/notify/events?since=ms —— 浏览器渠道轮询
    // 事件（ring buffer 环形缓冲；客户端拉取后触发 Notification API）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/notify/events',
      handler: async (_req, res, url) => {
        const value = notifyEvents(url.searchParams.get('since') ?? '0')
        sendJson(res, 200, { ok: true, value: { events: value } })
      },
    },
    // POST /dsh-base-plugin/api/notify/test —— 用当前保存的配置发一条测试。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/notify/test',
      handler: async (_req, res) => {
        const n = notifyFrom(loadState().notify ?? emptyNotifySection())
        const fetcher = globalThis.fetch
        if (typeof fetcher !== 'function') throw new Error('dsh-base-plugin: this host has no fetch')
        const ok = await testNotification(fetcher, n)
        if (ok !== true) throw new Error('dsh-base-plugin: 测试通知发送失败——检查渠道配置与网络')
        sendJson(res, 200, { ok: true, value: { sent: true } })
      },
    },
    // POST /dsh-base-plugin/api/notify/quiet { minutes } —— 静音 N 分钟
    // （0 = 取消静音）。事件监听器逐事件现读配置，改完即生效。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/notify/quiet',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const minutes = Number(body?.minutes)
        if (Number.isFinite(minutes) && minutes > 24 * 60) {
          throw new Error('dsh-base-plugin: 单次静音最长 24 小时——永久静音请直接关闭通知开关')
        }
        const n = notifyFrom(loadState().notify ?? emptyNotifySection())
        n.quietUntil = Number.isFinite(minutes) && minutes > 0 ? Date.now() + minutes * 60_000 : 0
        persistNotify(n)
        sendJson(res, 200, { ok: true, value: { quietUntil: n.quietUntil } })
      },
    },
  ]
}
