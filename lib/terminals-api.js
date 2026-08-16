/**
 * dsh-base-plugin — PTY terminals over the official `terminals` service.
 *
 * The registry is owner-scoped (`Agent`), so every HTTP call below resolves
 * the session's live agent first — `agents.get(sessionId)` (via ctx.get,
 * never a property access), falling back to `agents.resume()` (the same
 * path the API remotes use) — and then performs the operation as that
 * owner. Terminals die with their owning agent, so closing the conversation
 * cleans its terminals.
 *
 * Interaction model: the official service allows EXACTLY ONE live send
 * operation per PTY. This layer therefore tracks one live op PER TERMINAL:
 * a second send while an op is unsettled is rejected with a friendly error
 * (the UI shows it; Ctrl+C interrupts the running op). Ops are dropped from
 * tracking the moment they settle (read observes it or the done promise
 * fires), so nothing leaks.
 * @module dsh-base-plugin/lib/terminals-api
 */

/** Wait between settled reads while an op is live (ms). */
const POLL_GRACE_MS = 1200

export function createTerminalsApi(ctx) {
  /** Live send operations: opKey → { op, done } */
  const ops = new Map()
  /** Which opKey is live per terminalId (unsettled). */
  const livePerTerminal = new Map()

  /** Resolve the session's live agent (get → resume). */
  async function agentFor(sessionId) {
    const agents = ctx.get('agents')
    if (agents === undefined || typeof agents.resume !== 'function') {
      throw new Error('dsh-base-plugin: agents service unavailable')
    }
    const live = agents.get(sessionId)
    if (live !== undefined) return live
    const handle = await agents.resume({ resumeSessionId: sessionId })
    return handle.agent
  }

  const terminals = () => {
    const svc = ctx.get('terminals')
    if (svc === undefined) throw new Error('dsh-base-plugin: terminals service unavailable (mount @deepseek-ai/dsh-terminal + a backend)')
    return svc
  }

  /** Forget a settled op from both tracking maps. */
  function dropOp(opKey) {
    ops.delete(opKey)
    for (const [termId, key] of livePerTerminal) {
      if (key === opKey) livePerTerminal.delete(termId)
    }
  }

  return {
    /** Whether the terminals service is mounted at all. */
    available() {
      return ctx.get('terminals') !== undefined
    },

    /** Spawn a PTY in the session workspace. */
    async open(sessionId, name, cwd) {
      const owner = await agentFor(sessionId)
      const result = await terminals().spawn(owner, {
        type: 'shell',
        ...(typeof name === 'string' && name !== '' ? { name } : {}),
        ...(typeof cwd === 'string' && cwd !== '' ? { cwd } : {}),
      })
      return {
        sessionId: result.sessionId,
        name: result.name ?? '',
        pid: result.pid,
        motd: result.motd ?? '',
        status: result.status,
      }
    },

    /** Owner-visible session list. */
    async list(sessionId) {
      const owner = await agentFor(sessionId)
      return terminals().list(owner).map(s => ({
        sessionId: s.sessionId,
        name: s.name ?? '',
        type: s.type,
        pid: s.pid,
        status: s.status,
      }))
    },

    /**
     * Write a line into the PTY (opens the terminal's one live op). Rejects
     * with a friendly error while a previous op is still unsettled — the
     * official backend allows exactly one live send per PTY.
     */
    async send(sessionId, terminalId, opKey, text, submit) {
      const current = livePerTerminal.get(terminalId)
      if (current !== undefined && ops.has(current)) {
        throw new Error('dsh-base-plugin: a command is still running in this terminal — interrupt it (Ctrl+C) or wait for it to finish')
      }
      const owner = await agentFor(sessionId)
      const op = terminals().startSend(owner, terminalId, { text, submit })
      ops.set(opKey, { op, done: op.done })
      livePerTerminal.set(terminalId, opKey)
      // Self-cleanup if the op settles without any read observing it.
      void op.done.catch(() => {}).then(() => dropOp(opKey))
      return { opened: true }
    },

    /**
     * Poll one op's output. `done: true` means the op settled and its output
     * is fully drained into the returned delta.
     */
    async read(sessionId, terminalId, opKey) {
      const record = ops.get(opKey)
      if (record === undefined) {
        return { delta: '', truncated: false, done: true, sessionStatus: null }
      }
      const chunk = record.op.readOutput()
      const settled = await Promise.race([
        record.done.then(() => true).catch(() => true),
        new Promise(resolve => { setTimeout(() => resolve(false), POLL_GRACE_MS) }),
      ])
      let final = ''
      if (settled) {
        try {
          final = record.op.readOutput().delta
        } catch { /* op already closed */ }
        dropOp(opKey)
      }
      let status = null
      try {
        const list = terminals().list(await agentFor(sessionId))
        const snap = list.find(s => s.sessionId === terminalId)
        if (snap !== undefined) status = snap.status
      } catch { /* status is best-effort */ }
      return {
        delta: chunk.delta + final,
        truncated: chunk.truncated,
        done: settled,
        sessionStatus: status,
      }
    },

    /** SIGINT the terminal's live op (Ctrl+C). */
    async interrupt(sessionId, terminalId, opKey) {
      void sessionId
      const key = opKey !== undefined && ops.has(opKey) ? opKey : livePerTerminal.get(terminalId)
      if (key === undefined) return { delivered: false }
      const record = ops.get(key)
      if (record === undefined) return { delivered: false }
      try {
        return { delivered: record.op.cancel() === true }
      } catch {
        return { delivered: false }
      }
    },

    /** Close the PTY itself (drops its live-op tracking too). */
    async kill(sessionId, terminalId) {
      const owner = await agentFor(sessionId)
      const ok = await terminals().kill(owner, terminalId, 'user closed the terminal tab')
      const key = livePerTerminal.get(terminalId)
      if (key !== undefined) dropOp(key)
      return { closed: ok }
    },
  }
}
