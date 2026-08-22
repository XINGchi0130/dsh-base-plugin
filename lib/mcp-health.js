/**
 * dsh-base-plugin — MCP server health (the MCP settings page's health column).
 *
 * Per-server aggregates folded from every session log's tool traffic:
 *  - `tool/call` events whose name starts `mcp__<server>__` count calls;
 *  - the paired `tool/result` (matched by callId) contributes latency
 *    (result.time − call.time, ms) and the error flag (event error OR
 *    isError block — same predicate the export fold uses);
 *  - the last-seen timestamp names how recently the server was actually used.
 *
 * Aggregation is INCREMENTAL per session: a module-level seq cursor per
 * session (same pattern as lib/monitor.js) means refresh reads only new
 * events; an unpaired call at the log tail is simply not counted yet (it
 * settles on the next refresh). Server identity comes from the tool-name
 * prefix — a server renamed/re-added under a new name starts a fresh row,
 * which is the honest reading of the data.
 *
 * @module dsh-base-plugin/lib/mcp-health
 */

/** Per-session fold state: sessionId → { lastSeq, pending: Map<callId, {server,tool,at}> }.
 * `pending` persists across refreshes so a call whose result lands in the
 * NEXT incremental read still pairs correctly (the crossing pair is the
 * whole reason plain lastSeq cursors are not enough here). */
const cursors = new Map()

/** One server aggregate row (mutated in place during the fold). */
function newRow() {
  return { calls: 0, errors: 0, latencyMs: 0, latencyCount: 0, lastUsedAt: 0 }
}

/** MCP tool name → [server, tool] or null for non-MCP tools. */
function splitMcpName(name) {
  if (typeof name !== 'string' || !name.startsWith('mcp__')) return null
  const rest = name.slice('mcp__'.length)
  const at = rest.indexOf('__')
  if (at <= 0) return null
  return [rest.slice(0, at), rest.slice(at + 2)]
}

/** Whether a tool/result event represents a failed call. */
function isFailedResult(data) {
  if (data.error !== undefined) return true
  const block = Array.isArray(data.message?.content) ? data.message.content[0] : data.message?.content
  return block?.isError === true
}

/** Cross-call aggregate cache: server → sessionId → { row, tools: Map }.
 * Two levels so a session DELETION peels off just that session's
 * contribution (a single global Map could not un-fold a deleted log — the
 * old design reset EVERYTHING on any deletion, forcing a full refold of all
 * logs on the next call). The per-session cursors make each call read only
 * NEW events, so the aggregates must persist across calls too. */
const aggregate = new Map()

/** Epoch fence: a deletion-bounced reset while a fold is in flight would let
 * the stale fold write into the fresh aggregate and double-count on the next
 * full refold — in-flight folds check the epoch before every aggregate write. */
let epoch = 0

/** Delete one session's fold state and aggregate contribution (no global
 * reset, no refold of other sessions). */
export function dropMcpHealthCursor(sessionId) {
  const id = String(sessionId ?? '')
  cursors.delete(id)
  for (const perSession of aggregate.values()) perSession.delete(id)
  epoch += 1 // 让在飞折叠的写入栅栏失效（见 epoch 注释）
}

/**
 * Aggregate per-server MCP health across every persisted session.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns the `{ servers }` payload — servers sorted by calls desc, each
 *   `{ server, calls, errors, errorRate, avgLatencyMs, lastUsedAt, tools }`
 *   where `tools` lists per-tool call counts (top 10, desc).
 */
let healthInflight = null

/** Single-flight: concurrent polls share one fold (shared-aggregate mutation
 * made concurrent folds double-count). */
export function mcpHealth(ctx) {
  if (healthInflight !== null) return healthInflight
  healthInflight = mcpHealthImpl(ctx).finally(() => { healthInflight = null })
  return healthInflight
}

async function mcpHealthImpl(ctx) {
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.list !== 'function' || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  const myEpoch = epoch
  const touch = (server, sessionId) => {
    if (myEpoch !== epoch) return null // deletion raced this fold
    let perSession = aggregate.get(server)
    if (perSession === undefined) {
      perSession = new Map()
      aggregate.set(server, perSession)
    }
    let entry = perSession.get(sessionId)
    if (entry === undefined) {
      entry = { row: newRow(), tools: new Map() }
      perSession.set(sessionId, entry)
    }
    return entry
  }
  // epoch 栅栏：折叠期间发生删除（epoch 变化）→ 丢弃本次部分折叠。
  const fenceOk = () => myEpoch === epoch

  const headers = await persistence.list()
  for (const header of headers) {
    const id = String(header?.id ?? '')
    if (id === '') continue
    let state = cursors.get(id)
    if (state === undefined) {
      state = { lastSeq: 0, pending: new Map() }
      cursors.set(id, state)
    }
    let seq = state.lastSeq
    const pending = state.pending
    for (;;) {
      let page
      try {
        page = await persistence.readFrom(id, seq)
      } catch {
        break // unreadable log: keep the accumulated fold for this session
      }
      const events = page?.events ?? []
      if (events.length === 0) break
      if (!fenceOk()) return { servers: [] } // deletion raced this fold — next call refolds cleanly
      for (const event of events) {
        seq = (event.seq ?? seq) + 1
        const data = event.data ?? {}
        if (event.type === 'tool/call') {
          const parts = splitMcpName(data.name)
          if (parts === null) continue
          pending.set(String(data.callId), { server: parts[0], tool: parts[1], at: event.time })
        } else if (event.type === 'tool/result') {
          const callId = String(Array.isArray(data.message?.content)
            ? data.message.content[0]?.toolCallId
            : data.message?.content?.toolCallId)
          const call = pending.get(callId)
          if (call === undefined) continue // non-MCP or pre-cursor call
          pending.delete(callId)
          const entry = touch(call.server, id)
          if (entry === null) continue // epoch fence: skip writes into a reset aggregate
          const row = entry.row
          row.calls += 1
          if (call.at > row.lastUsedAt) row.lastUsedAt = call.at
          if (isFailedResult(data)) row.errors += 1
          const latency = typeof event.time === 'number' && typeof call.at === 'number' ? event.time - call.at : null
          if (latency !== null && latency >= 0) {
            row.latencyMs += latency
            row.latencyCount += 1
          }
          entry.tools.set(call.tool, (entry.tools.get(call.tool) ?? 0) + 1)
        }
      }
      state.lastSeq = seq
    }
  }

  // Merge the two-level aggregate into payload rows (sum across sessions).
  const merged = new Map()
  for (const [server, perSession] of aggregate) {
    const acc = { row: newRow(), tools: new Map() }
    for (const entry of perSession.values()) {
      acc.row.calls += entry.row.calls
      acc.row.errors += entry.row.errors
      acc.row.latencyMs += entry.row.latencyMs
      acc.row.latencyCount += entry.row.latencyCount
      if (entry.row.lastUsedAt > acc.row.lastUsedAt) acc.row.lastUsedAt = entry.row.lastUsedAt
      for (const [tool, calls] of entry.tools) acc.tools.set(tool, (acc.tools.get(tool) ?? 0) + calls)
    }
    // 会话删除剥离子条目后可能留下 calls=0 的空壳行——不再产出。
    if (acc.row.calls === 0) aggregate.delete(server)
    else merged.set(server, acc)
  }
  const servers = [...merged.entries()]
    .map(([server, entry]) => ({
      server,
      calls: entry.row.calls,
      errors: entry.row.errors,
      errorRate: entry.row.calls > 0 ? Math.round(entry.row.errors / entry.row.calls * 100) : 0,
      avgLatencyMs: entry.row.latencyCount > 0 ? Math.round(entry.row.latencyMs / entry.row.latencyCount) : null,
      lastUsedAt: entry.row.lastUsedAt,
      tools: [...entry.tools.entries()]
        .map(([tool, calls]) => ({ tool, calls }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10),
    }))
    .sort((a, b) => b.calls - a.calls)

  return { servers }
}


