/**
 * dsh-base-plugin — AI file-operation history (the File Changes panel's
 * Edit History tab).
 *
 * The official `write`/`edit` tools persist one structured diff per call in
 * the `tool/result` event's private `meta` payload (`{ diffs:
 * [{ path, oldText, newText }] }` — the same data `presentResult` replays
 * its diff card from). This module folds those events per session into a
 * reverse-chronological, file-grouped timeline:
 *
 *   file → [{ time, turn, tool, added, deleted, diff: {oldText, newText} }]
 *
 * Scope honesty: this captures every change made through the write/edit
 * tools (the model's main file channel). Changes via bash (sed/redirection)
 * are not write-tool calls — those surface in the Workspace Changes tab
 * through git instead; the two tabs are complementary.
 *
 * Incremental: a per-session seq cursor (monitor.js pattern) reads only new
 * events per poll; the folded timeline persists across calls (the
 * mcp-health lesson: a cursor without a persisted aggregate silently drops
 * history). Deletion drops the session's whole fold.
 *
 * @module dsh-base-plugin/lib/file-ops
 */

/** Line counts for one diff pair (null texts count as 0). */
function lineCounts(oldText, newText) {
  const count = (text) => (typeof text === 'string' && text !== '' ? text.split('\n').length : 0)
  return { added: count(newText), deleted: count(oldText) }
}

/** Per-session fold state: sessionId → { lastSeq, files: Map<path, ops[]> }. */
const folds = new Map()

/** Drop one session's fold (session deletion: a recreated id refolds fresh). */
export function dropFileOpsFold(sessionId) {
  folds.delete(String(sessionId ?? ''))
}

/** Whether the fold's data source exists. */
export function fileOpsAvailable(ctx) {
  const persistence = ctx.get('sessionPersistence')
  return persistence !== undefined && typeof persistence.readFrom === 'function'
}

/**
 * The file-operation timeline for one session, newest first, grouped by
 * file (files ordered by last-touched time desc).
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - session whose write/edit history is folded.
 * @returns the `{ files }` payload — each file `{ path, ops: [...], totalAdded,
 *   totalDeleted }`, ops newest first: `{ time, turn, tool, added, deleted,
 *   diff }`.
 */
export async function fileOps(ctx, sessionId) {
  const id = String(sessionId ?? '')
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  let fold = folds.get(id)
  if (fold === undefined) {
    fold = { lastSeq: 0, files: new Map() }
    folds.set(id, fold)
  }

  // tool name → target path argument (the fs tools' first arg is file_path;
  // narrow by known names so unknown tools never pollute the timeline).
  const WRITE_TOOLS = new Set(['write', 'edit'])
  const pendingCalls = new Map() // callId → { tool, path, turn, time }

  for (;;) {
    let page
    try {
      page = await persistence.readFrom(id, fold.lastSeq)
    } catch (error) {
      // Unreadable log: keep the accumulated fold, rewind the cursor so a
      // later readable state refolds the tail.
      throw new Error(`dsh-base-plugin: 无法读取会话日志: ${error instanceof Error ? error.message : String(error)}`)
    }
    const events = page?.events ?? []
    if (events.length === 0) break
    for (const event of events) {
      fold.lastSeq = (event.seq ?? fold.lastSeq) + 1
      const data = event.data ?? {}
      if (event.type === 'tool/call') {
        if (!WRITE_TOOLS.has(String(data.name))) continue
        let path = null
        try {
          const args = JSON.parse(typeof data.arguments === 'string' ? data.arguments : '{}')
          if (typeof args.file_path === 'string') path = args.file_path
        } catch { /* unparsable args → skip this call */ }
        if (path !== null) {
          pendingCalls.set(String(data.callId), {
            tool: String(data.name), path, turn: data.turn ?? null, time: event.time,
          })
        }
      } else if (event.type === 'tool/result') {
        const block = Array.isArray(data.message?.content) ? data.message.content[0] : data.message?.content
        const callId = String(block?.toolCallId ?? '')
        const call = pendingCalls.get(callId)
        if (call === undefined) continue
        pendingCalls.delete(callId)
        // Failed writes present no diff meta — record the attempt with zero
        // counts and an error mark (an honest "nothing changed" row).
        const meta = data.meta
        const diffs = meta !== null && typeof meta === 'object' && Array.isArray(meta.diffs)
          ? meta.diffs.filter(d => d !== null && typeof d === 'object' && typeof d.path === 'string')
          : []
        const failed = block?.isError === true || data.error !== undefined
        if (diffs.length === 0) {
          const ops = fold.files.get(call.path) ?? []
          ops.unshift({ time: call.time, turn: call.turn, tool: call.tool, added: 0, deleted: 0, diff: null, failed })
          fold.files.set(call.path, ops)
          continue
        }
        for (const d of diffs) {
          const ops = fold.files.get(d.path) ?? []
          const { added, deleted } = lineCounts(d.oldText, d.newText)
          ops.unshift({
            time: call.time, turn: call.turn, tool: call.tool, added, deleted,
            diff: { oldText: typeof d.oldText === 'string' ? d.oldText : '', newText: typeof d.newText === 'string' ? d.newText : '' },
            failed,
          })
          fold.files.set(d.path, ops)
        }
      }
    }
  }

  // Project to the payload: files by last-touched desc, ops newest first.
  const files = [...fold.files.entries()]
    .map(([path, ops]) => ({
      path,
      ops,
      totalAdded: ops.reduce((n, op) => n + op.added, 0),
      totalDeleted: ops.reduce((n, op) => n + op.deleted, 0),
    }))
    .sort((a, b) => (b.ops[0]?.time ?? 0) - (a.ops[0]?.time ?? 0))

  return { sessionId: id, files }
}
