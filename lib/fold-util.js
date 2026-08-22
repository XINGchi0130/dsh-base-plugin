/**
 * dsh-base-plugin — shared incremental-fold runtime.
 *
 * The fold family (monitor / mcp-health / file-ops) shares one pattern that
 * previously existed in three divergent dialects (three cursor semantics,
 * three error policies, two single-flight shapes — the exact soil the
 * historical double-count/pairing bugs grew in). This module is the ONE
 * dialect now:
 *
 *  - cursor semantics: the stored `nextSeq` is the seq the NEXT read starts
 *    from (0 = read everything). `advance(event)` keeps it monotonic.
 *  - single-flight: concurrent `run()` calls for the same key share one
 *    in-flight promise (rejection propagates to all sharers, inflight cleared
 *    in finally).
 *  - progress fence: a backend violating the seq contract (repeated or
 *    regressing seq) sets `stalled` instead of looping forever.
 *  - read errors: `onReadError` decides policy per module — throw (abort the
 *    whole fold), or keep-and-degrade (return 'keep' to preserve accumulated
 *    state and skip this round). The runtime never silently resets.
 *
 * @module dsh-base-plugin/lib/fold-util
 */

/** One per-key fold state machine. */
export class FoldRunner {
  /**
   * @param {object} options
   * @param {() => Promise<{events: readonly {seq:number}[]}>} options.read
   *        (nextSeq) => next page of events (the persistence contract returns
   *        ALL remaining events; the runtime still loops defensively).
   * @param {(event: any, state: S) => void} options.onEvent — fold one event
   *        into the module-owned state object.
   * @param {(error: unknown, state: S) => 'throw' | 'keep'} options.onReadError
   *        — read failure policy per module.
   * @param {S} options.state — the module-owned accumulator (mutated by
   *        onEvent; the runner only owns nextSeq/stalled).
   */
  constructor({ read, onEvent, onReadError, state }) {
    this.#read = read
    this.#onEvent = onEvent
    this.#onReadError = onReadError
    this.state = state
    this.nextSeq = 0
    this.stalled = false
    this.#inflight = null
  }

  #read
  #onEvent
  #onReadError
  #inflight

  /**
   * Incrementally fold new events. Single-flight: a concurrent call reuses
   * the same in-flight fold (shared-state mutation made concurrent folds
   * double-count historically).
   * @returns the module-owned state after this fold.
   */
  run() {
    if (this.#inflight !== null) return this.#inflight
    const exec = this.#exec().finally(() => { this.#inflight = null })
    this.#inflight = exec
    return exec
  }

  async #exec() {
    if (this.stalled) return this.state // a previously detected backend violation sticks until reset
    for (;;) {
      let page
      try {
        page = await this.#read(this.nextSeq)
      } catch (error) {
        if (this.#onReadError(error, this.state) === 'keep') return this.state
        throw error
      }
      const events = page?.events ?? []
      if (events.length === 0) return this.state
      let stalledNow = false
      for (const event of events) {
        const seq = typeof event?.seq === 'number' ? event.seq : null
        if (seq === null || seq < this.nextSeq) { // repeated/regressed/absent
          stalledNow = true
          break
        }
        this.nextSeq = seq + 1
        this.#onEvent(event, this.state)
      }
      if (stalledNow) {
        this.stalled = true
        return this.state
      }
    }
  }
}

/** Registry of per-key runners with drop + single-run helpers. */
export class FoldRegistry {
  #runners = new Map()

  /** Get or create the runner for a key. */
  of(key, create) {
    const k = String(key)
    let runner = this.#runners.get(k)
    if (runner === undefined) {
      runner = create()
      this.#runners.set(k, runner)
    }
    return runner
  }

  /** Whether a runner exists for the key. */
  has(key) { return this.#runners.has(String(key)) }

  /** Drop one key's runner (session deletion). */
  drop(key) { this.#runners.delete(String(key)) }

  /** Drop every runner (full reset). */
  clear() { this.#runners.clear() }

  /** All live keys (diagnostics). */
  get size() { return this.#runners.size }
}
