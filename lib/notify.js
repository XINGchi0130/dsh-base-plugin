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

/** Notification section defaults. */
export function emptyNotifySection() {
  return { enabled: false, channel: 'browser', url: '', barkKey: '', ntfyTopic: '', turnEnd: true, jobs: true, approvals: true, context: true, quietUntil: 0 }
}

/** Normalize one loaded notify section (defensive against hand edits). */
export function notifyFrom(raw) {
  const base = emptyNotifySection()
  if (raw === null || typeof raw !== 'object') return base
  const n = { ...base }
  n.enabled = raw.enabled === true
  if (raw.channel === 'bark' || raw.channel === 'ntfy' || raw.channel === 'webhook' || raw.channel === 'browser') n.channel = raw.channel
  n.url = typeof raw.url === 'string' ? raw.url : ''
  n.barkKey = typeof raw.barkKey === 'string' ? raw.barkKey : ''
  n.ntfyTopic = typeof raw.ntfyTopic === 'string' ? raw.ntfyTopic : ''
  n.turnEnd = raw.turnEnd !== false
  n.jobs = raw.jobs !== false
  n.approvals = raw.approvals !== false
  n.context = raw.context !== false
  n.quietUntil = typeof raw.quietUntil === 'number' ? raw.quietUntil : 0
  return n
}

/** Resolve the endpoint + payload for one channel. */
function buildRequest(n, title, body) {
  if (n.channel === 'bark') {
    const base = n.url !== '' ? n.url.replace(/\/+$/, '') : 'https://api.day.app'
    const key = n.barkKey.trim()
    const path = key !== '' ? `${encodeURIComponent(key)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`
      : `${encodeURIComponent(title)}/${encodeURIComponent(body)}`
    return { url: `${base}/${path}`, method: 'GET', headers: {}, body: null }
  }
  if (n.channel === 'ntfy') {
    // JSON publish API（标题进 body 而非 HTTP header）：undici 对非
    // latin1 header 值直接抛错——中文标题（我们的默认文案全是中文）曾令
    // 整条 ntfy 通知静默失败。JSON 接口同域名同鉴权，无此限制。
    const base = n.url !== '' ? n.url.replace(/\/+$/, '') : 'https://ntfy.sh'
    return {
      url: `${base}`,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: n.ntfyTopic.trim(), title: title.substring(0, 60), message: body, tags: ['dsh'] }),
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

/** Recent notify events (ring buffer) for the browser channel to poll.
 * Events carry a HOST-side monotonic seq — the client cursor must only ever
 * hold a host-returned value (mixing client Date.now() with host clocks
 * silently dropped or replayed events on clock-skewed phones). `overflow`
 * flags ring truncation so the client can surface "events were lost". */
const EVENT_LOG = []
const EVENT_LOG_MAX = 50
let eventSeq = 0
let eventOverflow = false

/** Record + deliver. Only the browser channel records (other channels POST
 * as before — recording them was pure exposure surface + buffer churn). */
export async function sendNotification(fetcher, n, title, body) {
  if (n.channel === 'browser') {
    eventSeq += 1
    EVENT_LOG.push({ seq: eventSeq, at: Date.now(), title, body })
    if (EVENT_LOG.length > EVENT_LOG_MAX) {
      EVENT_LOG.splice(0, EVENT_LOG.length - EVENT_LOG_MAX)
      eventOverflow = true
    }
    return true
  }
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
      // 消费（带上限）或取消 body：不读不取消会让连接滞留到 GC——通知
      // 高频时耗尽连接池；无上限读则会被恶意/异常回显的大 body 撑爆
      // 内存（原 arrayBuffer 是 size-blind 的）。64KB 足够任何通知渠道
      // 的应答；超出即放弃读取直接 cancel。
      try {
        const reader = response.body?.getReader()
        if (reader !== undefined) {
          let received = 0
          for (;;) {
            const { done, value } = await reader.read()
            if (done === true) break
            received += value.byteLength
            if (received > 65536) { void reader.cancel().catch(() => {}); break }
          }
        }
      } catch {
        // 流已 errored：按 WHATWG Streams，对 errored 流 cancel() 返回
        // rejected promise——必须挂 catch，否则一次通知回包读取失败
        // （网络中断即可）就以 unhandledRejection 崩掉宿主（Node ≥15
        // 默认策略 throw）。与 133 行 reader.cancel() 的安全写法对齐。
        response.body?.cancel().catch(() => {})
      }
      return response.ok
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return false
  }
}

/** Drain notify events past a cursor (host-side seq, NOT wall clock).
 * Response carries the new cursor + overflow flag; `at` stays for display. */
export function notifyEvents(sinceSeq) {
  const since = Number(sinceSeq) || 0
  const events = EVENT_LOG.filter(e => e.seq > since)
  const cursor = events.length > 0 ? events[events.length - 1].seq : since
  const overflow = eventOverflow
  eventOverflow = false // 读取即清除（客户端见一次后不重复报）
  return { events, cursor, overflow }
}

/** One in-flight send test result. */
export async function testNotification(fetcher, n) {
  const ok = await sendNotification(fetcher, n, 'DSH 通知桥测试', `Notification bridge works — ${new Date().toLocaleString()}`)
  return ok
}

/** Context-guard thresholds: notify at/above HIGH, re-arm below LOW. */
const CONTEXT_HIGH = 0.85
const CONTEXT_LOW = 0.7

/** Per-session arm state for the context guard: sessionId → last notified ratio. */
const contextArmed = new Map()

/** Drop one session's arm state (session deletion hook — same pattern as the
 * monitor/mcp-health/file-ops cursor drops wired in sessions.js). */
export function dropContextArm(sessionId) {
  contextArmed.delete(String(sessionId ?? ''))
}

/**
 * Check one session's context pressure after a model step and notify when the
 * window is running out. Hysteresis per session: notify once crossing HIGH,
 * re-notify only every +10 points above the last notice, re-arm below LOW.
 */
function checkContextPressure(projections, session, notify, readNotify, log) {
  try {
    if (projections === undefined || typeof projections.snapshot !== 'function') return
    const n = readNotify()
    if (n.enabled !== true || n.context !== true || Date.now() < n.quietUntil) return
    const p = projections.snapshot(session)?.values?.contextPressure
    if (p === null || typeof p !== 'object') return
    const projected = typeof p.projectedTokens === 'number' ? p.projectedTokens : undefined
    const window = typeof p.contextWindow === 'number' ? p.contextWindow : undefined
    if (projected === undefined || window === undefined || window <= 0) return
    const ratio = projected / window
    const last = contextArmed.get(session.id) ?? 0
    if (ratio >= CONTEXT_HIGH && (last === 0 || ratio >= last + 0.1)) {
      contextArmed.set(session.id, ratio)
      const pct = Math.round(ratio * 100)
      const title = typeof session.header?.title === 'string' && session.header.title !== ''
        ? session.header.title : String(session.id).slice(0, 8)
      notify(`dsh 上下文将满 (${pct}%)`, `会话「${title}」已用约 ${pct}% 的上下文窗口——考虑开新会话或手动压缩，避免自动压缩丢失早期细节。`)
    } else if (ratio < CONTEXT_LOW && last !== 0) {
      contextArmed.set(session.id, 0)
    }
  } catch (error) {
    log(`context guard check failed: ${String(error)}`)
  }
}

/**
 * Install the host listeners. Every listener is scoped to the plugin's
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

  // 安全读取助手：三个事件处理器开头的 readNotify() 同样可能同步抛
  // （state IO 故障），在监听器里抛出同样致命。统一走它，失败返回
  // "禁用"哨兵——事件被跳过，错误进日志。
  const readNotifySafe = () => {
    try {
      return readNotify()
    } catch (error) {
      log(`notify config read failed: ${String(error)}`)
      return { enabled: false }
    }
  }

  // notify 内部消化 readNotify 的同步抛错：state 文件 IO 故障（EACCES
  // 等）时 loadState 重抛，而三个事件调用点都是 void notify(...) 的
  // fire-and-forget——rejected promise 逃逸成 unhandledRejection 可崩
  // 宿主。通知路径绝不能带垮任何东西（模块头的设计目标）。
  const notify = async (title, body) => {
    const n = readNotifySafe()
    if (n.enabled !== true || Date.now() < n.quietUntil) return
    const ok = await sendNotification(fetcher, n, title, body)
    if (ok !== true) log(`notification delivery failed: ${title}`)
  }

  const disposers = []

  // 1. Background jobs settled.
  const jobs = ctx.get('jobs')
  if (jobs !== undefined && typeof jobs.onJobDone === 'function') {
    disposers.push(jobs.onJobDone((snapshot, owner) => {
      const n = readNotifySafe()
      if (n.enabled !== true || n.jobs !== true) return
      const name = snapshot.label !== '' ? snapshot.label : snapshot.id
      const ownerNote = owner !== undefined ? ` (${String(owner.id).slice(0, 8)})` : ''
      void notify(`dsh 任务${ownerNote}: ${name}`, `状态: ${snapshot.status}${snapshot.detail !== undefined ? ` — ${snapshot.detail}` : ''}`)
    }))
  }

  // 2. Agent turns finished — the "long task done" signal — plus the context
  //    guard check after every completed model step (usage-bearing
  //    assistant/message: the moments the pressure projection refreshes).
  const projections = ctx.get('sessionProjections')
  disposers.push(ctx.on('session/event', (session, event) => {
    if (event?.type === 'assistant/message') {
      checkContextPressure(projections, session, notify, readNotify, log)
      return
    }
    if (event?.type !== 'turn/end') return
    const n = readNotifySafe()
    if (n.enabled !== true || n.turnEnd !== true) return
    const title = typeof session?.header?.title === 'string' && session.header.title !== ''
      ? session.header.title
      : String(session?.id ?? 'session').slice(0, 8)
    void notify(`dsh 回合结束: ${title}`, '一轮对话已完成，可以查看结果了。')
  }))

  // 3. Approvals waiting for the user (waterfall: notify then pass through).
  disposers.push(ctx.on('approval/request', (req, next) => {
    // fire-and-forget：投递绝不阻塞审批链——慢渠道（10s 超时）曾会把
    // 审批对话框的弹出延迟同样久；通知迟到好过审批被卡。
    const n = readNotifySafe()
    if (n.enabled === true && n.approvals === true) {
      void notify('dsh 审批等待中', `工具「${String(req?.toolName ?? 'unknown')}」请求批准。`)
    }
    return next()
  }))

  return () => { for (const dispose of disposers) dispose() }
}
