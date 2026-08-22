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

/** Cross-call aggregate cache: server → { row, tools: Map<tool, calls> }.
 * The per-session cursors make each call read only NEW events, so the
 * aggregates themselves must persist across calls too — otherwise every
 * refresh would silently drop history (the fold would skip the events and
 * never re-see them). Reset via resetMcpHealth(). */
const aggregate = new Map()

/** Reset every cursor and aggregate (force rescan entry point). */
export function resetMcpHealth() {
  cursors.clear()
  aggregate.clear()
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

  const touch = (server) => {
    let entry = aggregate.get(server)
    if (entry === undefined) {
      entry = { row: newRow(), tools: new Map() }
      aggregate.set(server, entry)
    }
    return entry
  }

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
          const entry = touch(call.server)
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

  const servers = [...aggregate.entries()]
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

/** Session deletion hook: the aggregate cannot un-fold a deleted log, so a
 * deletion resets everything for a clean re-fold on the next call (reads are
 * incremental again from live logs only). */
export function dropMcpHealthCursor(_sessionId) {
  resetMcpHealth()
}
