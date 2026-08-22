/**
 * dsh-base-plugin — AI operation log (the File Changes panel's Operation Log
 * tab): the operation TRAIL — when, which tool, which target, ±how big,
 * success or failure. No diffs by design: write/edit fold ±line counts from
 * the official meta payload's hunk shapes, reads record the probed path,
 * bash records the command line + workdir. "What exactly changed on disk"
 * is the Workspace Changes (git) tab's job — the two tabs are complements.
 *
 * Incremental: per-session seq cursors + persisted lifetime aggregates
 * (fileCounts / fileTotals never shrink; rows capped by trimFold, evicted
 * files stay as summary-only rows).
 *
 * @module dsh-base-plugin/lib/file-ops
 */

/** Payload bounds: per-file ops in the poll answer (newest first). */
const OPS_PER_FILE = 30

/** Line counts for one hunk pair (null old text counts as 0). */
function lineCounts(oldText, newText) {
  const count = (text) => (typeof text === 'string' && text !== '' ? text.split('\n').length : 0)
  return { added: count(newText), deleted: count(oldText) }
}

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
    fold = { lastSeq: 0, pending: new Map(), files: new Map(), fileCounts: new Map(), fileTotals: new Map() }
    folds.set(id, fold)
  }
  const bumpFile = (path, added = 0, deleted = 0) => {
    fold.fileCounts.set(path, (fold.fileCounts.get(path) ?? 0) + 1)
    // 终身总量与行保留解耦：trimFold 丢行后总量不得回缩（三类历史 bug
    // 之"聚合不持久化"的残留变体）。
    const totals = fold.fileTotals.get(path) ?? { added: 0, deleted: 0 }
    totals.added += added
    totals.deleted += deleted
    fold.fileTotals.set(path, totals)
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
              // 新建文件兜底：官方 presentationMeta 对 before===null 的 write
              // 返回空 diffs——成功创建 N 行的文件曾记成 ±0。call 侧顺带
              // 记 content 行数，无 diffs 的成功 write 用它作 added。
              if (name === 'write' && typeof args.content === 'string') {
                entry.contentLines = args.content === '' ? 0 : args.content.split('\n').length
              }
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
        const failed = block?.isError === true || data.error != null
        if (call.kind === 'command') {
          // bash：命令行即条目（成功与否都记）。
          const ops = fold.files.get(call.command) ?? []
          ops.unshift({ opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool, added: 0, deleted: 0, failed, kind: 'command', cwd: call.cwd })
          fold.files.set(call.command, ops)
          bumpFile(call.command, 0, 0)
          trimFold(fold)
          continue
        }
        if (diffs.length === 0) {
          const ops = fold.files.get(call.path) ?? []
          const created = call.tool === 'write' && failed !== true && call.contentLines !== undefined
            ? call.contentLines : 0
          ops.unshift({
            opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool,
            added: created, deleted: 0, failed,
            kind: READ_TOOLS.has(call.tool) ? 'read' : 'write',
          })
          fold.files.set(call.path, ops)
          bumpFile(call.path, created, 0)
          trimFold(fold)
          continue
        }
        // write/edit：只取 ±行数（hunk 合并为一行；目标以 meta.diffs
        // 路径为准）。diff 文本刻意不存——那是工作区变更（git）tab 的
        // 职责，操作记录只关心轨迹。
        let fileAdded = 0
        let fileDeleted = 0
        let diffPath = null
        for (const d of diffs) {
          const { added, deleted } = lineCounts(d.oldText, d.newText)
          fileAdded += added
          fileDeleted += deleted
          diffPath = d.path
        }
        const target = diffPath ?? call.path
        const ops = fold.files.get(target) ?? []
        bumpFile(target, fileAdded, fileDeleted)
        ops.unshift({
          opId: `op${event.seq}`, time: call.time, turn: call.turn, tool: call.tool,
          added: fileAdded, deleted: fileDeleted, failed, kind: 'write',
        })
        fold.files.set(target, ops)
        trimFold(fold)
      }
    }
  }

  // Project to the payload: files by last-touched desc; per-file ops
  // truncated to OPS_PER_FILE newest, summaries only (no diff text).
  // opsCount reports the LIFETIME count (fold.fileCounts), not the retained
  // row count — trimFold may have dropped the oldest rows, but "how many
  // operations ever" must stay truthful.
  // 键集上限：每条不同 bash 命令都是永久键，跑过几千条命令后 payload
  // 与 trim 成本随之膨胀。payload 只带最新 TOUCH_LIMIT 个键；行已清空
  // 且超出窗口的 command 键从 fold.files 清除（终身 counts/totals 在旁路
  // Map 保留——"总量不回缩"的承诺由它们承担，files 只承载可见行）。
  const TOUCH_LIMIT = 100
  const touched = [...fold.files.entries()]
    .sort((a, b) => ((b[1][0]?.time ?? 0) - (a[1][0]?.time ?? 0)))
  for (const [path] of touched.slice(TOUCH_LIMIT)) {
    // 超窗键连行清除（不只是空行键）：bash 命令键每条唯一、行永不清空，
    // "仅清空键"条件永远不满足——键集仍无界。总量记忆由 fileCounts/
    // fileTotals 旁路承担，被清键的可见行消失属预期（截断提示由
    // opsCount>ops.length 呈现）。
    fold.files.delete(path)
  }
  const files = [...fold.files.entries()]
    .map(([path, ops]) => ({
      path,
      opsCount: fold.fileCounts.get(path) ?? ops.length,
      totalAdded: fold.fileTotals?.get(path)?.added ?? ops.reduce((n, op) => n + op.added, 0),
      totalDeleted: fold.fileTotals?.get(path)?.deleted ?? ops.reduce((n, op) => n + op.deleted, 0),
      ops: ops.slice(0, OPS_PER_FILE).map(({ opId, time, turn, tool, added, deleted, failed, kind, cwd }) => (
        { opId, time, turn, tool, added, deleted, failed, ...(kind !== undefined ? { kind } : {}), ...(cwd !== null && cwd !== undefined ? { cwd } : {}) }
      )),
    }))
    .sort((a, b) => (b.ops[0]?.time ?? 0) - (a.ops[0]?.time ?? 0))

  return { sessionId: id, files }
}

/** Keep the fold bounded: ops arrays are newest-FIRST (oldest at tails).
 * Beyond ROWS_HARD_CAP total rows, drop the oldest rows per-file; files whose
 * rows hit zero STAY as keys (payload renders them as summary-only rows so
 * lifetime counts/totals never shrink). No diff eviction — no diffs stored. */
const ROWS_HARD_CAP = 600

function trimFold(fold) {
  let total = 0
  for (const ops of fold.files.values()) total += ops.length
  while (total > ROWS_HARD_CAP) {
    let victimOps = null
    for (const ops of fold.files.values()) {
      if (ops.length >= 1 && (victimOps === null || (ops[ops.length - 1]?.time ?? 0) < (victimOps[victimOps.length - 1]?.time ?? 0))) {
        victimOps = ops
      }
    }
    if (victimOps === null) break
    victimOps.pop()
    total -= 1
  }
}
