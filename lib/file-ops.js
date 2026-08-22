/**
 * dsh-base-plugin — AI operation history (the File Changes panel's
 * Operation Log tab): writes, reads, and bash executions.
 *
 * The official `write`/`edit` tools persist one structured diff per call in
 * the `tool/result` event's private `meta` payload (`{ diffs:
 * [{ path, oldText, newText }] }` — the same data `presentResult` replays
 * its diff card from). This module folds those events per session into a
 * reverse-chronological, file-grouped timeline:
 *
 *   file → [{ time, turn, tool, added, deleted, diff: {oldText, newText} }]
 *
 * Operation kinds:
 *  - write/edit: full ±line diffs (the official meta payload).
 *  - read: the probed path (no diff — reads change nothing).
 *  - bash: the command line (truncated) + workdir when the tool names one;
 *    file mutations via bash are NOT diffed here — they surface in the
 *    Workspace Changes tab through git; the two tabs are complementary.
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

/**
 * Payload bounds (see the perf note in the module header): the poll answer
 * carries SUMMARIES ONLY — per-op time/tool/turn/±lines plus a stable
 * `opId` — never diff texts. Diffs are fetched on demand via fileOpsDiff
 * (the fold retains the full text up to OPS_KEEP, the most recent N ops).
 */
const OPS_PER_FILE = 30 // per-file ops in the payload (newest)
const OPS_KEEP = 200 // full-diff retention per session fold (newest)

/** Per-session fold state: sessionId → { lastSeq, pending: Map, files: Map }.
 * `pending` (callId → call) persists across polls so a call whose result
 * lands in the NEXT incremental read still pairs (the mcp-health lesson). */
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
/** Per-session single-flight: a poll racing a manual refresh reuses the same
 * in-flight fold (shared fold mutation made concurrent folds double-count). */
const opsInflight = new Map()

export function fileOps(ctx, sessionId) {
  const id = String(sessionId ?? '')
  const existing = opsInflight.get(id)
  if (existing !== undefined) return existing
  const run = fileOpsImpl(ctx, id).finally(() => { opsInflight.delete(id) })
  opsInflight.set(id, run)
  return run
}

async function fileOpsImpl(ctx, id) {
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  let fold = folds.get(id)
  if (fold === undefined) {
    fold = { lastSeq: 0, pending: new Map(), files: new Map(), fileCounts: new Map() }
    folds.set(id, fold)
  }
  const bumpFile = (path) => {
    fold.fileCounts.set(path, (fold.fileCounts.get(path) ?? 0) + 1)
  }

  // Tracked tools: write/edit carry diffs; read probes a path; bash runs a
  // command. Unknown tools never pollute the timeline.
  const WRITE_TOOLS = new Set(['write', 'edit'])
  const READ_TOOLS = new Set(['read'])
  const BASH_TOOLS = new Set(['bash'])
  const pendingCalls = fold.pending // persists across polls

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
        const name = String(data.name)
        if (!WRITE_TOOLS.has(name) && !READ_TOOLS.has(name) && !BASH_TOOLS.has(name)) continue
        let entry = null
        try {
          const args = JSON.parse(typeof data.arguments === 'string' ? data.arguments : '{}')
          if (WRITE_TOOLS.has(name) || READ_TOOLS.has(name)) {
            if (typeof args.file_path === 'string') {
              entry = { kind: 'file', tool: name, path: args.file_path, turn: data.turn ?? null, time: event.time }
            }
          } else if (BASH_TOOLS.has(name)) {
            const command = typeof args.command === 'string' ? args.command : (typeof args.cmd === 'string' ? args.cmd : '')
            if (command !== '') {
              // bash 的"目标"是命令行——截断保留可读长度
              entry = {
                kind: 'command', tool: name,
                command: command.length > 300 ? `${command.slice(0, 300)}…` : command,
                cwd: typeof args.workdir === 'string' ? args.workdir : (typeof args.cwd === 'string' ? args.cwd : null),
                turn: data.turn ?? null, time: event.time,
              }
            }
          }
        } catch { /* unparsable args → skip this call */ }
        if (entry !== null) pendingCalls.set(String(data.callId), entry)
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
        if (call.kind === 'command') {
          // bash：命令行即条目（成功与否都记；无 diff 可展）
          const ops = fold.files.get(call.command) ?? []
          ops.unshift({ opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool, added: 0, deleted: 0, diff: null, failed, kind: 'command', cwd: call.cwd })
          fold.files.set(call.command, ops)
          bumpFile(call.command)
          trimFold(fold)
          continue
        }
        if (diffs.length === 0) {
          const ops = fold.files.get(call.path) ?? []
          ops.unshift({
            opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool,
            added: 0, deleted: 0, diff: null, failed,
            kind: READ_TOOLS.has(call.tool) ? 'read' : 'write',
          })
          fold.files.set(call.path, ops)
          bumpFile(call.path)
          trimFold(fold)
          continue
        }
        for (const d of diffs) {
          const ops = fold.files.get(d.path) ?? []
          const { added, deleted } = lineCounts(d.oldText, d.newText)
          bumpFile(d.path)
          ops.unshift({
            opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool, added, deleted,
            diff: { oldText: typeof d.oldText === 'string' ? d.oldText : '', newText: typeof d.newText === 'string' ? d.newText : '' },
            failed,
            kind: 'write',
          })
          fold.files.set(d.path, ops)
        }
        trimFold(fold)
      }
    }
  }

  // Project to the payload: files by last-touched desc; per-file ops
  // truncated to OPS_PER_FILE newest, summaries only (no diff text).
  // opsCount reports the LIFETIME count (fold.fileCounts), not the retained
  // row count — trimFold may have dropped the oldest rows, but "how many
  // operations ever" must stay truthful.
  const files = [...fold.files.entries()]
    .map(([path, ops]) => ({
      path,
      opsCount: fold.fileCounts.get(path) ?? ops.length,
      ops: ops.slice(0, OPS_PER_FILE).map(({ opId, time, turn, tool, added, deleted, failed, kind, cwd }) => (
        { opId, time, turn, tool, added, deleted, failed, ...(kind !== undefined ? { kind } : {}), ...(cwd !== null && cwd !== undefined ? { cwd } : {}) }
      )),
      totalAdded: ops.reduce((n, op) => n + op.added, 0),
      totalDeleted: ops.reduce((n, op) => n + op.deleted, 0),
    }))
    .sort((a, b) => (b.ops[0]?.time ?? 0) - (a.ops[0]?.time ?? 0))

  return { sessionId: id, files }
}

/** Keep the fold bounded. Ops arrays are newest-FIRST, so the oldest ops sit
 * at each array's tail. Beyond OPS_KEEP total: strip diff text from the
 * oldest tail entries (evicted mark, summary stays). Beyond 3×OPS_KEEP: drop
 * the oldest rows entirely (per-file tails, round-robin). */
function trimFold(fold) {
  const count = () => { let n = 0; for (const ops of fold.files.values()) n += ops.length; return n }
  let total = count()
  if (total <= OPS_KEEP) return
  // Pass 1: walk files newest-first by their head op time, evicting diff
  // text from tails until back under OPS_KEEP retained-with-diff… simple
  // deterministic rule instead: keep diff on the newest OPS_KEEP ops GLOBALLY.
  const withTime = []
  for (const [path, ops] of fold.files) {
    for (let i = 0; i < ops.length; i += 1) withTime.push({ path, i, time: ops[i].time ?? 0 })
  }
  withTime.sort((a, b) => b.time - a.time)
  const keepDiff = new Set(withTime.slice(0, OPS_KEEP).map(e => e.path + '#' + e.i))
  for (const [path, ops] of [...fold.files.entries()]) {
    for (let i = 0; i < ops.length; i += 1) {
      if (!keepDiff.has(path + '#' + i) && ops[i].diff !== null) {
        ops[i] = { ...ops[i], diff: null, evicted: true }
      }
    }
  }
  // Pass 2: hard cap the row count at 3×OPS_KEEP total, oldest (tail) first.
  total = count()
  while (total > OPS_KEEP * 3) {
    let victim = null
    let victimOps = null
    for (const [path, ops] of fold.files) {
      if (ops.length > 1 && (victimOps === null || (ops[ops.length - 1]?.time ?? 0) < (victimOps[victimOps.length - 1]?.time ?? 0))) {
        victim = path; victimOps = ops
      }
    }
    if (victimOps === null) break
    victimOps.pop()
    total -= 1
    if (victimOps.length === 0) fold.files.delete(victim) // counts stay in fileCounts
  }
}

/** Fetch one op's full diff on demand (returns null when evicted). */
export function fileOpsDiff(sessionId, opId) {
  const fold = folds.get(String(sessionId ?? ''))
  if (fold === undefined) return null
  for (const [path, ops] of fold.files) {
    const op = ops.find(candidate => candidate.opId === String(opId ?? ''))
    if (op !== undefined) {
      return { path, diff: op.diff, evicted: op.evicted === true }
    }
  }
  return null
}
