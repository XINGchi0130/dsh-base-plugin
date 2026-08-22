/**
 * dsh-base-plugin — session monitor (the Monitor panel's data plane).
 *
 * Three sources, one payload (a single poll fetches everything):
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
 *     cursors are shared with the subagent mini-folds (a subagent child IS
 *     a session) and dropped when a session's log disappears (deletion).
 *  3. Jobs + subagent tree (v2): the official `jobs` registry
 *     (`list(agent)` — the same source the api-proxy's session/jobs frames
 *     use) and the official `subagents` registry (`listDescendants(rootId)`
 *     — durable tree with parentId/depth/mode/activity). Each child also
 *     gets a mini fold (turns/steps via the projection cache, output tokens
 *     via the same incremental cursor) so the tree rows carry status AND
 *     figures. Both sections are OPTIONAL: a missing service hides the
 *     card, never the panel.
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

/** Whether the monitor's core data sources exist on this host. */
export function monitorAvailable(ctx) {
  const projections = ctx.get('sessionProjections')
  const cache = ctx.get('sessionProjectionCache')
  const persistence = ctx.get('sessionPersistence')
  const hasStats = (projections !== undefined && typeof projections.snapshot === 'function')
    || (cache !== undefined && typeof cache.cachedSnapshot === 'function')
  return hasStats && persistence !== undefined && typeof persistence.readFrom === 'function'
}

/**
 * Incremental token fold for one session id (shared by the main fold and the
 * per-subagent mini folds). Reads only events past the cursor; on failure the
 * cursor is dropped (a recreated id refolds from zero) while the accumulated
 * values are kept.
 * @returns the cursor entry ({ tokens, requests }) after this fold.
 */
async function foldTokens(ctx, id) {
  const persistence = ctx.get('sessionPersistence')
  let entry = cursors.get(id)
  if (entry === undefined) {
    entry = { lastSeq: 0, tokens: { ...ZERO_TOKENS }, requests: 0 }
  }
  try {
    const page = await persistence.readFrom(id, entry.lastSeq === 0 ? 0 : entry.lastSeq + 1)
    for (const event of page?.events ?? []) {
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
    cursors.delete(id)
    ctx.logger.warn(`dsh-base-plugin: monitor token fold for "${id}" failed: ${String(error)}`)
  }
  return entry
}

/** The sessionStats projection for a cold session, via the projection cache. */
function cachedStats(ctx, header) {
  try {
    const cache = ctx.get('sessionProjectionCache')
    if (cache === undefined || typeof cache.cachedSnapshot !== 'function') return null
    return cache.cachedSnapshot(header)?.values?.sessionStats ?? null
  } catch {
    return null
  }
}

/** Scalar job row (mirrors the api-proxy jobViews projection). */
function jobRow(job) {
  return {
    id: String(job?.id ?? ''),
    kind: String(job?.kind ?? ''),
    label: String(job?.label ?? ''),
    status: String(job?.status ?? ''),
    ...(typeof job?.detail === 'string' && job.detail !== '' ? { detail: job.detail } : {}),
    startedAt: typeof job?.startedAt === 'number' ? job.startedAt : 0,
    ...(typeof job?.finishedAt === 'number' ? { finishedAt: job.finishedAt } : {}),
  }
}

/**
 * The monitor payload for one session: official whole-log stats, an
 * incremental token fold, live background jobs, and the durable subagent
 * tree with per-child mini figures.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} rawId - session id.
 * @returns the `{ live, available, stats, tokens, requests, jobs, subagents }` payload.
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
    } else if (typeof persistence.list === 'function') {
      const header = (await persistence.list()).find(h => String(h.id) === id)
      if (header !== undefined) stats = cachedStats(ctx, header)
    }
  } catch (error) {
    ctx.logger.warn(`dsh-base-plugin: sessionStats projection for "${id}" failed: ${String(error)}`)
  }

  // ── token fold with an incremental cursor ─────────────────────────────
  const entry = await foldTokens(ctx, id)

  // ── background jobs (live sessions only: the registry is process-local
  //    and the official frames use the same agent-scoped listing) ────────
  let jobs = []
  if (live) {
    const agents = ctx.get('agents')
    const jobsSvc = ctx.get('jobs')
    const agent = agents !== undefined && typeof agents.get === 'function' ? agents.get(id) : undefined
    if (agent !== undefined && jobsSvc !== undefined && typeof jobsSvc.list === 'function') {
      try {
        jobs = jobsSvc.list(agent).map(jobRow)
      } catch (error) {
        ctx.logger.warn(`dsh-base-plugin: monitor jobs for "${id}" failed: ${String(error)}`)
      }
    }
  }

  // ── subagent tree with per-child mini figures ─────────────────────────
  // null = service absent (the client hides the card); [] = no children.
  let subagents = null
  const sub = ctx.get('subagents')
  if (sub !== undefined && typeof sub.listDescendants === 'function') {
    try {
      const entries = await sub.listDescendants(id)
      // One header list for ALL children (the loop below would otherwise
      // re-read the whole inventory once per child).
      let headers = null
      const headerOf = async (childId) => {
        if (headers === null) {
          headers = new Map()
          if (typeof persistence.list === 'function') {
            for (const h of await persistence.list()) headers.set(String(h.id), h)
          }
        }
        return headers.get(childId)
      }
      subagents = []
      for (const e of entries) {
        if (e.kind === 'diagnostic') {
          subagents.push({ kind: 'diagnostic', id: String(e.id), depth: e.depth ?? 1, reason: String(e.reason ?? 'corrupt') })
          continue
        }
        // Mini figures: turns/steps from the child's cached projection,
        // output tokens from the shared incremental fold.
        let turns = null
        let steps = null
        try {
          const header = await headerOf(String(e.id))
          if (header !== undefined) {
            const childStats = cachedStats(ctx, header)
            if (childStats !== null) {
              turns = typeof childStats.turns === 'number' ? childStats.turns : null
              steps = typeof childStats.steps === 'number' ? childStats.steps : null
            }
          }
        } catch { /* mini figures are best-effort */ }
        const mini = await foldTokens(ctx, String(e.id))
        subagents.push({
          kind: 'child',
          id: String(e.id),
          parentId: String(e.parentId ?? id),
          depth: typeof e.depth === 'number' ? e.depth : 1,
          mode: e.mode === 'continuable' ? 'continuable' : 'one-shot',
          label: String(e.label ?? ''),
          activity: e.activity === 'running' ? 'running' : 'inactive',
          hasChildren: e.hasChildren === true,
          turns,
          steps,
          output: mini.tokens.output,
        })
      }
    } catch (error) {
      // The listing itself failed (projection registry/session store absent
      // per the service contract) — hide the card rather than erroring.
      subagents = null
      ctx.logger.warn(`dsh-base-plugin: monitor subagents for "${id}" failed: ${String(error)}`)
    }
  }

  return {
    sessionId: id,
    live,
    available: stats !== null,
    stats,
    tokens: entry.tokens,
    requests: entry.requests,
    jobs,
    subagents,
  }
}
