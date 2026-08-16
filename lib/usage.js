/**
 * dsh-base-plugin — model usage statistics over the session logs.
 *
 * Source of truth is the durable session event log: every `assistant/message`
 * event carries the adapter's TokenUsage (inputTokens EXCLUDES cache hits —
 * cacheRead/cacheWrite are separate, disjoint counts), `request/header`
 * events name the provider/model that produced the surrounding requests, and
 * `tool/call` events name every tool invocation. A single sequential pass per
 * session folds events into the session's cache entry.
 *
 * Cache schema v2 (`$DSH_HOME/dsh-usage-cache.json`):
 * per session — lastSeq, requests, token totals, byModel, byDayModel
 * ({ day → { model → token classes } }, powering per-model time series and
 * date-range filtering), tools ({ name → calls }), first/last time, title.
 * A v1 cache (or a schemaVersion mismatch) is discarded and rescanned.
 *
 * Cost estimation prices token classes at RESPONSE time under an editable
 * USD/1M-token table (DeepSeek reference defaults merge in on load; user
 * values win), so an edited price reprices history instantly.
 * @module dsh-base-plugin/lib/usage
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWrite, dshHome } from './env.js'

const ZERO_TOKENS = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }
const DAY_FIELDS = ['input', 'cacheRead', 'cacheWrite', 'output']
const SCHEMA_VERSION = 4

/** Reference prices (USD / 1M tokens), DeepSeek's published tiers. Editable. */
const DEFAULT_PRICES = {
  'deepseek-official/deepseek-chat': { input: 0.27, cacheRead: 0.07, cacheWrite: 0.27, output: 1.1 },
  'deepseek-official/deepseek-reasoner': { input: 0.55, cacheRead: 0.14, cacheWrite: 0.55, output: 2.19 },
}

function cachePath() {
  return join(dshHome(), 'dsh-usage-cache.json')
}

/** Merge user-edited prices over defaults (user values win; defaults backfill). */
function mergePrices(saved) {
  const merged = { ...DEFAULT_PRICES }
  if (saved !== null && typeof saved === 'object') {
    for (const [key, value] of Object.entries(saved)) {
      if (value !== null && typeof value === 'object') merged[key] = value
    }
  }
  return merged
}

/** Load the scan cache; missing/malformed/old-schema means a fresh empty cache. */
function loadCache() {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && parsed.schemaVersion === SCHEMA_VERSION) {
      return {
        schemaVersion: SCHEMA_VERSION,
        sessions: parsed.sessions !== null && typeof parsed.sessions === 'object' ? parsed.sessions : {},
        ledger: parsed.ledger !== null && typeof parsed.ledger === 'object' ? parsed.ledger : newLedger(),
        prices: mergePrices(parsed.prices),
      }
    }
  } catch { /* fresh */ }
  return { schemaVersion: SCHEMA_VERSION, sessions: {}, ledger: newLedger(), prices: { ...DEFAULT_PRICES } }
}

/**
 * The append-only LEDGER: global day×model and hour×model matrices plus
 * per-model all-time buckets and tool counters. Once an event's numbers are
 * folded in they are NEVER subtracted — deleting a session removes its
 * detail rows (top sessions) but its historical usage stays booked, so the
 * trend/summary keeps bill semantics instead of disk-state semantics.
 */
function newLedger() {
  return {
    byModel: {}, // model → { requests, ...ZERO_TOKENS }
    byDayModel: {}, // day → model → cell
    byHourModel: {}, // hour → model → cell
    tools: {}, // name → { calls, lastTime }
  }
}

function saveCache(cache) {
  atomicWrite(cachePath(), `${JSON.stringify(cache, undefined, 2)}\n`)
}

/** `provider/model` key from a request header config (defensive reads). */
function modelKeyOf(header) {
  const config = header?.config
  if (config === null || typeof config !== 'object') return null
  const provider = typeof config.provider === 'string' ? config.provider : ''
  const model = typeof config.model === 'string' ? config.model : ''
  if (provider === '' || model === '') return null
  return `${provider}/${model}`
}

/** Add one usage event's numbers into a token bucket. */
function addUsage(bucket, usage) {
  bucket.input += usage.inputTokens ?? 0
  bucket.cacheRead += usage.cacheReadTokens ?? 0
  bucket.cacheWrite += usage.cacheWriteTokens ?? 0
  bucket.output += usage.outputTokens ?? 0
  bucket.reasoning += usage.reasoningTokens ?? 0
}

/** Cost (USD) of one token bucket under a price row (USD / 1M tokens). */
function costOf(bucket, price) {
  if (price === undefined) return null
  return (
    (bucket.input * price.input + bucket.cacheRead * price.cacheRead
      + bucket.cacheWrite * price.cacheWrite + bucket.output * price.output) / 1_000_000
  )
}

/** Local calendar day key (YYYY-MM-DD) for an epoch-ms timestamp. */
function dayKeyOf(timeMs) {
  const d = new Date(timeMs)
  const two = v => (v < 10 ? '0' : '') + v
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** Fresh per-session fold entry. */
function newEntry() {
  return {
    lastSeq: 0, requests: 0, tokens: { ...ZERO_TOKENS },
    byModel: {}, byDayModel: {}, byHourModel: {}, tools: {},
    firstTime: null, lastTime: null, title: '',
  }
}

/** Local hour key (YYYY-MM-DD HH) for an epoch-ms timestamp. */
function hourKeyOf(timeMs) {
  const d = new Date(timeMs)
  const two = v => (v < 10 ? '0' : '') + v
  return `${dayKeyOf(timeMs)} ${two(d.getHours())}`
}

/** Ensure a matrix cell exists and returns it ({classes..., calls}). */
function cellOf(matrix, key, model) {
  const cellRow = matrix[key] ?? {}
  const cell = cellRow[model] ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, calls: 0 }
  cellRow[model] = cell
  matrix[key] = cellRow
  return cell
}

/** Validate a cached entry's shape; false when corrupt (caller refolds). */
function validEntry(entry) {
  return entry !== null && typeof entry === 'object'
    && typeof entry.lastSeq === 'number' && typeof entry.requests === 'number'
    && entry.tokens !== null && typeof entry.tokens === 'object'
    && typeof entry.tokens.input === 'number'
}

/** Add day×model cells of one session into a global matrix (incl. calls). */
function mergeDayModel(globalMatrix, sessionMatrix) {
  for (const [day, models] of Object.entries(sessionMatrix ?? {})) {
    const dayCell = globalMatrix[day] ?? {}
    for (const [model, bucket] of Object.entries(models ?? {})) {
      const target = dayCell[model] ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, calls: 0 }
      for (const field of DAY_FIELDS) target[field] += bucket[field] ?? 0
      target.calls += bucket.calls ?? 0
      dayCell[model] = target
    }
    globalMatrix[day] = dayCell
  }
}

/** Merge tool counters of one session into a global table. */
function mergeTools(globalTools, sessionTools) {
  for (const [name, row] of Object.entries(sessionTools ?? {})) {
    const target = globalTools[name] ?? { calls: 0, lastTime: 0 }
    target.calls += row.calls ?? 0
    if ((row.lastTime ?? 0) > target.lastTime) target.lastTime = row.lastTime
    globalTools[name] = target
  }
}

/**
 * Rescan every persisted session incrementally and return the aggregated
 * usage report, optionally narrowed to [startDay, endDay] day keys
 * (inclusive, YYYY-MM-DD). Token tables and the daily series follow the
 * range; request counts and tool counts stay all-time (labeled in the UI).
 */
export async function scanUsage(ctx, { forceRescan = false, startDay = '', endDay = '', granularity = 'auto' } = {}) {
  // Prefer the STORAGE service (always mounted); the query service's corpus
  // link depends on service-activation timing a sibling context may lose.
  const persistence = ctx.get('sessionPersistence')
  const sessionQuery = ctx.get('sessionQuery')
  const listAll = persistence !== undefined && typeof persistence.list === 'function'
    ? async () => (await persistence.list()).map(header => ({ header }))
    : sessionQuery !== undefined && typeof sessionQuery.listSessions === 'function'
      ? () => sessionQuery.listSessions()
      : null
  const readFrom = persistence !== undefined && typeof persistence.readFrom === 'function'
    ? (id, fromSeq) => persistence.readFrom(id, fromSeq)
    : sessionQuery !== undefined && typeof sessionQuery.readFrom === 'function'
      ? (id, fromSeq) => sessionQuery.readFrom(id, fromSeq)
      : null
  if (listAll === null || readFrom === null) {
    throw new Error('dsh-base-plugin: no session storage service available (sessionPersistence/sessionQuery)')
  }
  const cache = loadCache()
  if (forceRescan === true) {
    cache.sessions = {}
    cache.ledger = newLedger()
  }

  const liveIds = new Set()
  const records = await listAll()

  for (const record of records) {
    const sessionId = record?.header?.id
    if (typeof sessionId !== 'string' || sessionId === '') continue
    liveIds.add(sessionId)
    let prev = cache.sessions[sessionId]
    if (prev !== undefined && !validEntry(prev)) {
      delete cache.sessions[sessionId]
      prev = undefined
    }
    const fromSeq = prev !== undefined ? prev.lastSeq + 1 : 0

    let events
    try {
      const page = await readFrom(sessionId, fromSeq)
      events = page?.events ?? []
    } catch {
      continue // unreadable log: keep the previous fold, skip this round
    }
    if (events.length === 0) continue

    const entry = prev ?? newEntry()
    entry.byModel ??= {}
    entry.byDayModel ??= {}
    entry.byHourModel ??= {}
    entry.tools ??= {}
    entry.title = typeof record.header.title === 'string' ? record.header.title : ''

    let currentKey = null
    for (const event of events) {
      if (event.type === 'request/header') {
        currentKey = modelKeyOf(event.data?.header)
      } else if (event.type === 'tool/call') {
        const name = event.data?.name
        if (typeof name === 'string' && name !== '') {
          const tool = entry.tools[name] ?? { calls: 0, lastTime: 0 }
          tool.calls += 1
          tool.lastTime = event.time
          entry.tools[name] = tool
          const ledgerTool = cache.ledger.tools[name] ?? { calls: 0, lastTime: 0 }
          ledgerTool.calls += 1
          ledgerTool.lastTime = event.time
          cache.ledger.tools[name] = ledgerTool
        }
      } else if (event.type === 'assistant/message') {
        const usage = event.data?.usage
        if (usage === null || typeof usage !== 'object') continue
        const key = currentKey ?? 'unknown/unknown'
        // Session detail fold...
        const bucket = entry.byModel[key] ?? { requests: 0, ...ZERO_TOKENS }
        addUsage(bucket, usage)
        bucket.requests += 1
        entry.byModel[key] = bucket
        addUsage(entry.tokens, usage)
        entry.requests += 1
        const dayCell = cellOf(entry.byDayModel, dayKeyOf(event.time), key)
        const hourCell = cellOf(entry.byHourModel, hourKeyOf(event.time), key)
        for (const cell of [dayCell, hourCell]) {
          cell.input += usage.inputTokens ?? 0
          cell.cacheRead += usage.cacheReadTokens ?? 0
          cell.cacheWrite += usage.cacheWriteTokens ?? 0
          cell.output += usage.outputTokens ?? 0
          cell.calls += 1
        }
        // ...and the SAME event into the append-only ledger (never undone).
        const ledgerBucket = cache.ledger.byModel[key] ?? { requests: 0, ...ZERO_TOKENS }
        addUsage(ledgerBucket, usage)
        ledgerBucket.requests += 1
        cache.ledger.byModel[key] = ledgerBucket
        const ledgerDay = cellOf(cache.ledger.byDayModel, dayKeyOf(event.time), key)
        const ledgerHour = cellOf(cache.ledger.byHourModel, hourKeyOf(event.time), key)
        for (const cell of [ledgerDay, ledgerHour]) {
          cell.input += usage.inputTokens ?? 0
          cell.cacheRead += usage.cacheReadTokens ?? 0
          cell.cacheWrite += usage.cacheWriteTokens ?? 0
          cell.output += usage.outputTokens ?? 0
          cell.calls += 1
        }
        if (entry.firstTime === null) entry.firstTime = event.time
        entry.lastTime = event.time
      }
      entry.lastSeq = event.seq
    }
    cache.sessions[sessionId] = entry
  }

  // Drop vanished sessions (deleted/archived logs).
  for (const sessionId of Object.keys(cache.sessions)) {
    if (!liveIds.has(sessionId)) delete cache.sessions[sessionId]
  }

  // Global tables come from the APPEND-ONLY LEDGER: deleting a session
  // removes its top-sessions detail below, but its booked usage stays —
  // the trend/summary/models keep bill semantics, not disk-state semantics.
  const byModel = cache.ledger.byModel ?? {}
  const tools = cache.ledger.tools ?? {}
  const matrix = {}
  for (const [day, models] of Object.entries(cache.ledger.byDayModel ?? {})) {
    if (startDay !== '' && day < startDay) continue
    if (endDay !== '' && day > endDay) continue
    mergeDayModel(matrix, { [day]: models })
  }

  saveCache(cache)

  // ── aligned time series (the trend chart) ─────────────────────────────
  // Granularity: hourly when explicitly chosen, or auto for explicit ranges
  // spanning ≤ 7 days (a 7d window reads hourly, like a 30d one reads daily).
  // Longer windows force daily; hourly beyond 7d would be a 168+ bar mess.
  const dayMs = 86400000
  let spanDays = 0
  const explicitRange = startDay !== '' && endDay !== ''
  if (explicitRange) {
    spanDays = Math.round((Date.parse(endDay) - Date.parse(startDay)) / dayMs) + 1
  }
  const hourly = granularity === 'hourly' || (granularity === 'auto' && explicitRange && spanDays >= 1 && spanDays <= 7)

  // Collect the raw matrix for the chosen granularity, narrowed by range.
  const rawMatrix = {}
  if (hourly) {
    for (const [hourKey, models] of Object.entries(cache.ledger.byHourModel ?? {})) {
      const dayPart = hourKey.slice(0, 10)
      if (startDay !== '' && dayPart < startDay) continue
      if (endDay !== '' && dayPart > endDay) continue
      for (const [model, cell] of Object.entries(models ?? {})) {
        const target = cellOf(rawMatrix, hourKey, model)
        for (const field of DAY_FIELDS) target[field] += cell[field] ?? 0
        target.calls += cell.calls ?? 0
      }
    }
  } else {
    for (const [day, models] of Object.entries(matrix)) {
      for (const [model, cell] of Object.entries(models)) {
        const target = cellOf(rawMatrix, day, model)
        for (const field of DAY_FIELDS) target[field] += cell[field] ?? 0
        target.calls += cell.calls ?? 0
      }
    }
  }

  // Enumerate a CONTINUOUS axis (zero-filled like the reference UI): explicit
  // ranges enumerate every bucket in [start, end]; without bounds the axis
  // spans observed keys only. Capped to keep the payload sane.
  const axis = []
  if (hourly && explicitRange) {
    const hourMs = 3600000
    // align to the local day start of startDay (local timezone)
    const [sy, sm, sd] = startDay.split('-').map(Number)
    let t = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime()
    const endT = Date.parse(endDay) + dayMs - 1
    for (; t <= endT; t += hourMs) {
      const d = new Date(t)
      const two = v => (v < 10 ? '0' : '') + v
      axis.push(`${dayKeyOf(t)} ${two(d.getHours())}`)
      if (axis.length > 200) break
    }
  } else if (explicitRange) {
    let t = Date.parse(startDay)
    const endT = Date.parse(endDay)
    for (; t <= endT; t += dayMs) {
      axis.push(dayKeyOf(t))
      if (axis.length > 92) break
    }
  } else {
    axis.push(...Object.keys(rawMatrix).sort())
    if (axis.length > 92) axis.splice(0, axis.length - 92)
  }

  // Per-model aligned series (models ordered by range total, desc).
  const seriesTotals = {}
  for (const models of Object.values(rawMatrix)) {
    for (const [model, cell] of Object.entries(models)) {
      const total = seriesTotals[model] ?? { tokens: 0, calls: 0 }
      total.tokens += cell.input + cell.cacheRead + cell.cacheWrite + cell.output
      total.calls += cell.calls ?? 0
      seriesTotals[model] = total
    }
  }
  const orderedModels = Object.entries(seriesTotals)
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .map(([model]) => model)
  const modelCells = new Map()
  for (const model of orderedModels) {
    const values = axis.map(label => {
      const cell = rawMatrix[label]?.[model]
      return cell === undefined
        ? { tokens: 0, calls: 0 }
        : { tokens: cell.input + cell.cacheRead + cell.cacheWrite + cell.output, calls: cell.calls ?? 0 }
    })
    modelCells.set(model, values)
  }
  const series = {
    granularity: hourly ? 'hourly' : 'daily',
    xTime: axis,
    buckets: axis.map((label, idx) => {
      let tokens = 0
      let calls = 0
      for (const model of orderedModels) {
        tokens += modelCells.get(model)[idx].tokens
        calls += modelCells.get(model)[idx].calls
      }
      return { label, tokens, calls }
    }),
    models: orderedModels.map(model => ({
      model,
      total: seriesTotals[model].tokens,
      totalCalls: seriesTotals[model].calls,
      values: modelCells.get(model).map(v => v.tokens),
      calls: modelCells.get(model).map(v => v.calls),
    })),
  }

  // Range-scoped model rows come from the matrix so the filter holds exactly.
  const rangeByModel = {}
  for (const models of Object.values(matrix)) {
    for (const [model, cell] of Object.entries(models)) {
      const target = rangeByModel[model] ?? { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
      for (const field of DAY_FIELDS) target[field] += cell[field] ?? 0
      rangeByModel[model] = target
    }
  }
  const modelRows = Object.entries(rangeByModel)
    .map(([key, cell]) => ({
      model: key,
      requests: byModel[key]?.requests ?? 0,
      ...cell,
      cost: costOf(cell, cache.prices[key]),
    }))
    .sort((a, b) => (b.input + b.cacheRead + b.cacheWrite + b.output) - (a.input + a.cacheRead + a.cacheWrite + a.output))

  const totals = { requests: 0, ...ZERO_TOKENS }
  for (const bucket of Object.values(byModel)) totals.requests += bucket.requests ?? 0
  for (const row of modelRows) {
    totals.input += row.input
    totals.cacheRead += row.cacheRead
    totals.cacheWrite += row.cacheWrite
    totals.output += row.output
  }
  const allReasoning = Object.values(byModel).reduce((sum, b) => sum + (b.reasoning ?? 0), 0)
  totals.reasoning = allReasoning

  const days = Object.entries(matrix)
    .map(([day, models]) => {
      let total = 0
      const perModel = Object.entries(models)
        .map(([model, cell]) => {
          const tokens = cell.input + cell.cacheRead + cell.cacheWrite + cell.output
          total += tokens
          return { model, tokens }
        })
        .sort((a, b) => b.tokens - a.tokens)
      return { day, tokens: total, models: perModel }
    })
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-62)

  const topSessions = Object.entries(cache.sessions)
    .filter(([, entry]) => entry.requests > 0)
    .map(([id, entry]) => ({
      sessionId: id,
      title: entry.title !== '' ? entry.title : id,
      requests: entry.requests,
      tokens: entry.tokens.input + entry.tokens.cacheRead + entry.tokens.cacheWrite + entry.tokens.output,
      lastTime: entry.lastTime,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)

  const toolRows = Object.entries(tools)
    .map(([name, row]) => ({ name, calls: row.calls, lastTime: row.lastTime }))
    .sort((a, b) => b.calls - a.calls)

  return {
    totals,
    totalsCost: modelRows.reduce((sum, row) => sum + (row.cost ?? 0), 0),
    anyUnpriced: modelRows.some(row => row.cost === null),
    byModel: modelRows,
    byDay: days,
    series,
    tools: toolRows,
    topSessions,
    prices: cache.prices,
    sessionCount: Object.keys(cache.sessions).length,
    range: { start: startDay, end: endDay },
  }
}

/** Persist an edited price table (USD / 1M tokens). */
export function savePrices(prices) {
  if (prices === null || typeof prices !== 'object' || Array.isArray(prices)) {
    throw new Error('dsh-base-plugin: prices must be an object')
  }
  const clean = {}
  for (const [key, value] of Object.entries(prices)) {
    if (value === null || typeof value !== 'object') continue
    const row = {}
    for (const field of ['input', 'cacheRead', 'cacheWrite', 'output']) {
      const num = Number(value[field])
      row[field] = Number.isFinite(num) && num >= 0 ? num : 0
    }
    clean[key] = row
  }
  const cache = loadCache()
  cache.prices = mergePrices(clean)
  saveCache(cache)
  return cache.prices
}
