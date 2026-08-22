/**
 * dsh-base-plugin — session monitor (the Monitor panel's data plane).
 *
 * Two sources, one payload:
 *
 *  1. The OFFICIAL `sessionStats` projection (@deepseek-ai/dsh-session-stats,
 *     registered through session-projections): turns/steps, LLM and tool
 *     wall times, first-token latency, decode throughput. A live session
 *     reads the projection registry snapshot directly; a cold one reads the
 *     projection cache. The fold stays the official unit's — this module
 *     never re-implements it.
 *  2. Token usage: an incremental per-session fold of `assistant/message`
 *     usage fields from the durable log (same field mapping as usage.js).
 *     A module-level seq cursor makes panel polling read only NEW events;
 *     the cursor is dropped when a session's log disappears (deletion).
 *
 * @module dsh-base-plugin/lib/monitor
 */

const ZERO_TOKENS = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }

/** Per-session fold cursors: sessionId → { lastSeq, tokens, requests }. */
const cursors = new Map()

/** Drop one session's fold cursor (call on deletion so a recreated id refolds). */
export function dropMonitorCursor(sessionId) {
  cursors.delete(String(sessionId ?? ''))
}

/** Whether the monitor's data sources exist on this host. */
export function monitorAvailable(ctx) {
  const projections = ctx.get('sessionProjections')
  const cache = ctx.get('sessionProjectionCache')
  const persistence = ctx.get('sessionPersistence')
  const hasStats = (projections !== undefined && typeof projections.snapshot === 'function')
    || (cache !== undefined && typeof cache.cachedSnapshot === 'function')
  return hasStats && persistence !== undefined && typeof persistence.readFrom === 'function'
}

/**
 * The monitor payload for one session: official whole-log stats plus a token
 * fold with a seq cursor (polling reads only new events).
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} rawId - session id.
 * @returns the `{ live, available, stats, tokens, requests }` payload.
 */
export async function sessionMonitor(ctx, rawId) {
  const id = String(rawId ?? '')
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  // ── official sessionStats projection ──────────────────────────────────
  let live = false
  let stats = null
  const sessions = ctx.get('sessions')
  const liveSession = sessions !== undefined && typeof sessions.get === 'function'
    ? sessions.get(id) : undefined
  try {
    if (liveSession !== undefined) {
      live = true
      const projections = ctx.get('sessionProjections')
      if (projections !== undefined && typeof projections.snapshot === 'function') {
        stats = projections.snapshot(liveSession)?.values?.sessionStats ?? null
      }
    } else {
      const cache = ctx.get('sessionProjectionCache')
      if (cache !== undefined && typeof cache.cachedSnapshot === 'function'
        && typeof persistence.list === 'function') {
        const header = (await persistence.list()).find(h => String(h.id) === id)
        if (header !== undefined) {
          stats = cache.cachedSnapshot(header)?.values?.sessionStats ?? null
        }
      }
    }
  } catch (error) {
    ctx.logger.warn(`dsh-base-plugin: sessionStats projection for "${id}" failed: ${String(error)}`)
  }

  // ── token fold with an incremental cursor ─────────────────────────────
  let entry = cursors.get(id)
  if (entry === undefined) {
    entry = { lastSeq: 0, tokens: { ...ZERO_TOKENS }, requests: 0 }
  }
  try {
    const page = await persistence.readFrom(id, entry.lastSeq === 0 ? 0 : entry.lastSeq + 1)
    const events = page?.events ?? []
    for (const event of events) {
      if (event.type === 'assistant/message') {
        const usage = event.data?.usage
        if (usage !== null && typeof usage === 'object') {
          entry.tokens.input += usage.inputTokens ?? 0
          entry.tokens.cacheRead += usage.cacheReadTokens ?? 0
          entry.tokens.cacheWrite += usage.cacheWriteTokens ?? 0
          entry.tokens.output += usage.outputTokens ?? 0
          entry.tokens.reasoning += usage.reasoningTokens ?? 0
          entry.requests += 1
        }
      }
      entry.lastSeq = event.seq
    }
    cursors.set(id, entry)
  } catch (error) {
    // Unreadable/gone log: keep the accumulated fold, drop the cursor so a
    // recreated session id refolds from zero instead of skipping events.
    cursors.delete(id)
    ctx.logger.warn(`dsh-base-plugin: monitor token fold for "${id}" failed: ${String(error)}`)
  }

  return {
    sessionId: id,
    live,
    available: stats !== null,
    stats,
    tokens: entry.tokens,
    requests: entry.requests,
  }
}
