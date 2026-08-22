/**
 * dsh-base-plugin — notification bridge: push dsh events to a phone.
 *
 * Channels: Bark (iOS), ntfy (cross-platform), and a generic webhook
 * (arbitrary URL + JSON body template — covers Feishu/DingTalk/WeCom custom
 * bots). Delivery is one POST per event, best-effort: a failing channel
 * logs once and never blocks the event flow (the notify path must not be
 * able to take anything down with it).
 *
 * Event sources (host-side listeners, all official):
 *  - `jobs.onJobDone`      → a background job settled (completed/failed/killed)
 *  - `session/event`       → filtered to `turn/end`: an agent turn finished
 *                            (the "long task done" signal)
 *  - `approval/request`    → waterfall: an approval is waiting for the user
 *                            (bridge notifies, then calls next() — the
 *                            outcome itself is not re-notified)
 *
 * State lives under the shared state file (`notify` section), persisted via
 * the caller-provided save hook so install/uninstall cannot clobber it
 * (field-merge pattern, same as the mobile section).
 *
 * @module dsh-base-plugin/lib/notify
 */
import { randomUUID } from 'node:crypto'

/** Notification section defaults. */
export function emptyNotifySection() {
  return { enabled: false, channel: 'webhook', url: '', barkKey: '', ntfyTopic: '', turnEnd: true, jobs: true, approvals: true, quietUntil: 0 }
}

/** Normalize one loaded notify section (defensive against hand edits). */
export function notifyFrom(raw) {
  const base = emptyNotifySection()
  if (raw === null || typeof raw !== 'object') return base
  const n = { ...base }
  n.enabled = raw.enabled === true
  if (raw.channel === 'bark' || raw.channel === 'ntfy' || raw.channel === 'webhook') n.channel = raw.channel
  n.url = typeof raw.url === 'string' ? raw.url : ''
  n.barkKey = typeof raw.barkKey === 'string' ? raw.barkKey : ''
  n.ntfyTopic = typeof raw.ntfyTopic === 'string' ? raw.ntfyTopic : ''
  n.turnEnd = raw.turnEnd !== false
  n.jobs = raw.jobs !== false
  n.approvals = raw.approvals !== false
  n.quietUntil = typeof raw.quietUntil === 'number' ? raw.quietUntil : 0
  return n
}

/** Resolve the endpoint + payload for one channel. */
function buildRequest(n, title, body) {
  if (n.channel === 'bark') {
    const base = n.url !== '' ? n.url.replace(/\/+$/, '') : 'https://api.day.app'
    const key = n.barkKey.trim()
    const path = key !== '' ? `${key}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`
      : `${encodeURIComponent(title)}/${encodeURIComponent(body)}`
    return { url: `${base}/${path}`, method: 'GET', headers: {}, body: null }
  }
  if (n.channel === 'ntfy') {
    const base = n.url !== '' ? n.url.replace(/\/+$/, '') : 'https://ntfy.sh'
    return {
      url: `${base}/${encodeURIComponent(n.ntfyTopic.trim())}`,
      method: 'POST',
      headers: { title: title.substring(0, 60), priority: 'default', tags: 'dsh' },
      body: body,
    }
  }
  // Generic webhook: if the URL carries no template markers, POST a plain
  // JSON document most chat-bots understand; otherwise substitute {title}
  // and {body} into the URL itself (query-param style bots).
  if (n.url.includes('{title}') || n.url.includes('{body}')) {
    return {
      url: n.url.replaceAll('{title}', encodeURIComponent(title)).replaceAll('{body}', encodeURIComponent(body)),
      method: 'GET',
      headers: {},
      body: null,
    }
  }
  return {
    url: n.url,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, body, ts: Date.now() }),
  }
}

/** Best-effort delivery; resolves true on 2xx. Never throws. */
export async function sendNotification(fetcher, n, title, body) {
  try {
    const request = buildRequest(n, title, body)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetcher(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === null ? {} : { body: request.body }),
        signal: controller.signal,
      })
      return response.ok
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

/** One in-flight send test result. */
export async function testNotification(fetcher, n) {
  const ok = await sendNotification(fetcher, n, 'DSH 通知桥测试', `Notification bridge works — ${new Date().toLocaleString()}`)
  return ok
}

/**
 * Install the three host listeners. Every listener is scoped to the plugin's
 * fiber (ctx.on), so unloading the plugin removes them all.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {() => object} readNotify - read the CURRENT notify section (fresh per event).
 * @param {(msg: string) => void} log - warning sink.
 * @returns a disposer removing all listeners.
 */
export function installNotifyBridge(ctx, readNotify, log) {
  const fetcher = globalThis.fetch
  if (typeof fetcher !== 'function') {
    log('notification bridge: fetch is unavailable on this host — bridge disabled')
    return () => {}
  }

  const notify = async (title, body) => {
    const n = readNotify()
    if (n.enabled !== true || Date.now() < n.quietUntil) return
    const ok = await sendNotification(fetcher, n, title, body)
    if (ok !== true) log(`notification delivery failed: ${title}`)
  }

  const disposers = []

  // 1. Background jobs settled.
  const jobs = ctx.get('jobs')
  if (jobs !== undefined && typeof jobs.onJobDone === 'function') {
    disposers.push(jobs.onJobDone((snapshot, owner) => {
      const n = readNotify()
      if (n.enabled !== true || n.jobs !== true) return
      const name = snapshot.label !== '' ? snapshot.label : snapshot.id
      const ownerNote = owner !== undefined ? ` (${String(owner.id).slice(0, 8)})` : ''
      void notify(`dsh 任务${ownerNote}: ${name}`, `状态: ${snapshot.status}${snapshot.detail !== undefined ? ` — ${snapshot.detail}` : ''}`)
    }))
  }

  // 2. Agent turns finished — the "long task done" signal.
  disposers.push(ctx.on('session/event', (session, event) => {
    if (event?.type !== 'turn/end') return
    const n = readNotify()
    if (n.enabled !== true || n.turnEnd !== true) return
    const title = typeof session?.header?.title === 'string' && session.header.title !== ''
      ? session.header.title
      : String(session?.id ?? 'session').slice(0, 8)
    void notify(`dsh 回合结束: ${title}`, '一轮对话已完成，可以查看结果了。')
  }))

  // 3. Approvals waiting for the user (waterfall: notify then pass through).
  disposers.push(ctx.on('approval/request', async (req, next) => {
    const n = readNotify()
    if (n.enabled === true && n.approvals === true) {
      await notify('dsh 审批等待中', `工具「${String(req?.toolName ?? 'unknown')}」请求批准。`)
    }
    return next()
  }))

  return () => { for (const dispose of disposers) dispose() }
}
