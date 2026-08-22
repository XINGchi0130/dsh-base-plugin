/**
 * dsh-base-plugin — session time machine (fork a session from an earlier turn).
 *
 * The OFFICIAL `ctx.sessions.fork(source, boundary)` primitive creates a live
 * child seeded with the source's event prefix through an inclusive boundary
 * seq (meta: cwd + parentSession lineage handled by the store). This module
 * only supplies the UI's data: the list of forkable boundaries (each
 * completed turn's end seq, with a preview of the turn's first human prompt)
 * and a thin fork wrapper with a cold-source PRECHECK (a clear Chinese
 * message pointing at "open the session first" — the official fork would
 * otherwise surface an English "session not found" that misdirects); the UI
 * also disables fork for cold sessions and shows a banner up front).
 *
 * The created child is announced through `session/created`, so every
 * connected client's sidebar grows the row live (same frame path as the
 * delete fix) — no refresh needed.
 *
 * @module dsh-base-plugin/lib/timemachine
 */

/** Preview clip length for one turn's first human prompt. */
const PREVIEW_MAX = 80

/**
 * List the forkable turn boundaries of one session.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - session to scan.
 * @returns the `{ live, turns }` payload — turns newest first, each
 *   `{ turn, endSeq, time, preview }`.
 */
export async function listTurns(ctx, sessionId) {
  const id = String(sessionId ?? '')
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }
  const sessions = ctx.get('sessions')
  const live = sessions !== undefined && typeof sessions.get === 'function' && sessions.get(id) !== undefined

  const turns = []
  let seq = 0
  let stalled = false
  let current = null // { turn, firstUser }
  for (;;) {
    let page
    try {
      page = await persistence.readFrom(id, seq)
    } catch (error) {
      throw new Error(`dsh-base-plugin: 无法读取会话日志: ${error instanceof Error ? error.message : String(error)}`)
    }
    const events = page?.events ?? []
    if (events.length === 0 || stalled) break
    for (const event of events) {
      // 进度保护：契约下 seq 恒存在且单调；缺陷后端导致不前进时跳出
      //（而非死循环空转）。
      const next = (event.seq ?? seq) + 1
      if (next <= seq) { stalled = true; break }
      seq = next
      const data = event.data ?? {}
      if (event.type === 'turn/start') {
        current = { turn: data.turn ?? turns.length + 1, firstUser: null }
      } else if (event.type === 'user/message' && current !== null && current.firstUser === null
        && (data.source?.kind === 'user' || data.source?.kind === undefined)) {
        const block = Array.isArray(data.content) ? data.content.find(b => b?.type === 'text') : undefined
        const text = typeof block?.text === 'string' ? block.text.trim() : ''
        if (text !== '') {
          current.firstUser = text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX)}…` : text
        }
      } else if (event.type === 'turn/end' && current !== null) {
        turns.push({
          turn: current.turn,
          endSeq: event.seq ?? seq - 1,
          time: typeof event.time === 'number' ? event.time : 0,
          preview: current.firstUser ?? '(无文字输入)',
        })
        current = null
      }
    }
  }
  turns.reverse() // newest first — the most likely fork target on top
  return { sessionId: id, live, turns }
}

/**
 * Fork a live session at one completed-turn boundary.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - live source session id.
 * @param {number} boundary - inclusive event seq (a turn/end from listTurns).
 * @returns the `{ childId, turn }` payload.
 */
export function forkAtTurn(ctx, sessionId, boundary) {
  const id = String(sessionId ?? '')
  const boundarySeq = Number(boundary)
  if (id === '' || !Number.isSafeInteger(boundarySeq) || boundarySeq < 0) {
    throw new Error('dsh-base-plugin: sessionId and boundary (integer seq) are required')
  }
  const sessions = ctx.get('sessions')
  if (sessions === undefined || typeof sessions.fork !== 'function') {
    throw new Error('dsh-base-plugin: the sessions service (with fork) is unavailable')
  }
  // 冷源预检：官方 fork 对未激活会话抛英文 "session not found"，对磁盘
  // 上确实存在的会话有误导——这里换成指向明确的中文（UI 侧也对冷会话
  // 禁用了按钮，此为后端兜底）。
  if (typeof sessions.get === 'function' && sessions.get(id) === undefined) {
    throw new Error('dsh-base-plugin: 该会话未在本进程激活——请先在会话页打开它再分叉（fork 需要活跃的源会话）')
  }
  const child = sessions.fork(id, boundarySeq)
  return { childId: child.id, turn: null, boundary: boundarySeq }
}
