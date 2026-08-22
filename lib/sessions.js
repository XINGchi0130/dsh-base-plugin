/**
 * dsh-base-plugin — session inventory and destructive deletion (the Sessions
 * settings page's data plane).
 *
 * One "session" physically spans up to five stores; deletion sweeps them in a
 * crash-idempotent order and every step is safe to redo:
 *
 *  0. live announcement — for sessions with a log, `agents.resume()` +
 *     `handle.dispose()` walks the official teardown path first, so
 *     `session/disposed` reaches every connected client as
 *     `host/session-removed` and the sidebar row disappears WITHOUT a page
 *     refresh (a cold session has no live instance; deleting its stores
 *     alone leaves the row in each client's in-memory list until reload).
 *     The dispose drain also retires any in-flight writer before the log
 *     removal below. Falls back to best-effort removal when the agents
 *     service is absent or resume fails.
 *  1. workspace accounting — `workspaceRegistry.list()` → entity
 *     `detachSession(id)` per workspace (public entity API; idempotent, and
 *     the entity's mutate() no-ops without a durable write when the record
 *     does not contain the id). Done FIRST so the UI accounting clears even
 *     if a later step throws.
 *  2. projection cache — `storageDomain.get('session_projcache')`
 *     table('sessions').delete(id) through the live domain runtime (opening
 *     the domain ourselves would throw already-open; `get()` hands back the
 *     same authoritative in-memory state the shipped service writes through).
 *  3. the durable log — the ONLY destructive step. Located through
 *     `sessionPersistence.locate(header)`; v1 supports the jsonl backend
 *     only (sqlite's locate() returns undefined and its live DB is not ours
 *     to mutate). The session directory (log + in-dir checkpoint snapshots)
 *     is removed with a bounded write-after-delete retry loop: a session
 *     disposed moments ago may still have a retirement drain in flight whose
 *     appendBatch lazily re-materializes the artifact; once the drain ends no
 *     writer remains, so the loop always converges.
 *  4. the registry-global archive set — best-effort scrub through the
 *     workspace domain's global. The registry caches domain state in memory
 *     and its own next setState() re-writes the pre-scrub set; a surviving
 *     stale id only fails to hide an already-deleted row, so this stays
 *     cosmetic (and self-heals across a restart).
 *
 * Ghost entries (archived ids whose log is already gone) are listed with
 * `hasLog: false` and deleting them performs exactly the metadata sweep —
 * this page is also the supported way to clean such residue without a
 * host restart.
 *
 * Live sessions are refused up front (`sessions.get(id)`), which also covers
 * the currently-open conversation: close it first, then delete.
 *
 * @module dsh-base-plugin/lib/sessions
 */
import { rm, rmdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { dropMonitorCursor } from './monitor.js'
import { dropMcpHealthCursor } from './mcp-health.js'
import { dropFileOpsFold } from './file-ops.js'
import { dropContextArm } from './notify.js'

/** Path-encode one session id exactly like dsh's encodeSegment (format.ts):
 * [A-Za-z0-9._-] passes through (except `~` itself), every other UTF-16 code
 * unit becomes `~XXXX` uppercase hex. Used only to VERIFY that the directory
 * we are about to recursively delete really is this session's. */
export function encodeSegment(raw) {
  if (raw.length === 0) throw new Error('cannot encode an empty session id')
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += '~' + raw.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

/** The projection-cache titles, best-effort: a map session id → title. */
function readTitles(ctx) {
  const titles = new Map()
  try {
    const domain = ctx.get('storageDomain')
    const table = typeof domain?.get === 'function' ? domain.get('session_projcache')?.table?.('sessions') : undefined
    if (table !== undefined && typeof table.entries === 'function') {
      for (const [key, record] of table.entries()) {
        const val = record?.rows?.title?.val
        if (typeof val === 'string' && val !== '') titles.set(String(key), val)
      }
    }
  } catch {
    // best-effort enrichment only
  }
  return titles
}

/**
 * The full session inventory for the Sessions settings page: persisted
 * headers merged with live sessions and archive-set ghosts, each row carrying
 * title/cwd/createdAt, live+archived+hasLog flags, and its workspace.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @returns the `{ available, items, counts }` payload.
 */
export async function listSessions(ctx) {
  const empty = {
    available: { persistence: false, sessions: false, registry: false },
    items: [],
    counts: { total: 0, live: 0, archived: 0, ghosts: 0 },
  }
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.list !== 'function') return empty
  const available = {
    persistence: true,
    sessions: ctx.get('sessions') !== undefined,
    registry: ctx.get('workspaceRegistry') !== undefined,
  }

  // Persisted headers are the base inventory; live sessions fill any gap
  // (a created-but-never-appended session has no materialized log yet).
  const byId = new Map()
  for (const header of await persistence.list()) {
    if (header?.id !== undefined) byId.set(String(header.id), header)
  }
  const liveIds = new Set()
  const sessionsSvc = ctx.get('sessions')
  if (sessionsSvc !== undefined && typeof sessionsSvc.list === 'function') {
    for (const session of sessionsSvc.list()) {
      const header = session?.header
      if (header?.id === undefined) continue
      liveIds.add(String(header.id))
      if (!byId.has(String(header.id))) byId.set(String(header.id), header)
    }
  }

  // Workspace accounting (the getter filters by canonical cwd, so ghosts with
  // no header resolve to no workspace — correct) and the archive set.
  const workspaceOf = new Map()
  const archivedSet = new Set()
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined && typeof registry.list === 'function') {
    for (const workspace of registry.list()) {
      for (const sid of workspace.sessionIds) {
        workspaceOf.set(String(sid), { title: workspace.title, path: workspace.path })
      }
    }
    try {
      for (const sid of registry.archivedSessionIds) archivedSet.add(String(sid))
    } catch {
      // fall through to the domain global below
    }
  }
  if (archivedSet.size === 0) {
    try {
      const global = ctx.get('storageDomain')?.get('workspace')?.global
      const state = typeof global?.get === 'function' ? global.get() : undefined
      for (const sid of state?.archivedSessionIds ?? []) archivedSet.add(String(sid))
    } catch {
      // no archive information at all — fine
    }
  }

  const titles = readTitles(ctx)

  const items = []
  const seen = new Set()
  for (const [id, header] of byId) {
    seen.add(id)
    items.push({
      id,
      title: titles.get(id) ?? '',
      cwd: typeof header.cwd === 'string' ? header.cwd : '',
      createdAt: typeof header.createdAt === 'number' ? header.createdAt : 0,
      live: liveIds.has(id),
      archived: archivedSet.has(id),
      hasLog: true,
      workspace: workspaceOf.get(id) ?? null,
    })
  }
  // Ghosts: archived ids with neither a log nor a live lifecycle.
  for (const id of archivedSet) {
    if (seen.has(id)) continue
    items.push({
      id,
      title: titles.get(id) ?? '',
      cwd: '',
      createdAt: 0,
      live: liveIds.has(id),
      archived: true,
      hasLog: false,
      workspace: workspaceOf.get(id) ?? null,
    })
  }
  items.sort((a, b) => (b.createdAt - a.createdAt) || (a.id < b.id ? -1 : 1))

  return {
    available,
    items,
    counts: {
      total: items.length,
      live: items.reduce((n, item) => n + (item.live ? 1 : 0), 0),
      archived: items.reduce((n, item) => n + (item.archived ? 1 : 0), 0),
      ghosts: items.reduce((n, item) => n + (!item.hasLog && !item.live ? 1 : 0), 0),
    },
  }
}

/**
 * Destructively delete one session (archived or not): sweep workspace
 * accounting and the projection cache, remove the durable log directory with
 * a bounded write-after-delete retry, then best-effort scrub the archive set.
 * Refuses live sessions and non-jsonl backends; every step is idempotent, so
 * a crash mid-delete converges by simply re-running the call.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} rawId - the session id to delete.
 * @returns the per-step outcome summary.
 */
export async function deleteSession(ctx, rawId) {
  const id = String(rawId ?? '')
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')

  const sessionsSvc = ctx.get('sessions')
  if (sessionsSvc !== undefined && typeof sessionsSvc.get === 'function' && sessionsSvc.get(id) !== undefined) {
    throw new Error(`dsh-base-plugin: session "${id}" is live in this process — close it before deleting`)
  }

  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.list !== 'function' || typeof persistence.locate !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  // Resolve and validate EVERYTHING before the first mutation: a refusal
  // (non-jsonl backend, id/segment mismatch) must leave all five stores
  // untouched — sweeping accounting first and then refusing the log removal
  // would strand a still-listed session in ungrouped limbo with no UI path
  // back (attach has no RPC; bootstrap re-adoption runs only on first init).
  const header = (await persistence.list()).find(h => String(h.id) === id)
  let logDir = null
  if (header !== undefined) {
    const location = persistence.locate(header)
    if (location === undefined || location.kind !== 'jsonl' || typeof location.path !== 'string') {
      throw new Error(`dsh-base-plugin: session "${id}" is not stored as a jsonl artifact — deletion supports the jsonl backend only`)
    }
    const dir = dirname(location.path)
    if (basename(dir) !== encodeSegment(id)) {
      throw new Error(`dsh-base-plugin: refusing to delete "${dir}": directory name does not match the encoded session id`)
    }
    logDir = dir
  }

  // 0. Announce the deletion through the OFFICIAL teardown channel so every
  //    connected client drops the sidebar row live. The web client removes a
  //    list row on exactly one frame — `host/session-removed` — which the
  //    api-proxy emits only from `session/disposed`, and that event fires only
  //    when a LIVE session leaves the store. A cold (never-opened-here)
  //    session has no live instance, so deleting its stores alone leaves the
  //    row in every client's in-memory list until the next page load. Resume
  //    + dispose walks the same path as closing a conversation: materialize
  //    the persisted session, then tear the agent down properly — dispose
  //    drains writers first, which also removes the log-removal race below.
  //    Graceful degradation: without the agents service, or when resume fails
  //    on an unreadable log, fall back to the legacy best-effort removal
  //    (the row then lingers until refresh — the pre-fix behavior).
  let announced = false
  if (header !== undefined) {
    const agents = ctx.get('agents')
    if (agents !== undefined && typeof agents.resume === 'function') {
      try {
        const handle = await agents.resume({ resumeSessionId: id })
        await handle.dispose()
        announced = true
      } catch (error) {
        // A resume racing the user opening the session leaves it live —
        // refuse like the upfront check would, never rm a live log.
        if (sessionsSvc !== undefined && typeof sessionsSvc.get === 'function' && sessionsSvc.get(id) !== undefined) {
          throw new Error(`dsh-base-plugin: session "${id}" is live in this process — close it before deleting`)
        }
        ctx.logger.warn(`dsh-base-plugin: resume+dispose of "${id}" failed (falling back to best-effort removal): ${String(error)}`)
      }
    }
  }

  // 1. Workspace accounting first: idempotent, event-emitting, and no durable
  //    write when the record never contained the id.
  let workspacesSwept = 0
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined && typeof registry.list === 'function') {
    for (const workspace of registry.list()) {
      try {
        await workspace.detachSession(id)
        workspacesSwept += 1
      } catch (error) {
        ctx.logger.warn(`dsh-base-plugin: detach of "${id}" from workspace "${workspace.id}" failed: ${String(error)}`)
      }
    }
  }

  // 2. Projection-cache row through the live domain runtime.
  let cacheDropped = false
  try {
    const domain = ctx.get('storageDomain')
    const table = typeof domain?.get === 'function' ? domain.get('session_projcache')?.table?.('sessions') : undefined
    if (table !== undefined && typeof table.delete === 'function') cacheDropped = await table.delete(id)
  } catch (error) {
    ctx.logger.warn(`dsh-base-plugin: projection-cache drop for "${id}" failed: ${String(error)}`)
  }

  // 3. The durable log directory — the only destructive step (pre-validated
  //    above: logDir is null exactly when the session has no materialized
  //    log, i.e. a ghost metadata-only delete).
  let hadLog = false
  if (logDir !== null) {
    hadLog = true
    let removed = false
    for (let attempt = 0; attempt < 4 && !removed; attempt += 1) {
      await rm(logDir, { recursive: true, force: true })
      const stillListed = (await persistence.list()).some(h => String(h.id) === id)
      if (!stillListed) removed = true
      else await new Promise(resolve => setTimeout(resolve, 250))
    }
    if (!removed) {
      throw new Error(`dsh-base-plugin: session "${id}" reappeared after deletion (a writer is still flushing it) — retry once the session has fully closed`)
    }
    try {
      await rmdir(dirname(logDir)) // drop the project directory too when now empty
    } catch {
      // not empty (other sessions) or already gone — both fine
    }
  }

  // 4. Archive-set scrub, best-effort (see module header for the write-back
  //    caveat: a re-written stale id hides nothing).
  let archiveScrubbed = false
  try {
    const global = ctx.get('storageDomain')?.get('workspace')?.global
    if (typeof global?.get === 'function' && typeof global.set === 'function') {
      const state = global.get()
      if (Array.isArray(state?.archivedSessionIds) && state.archivedSessionIds.some(sid => String(sid) === id)) {
        await global.set({
          ...state,
          archivedSessionIds: state.archivedSessionIds.filter(sid => String(sid) !== id),
        })
        archiveScrubbed = true
      }
    }
  } catch (error) {
    ctx.logger.warn(`dsh-base-plugin: archive-set scrub for "${id}" failed: ${String(error)}`)
  }

  // 5. Drop the monitor panel's token-fold cursor so a recreated session id
  //    refolds from zero instead of skipping the new log's early events.
  dropMonitorCursor(id)
  dropMcpHealthCursor(id)
  dropFileOpsFold(id)
  dropContextArm(id)

  return { id, hadLog, workspacesSwept, cacheDropped, archiveScrubbed, announced }
}
