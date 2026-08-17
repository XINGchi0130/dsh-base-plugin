/**
 * dsh-base-plugin — GitHub market search.
 *
 * Searches GitHub for dsh plugins through the Search API (5-minute cache
 * per query+sort, optional GITHUB_TOKEN for rate limits). Ordering:
 * `stars`/`updated` come from GitHub directly; `name` sorts alphabetically;
 * `default` applies the ecosystem tier ranking (real `dsh-` plugins first,
 * coincidental prefixes like "Dshell" sink).
 *
 * Query strategy (v0.5.2 — discovery-first):
 *  A. CERTIFIED SET (query-independent, cached PER SORT MODE on its own
 *     longer TTL): `topic:dsh-plugin dsh in:name` — the ecosystem-certified
 *     browse set: topic-tagged repos whose name mentions dsh. Kills
 *     topic-squatters (reactive-resume et al.) while covering every
 *     topic-variant author (dsh-plugin / deepseek-harness-plugin / …).
 *  B. TERM SET (per user input): `<terms> topic:dsh-plugin dsh in:name`.
 *  C. LOCAL SOFT MATCH: user terms also match against name+description of
 *     the certified set client-side — a plugin whose description lacks the
 *     literal term can still surface via the browse set instead of the whole
 *     tier vanishing (the AND-term false-negative that hid real plugins).
 *  D. NAME FALLBACK: only when both B and C are empty, the legacy
 *     `<terms> dsh in:name` shape runs so untagged-but-real plugins stay
 *     findable; those rows are marked `match: "name"` (no badge).
 *
 * Robustness (v0.5.2):
 *  - Remote sources are merged best-effort, but a failure is never turned
 *    into a silent "no results" page: when nothing at all can be shown, the
 *    first failure (e.g. the actionable rate-limit hint) is rethrown.
 *  - A failed fetch never enters a cache — a transient 403 must not poison
 *    the certified set for ten minutes.
 *  - Concurrent identical lookups share one in-flight request: the
 *    unauthenticated GitHub search budget is only 10 req/min.
 *  - The certified cache stores the RAW mapped set; response-level fields
 *    (sort/hasToken) are attached fresh per call, and the key carries the
 *    sort mode — a stars-ordered set can never leak into an updated-sort
 *    response, and a token added mid-process is reflected immediately.
 *
 * Merged order under `default`: B (term hits) → C (local matches) — each
 * tier internally ranked by the ecosystem prefix heuristic, GitHub's stars
 * preserved inside a tier.
 *
 * @module dsh-base-plugin/lib/market
 */

const marketCache = new Map() // key → { at, ttl, payload }
const MARKET_TTL_MS = 5 * 60 * 1000
/** Bounded cache: entries expire by TTL but the map itself is capped too. */
const MARKET_CACHE_MAX = 50
/** The certified browse set is query-independent — cache it longer. */
const BARE_TTL_MS = 10 * 60 * 1000
const BARE_PER_PAGE = 100
const TERM_PER_PAGE = 30

/** Recognized market sort modes (UI order labels live in the client half). */
const MARKET_SORTS = new Set(['default', 'stars', 'updated', 'name'])

/** Ecosystem tier: exact/prefixed `dsh` names first, coincidental sinks. */
const rankOf = (repoName) => {
  const n = repoName.toLowerCase()
  if (n === 'dsh' || n.startsWith('dsh-') || n.startsWith('dsh_')) return 0
  if (n.includes('dsh-plugin') || n.includes('dsh_plugin') || n.includes('deepseek')) return 1
  if (n.startsWith('dsh')) return 2
  return 3
}

const mapRepo = (repo, match) => ({
  name: repo.name,
  fullName: repo.full_name,
  description: typeof repo.description === 'string' ? repo.description : '',
  htmlUrl: repo.html_url,
  stars: repo.stargazers_count ?? 0,
  updatedAt: repo.pushed_at ?? repo.updated_at ?? '',
  defaultBranch: repo.default_branch ?? 'main',
  installSpec: `${repo.name}@github:${repo.full_name}`,
  match,
})

/** Lowercase soft-match haystack for one mapped repo. */
const hayOf = repo => `${repo.name} ${repo.description}`.toLowerCase()

/** Local soft match: every whitespace-separated token must appear in the
 *  precomputed haystack (case-insensitive substring). */
const softMatch = (hay, tokens) => tokens.every(token => hay.includes(token))

// ── cache: TTL with LRU eviction, per-entry TTL ───────────────────────────

function readCache(key) {
  const hit = marketCache.get(key)
  if (hit === undefined) return undefined
  if (Date.now() - hit.at >= hit.ttl) {
    marketCache.delete(key)
    return undefined
  }
  // Refresh recency so the size cap evicts the least-recently-USED entry.
  marketCache.delete(key)
  marketCache.set(key, hit)
  return hit.payload
}

function writeCache(key, ttl, payload) {
  const now = Date.now()
  // Purge already-expired entries first so the cap never drops live data
  // to make room for stale entries, and drop a same-key overwrite before
  // the cap check so refreshing one entry cannot evict another.
  marketCache.delete(key)
  for (const [key_, entry] of marketCache) {
    if (now - entry.at >= entry.ttl) marketCache.delete(key_)
  }
  while (marketCache.size >= MARKET_CACHE_MAX) {
    marketCache.delete(marketCache.keys().next().value)
  }
  marketCache.set(key, { at: now, ttl, payload })
}

// ── single-flight: concurrent identical lookups share one request ─────────

const inflight = new Map()

function singleFlight(key, run) {
  const existing = inflight.get(key)
  if (existing !== undefined) return existing
  const started = run().finally(() => { inflight.delete(key) })
  inflight.set(key, started)
  return started
}

const asError = error => error instanceof Error ? error : new Error(String(error))

/**
 * Search GitHub for dsh plugins. See the module comment for the full
 * strategy; briefly: certified-set browse + term query in parallel, local
 * soft matching, name-shape fallback only when both miss.
 */
export async function marketSearch(terms, sort) {
  const mode = MARKET_SORTS.has(sort) ? sort : 'default'
  const trimmed = terms.trim()
  const tokens = trimmed === '' ? [] : trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  const token = process.env.GITHUB_TOKEN
  const hasToken = token !== undefined && token !== ''
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'dsh-base-plugin',
    ...(hasToken ? { authorization: `Bearer ${token}` } : {}),
  }
  // GitHub-side sort: `name`/`default` have no GitHub counterpart, so both
  // fetch by stars and reorder locally.
  const pushedSort = mode === 'updated' ? 'updated' : 'stars'
  const certify = q => `${q} topic:dsh-plugin dsh in:name`.trim()
  const BARE_Q = certify('')

  const fetchItems = async (q, perPage) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', q)
    url.searchParams.set('sort', pushedSort)
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', String(perPage))
    const response = await fetch(url, { headers })
    if (response.status === 403 || response.status === 429) {
      throw new Error('dsh-base-plugin: GitHub API rate limit reached — set GITHUB_TOKEN in the dsh process environment and restart dsh')
    }
    if (!response.ok) {
      throw new Error(`dsh-base-plugin: GitHub API ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return { items: Array.isArray(data.items) ? data.items : [], total: data.total_count ?? 0 }
  }

  /** First remote failure of THIS call. Rethrown only when the merged
   *  result ends up empty: partial results never mask a total outage, and
   *  an outage never renders as a silent "no results" page. */
  let firstError = null
  const bestEffort = promise => promise.then(
    value => ({ ok: true, ...value }),
    error => {
      if (firstError === null) firstError = asError(error)
      return { ok: false, items: [], total: 0 }
    },
  )

  /** The certified browse set for the current sort mode, from cache or one
   *  shared in-flight request. Only successful fetches are cached; the
   *  carried `error` (never cached) lets concurrent borrowers of a failed
   *  shared flight record the failure in their own right. */
  const loadBare = () => {
    const key = `bare::${pushedSort}`
    const cached = readCache(key)
    if (cached !== undefined) return Promise.resolve({ ...cached, fromCache: true })
    return singleFlight(key, async () => {
      let failure = null
      const got = await fetchItems(BARE_Q, BARE_PER_PAGE).then(
        value => ({ ok: true, ...value }),
        error => { failure = asError(error); return { ok: false } },
      )
      if (!got.ok) return { total: 0, items: [], hay: [], fromCache: false, error: failure }
      const items = got.items.map(r => mapRepo(r, 'topic'))
      const payload = { total: got.total, items, hay: items.map(hayOf) }
      writeCache(key, BARE_TTL_MS, payload)
      return { ...payload, fromCache: false }
    })
  }
  const adoptBareError = (bare) => {
    if (bare.error !== undefined && firstError === null) firstError = bare.error
  }

  /** Apply the requested display order. `default` ranks ecosystem tiers and
   *  `name` sorts alphabetically on EVERY path — including the empty-search
   *  browse — while stars/updated keep GitHub's returned order. */
  const orderItems = items => mode === 'default'
    ? [...items].sort((a, b) => rankOf(a.name) - rankOf(b.name))
    : mode === 'name'
      ? [...items].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      : items

  // Empty search: the certified browse set IS the answer (one call).
  if (tokens.length === 0) {
    const bare = await loadBare()
    adoptBareError(bare)
    if (bare.items.length === 0 && firstError !== null) throw firstError
    return {
      total: bare.total,
      match: 'topic',
      items: orderItems(bare.items),
      sort: mode,
      hasToken,
      cached: bare.fromCache,
    }
  }

  return singleFlight(`search::${trimmed}::${mode}`, async () => {
    const cacheKey = `${trimmed}::${mode}`
    const cached = readCache(cacheKey)
    if (cached !== undefined) return { ...cached, hasToken, cached: true }

    // Term set + certified set in parallel (each may come from cache or a
    // shared in-flight request).
    const [termSet, bare] = await Promise.all([
      bestEffort(fetchItems(certify(trimmed), TERM_PER_PAGE)),
      loadBare(),
    ])
    adoptBareError(bare)

    // Tier 1: GitHub term hits. Tier 2: certified-set local soft matches the
    // term query missed (cross-wording, partial descriptions, star-tail) —
    // soft matching reads the precomputed haystacks, not fresh strings.
    const seen = new Set()
    const tier1 = termSet.ok ? termSet.items.map(r => mapRepo(r, 'topic')) : []
    for (const it of tier1) seen.add(it.fullName)
    const tier2 = bare.items.filter((repo, i) => !seen.has(repo.fullName) && softMatch(bare.hay[i], tokens))

    let items
    let match = 'topic'
    let total = termSet.ok && termSet.total > 0 ? termSet.total : tier1.length + tier2.length
    if (tier1.length + tier2.length === 0) {
      // Nothing certified matches the term — legacy name shape so untagged
      // real plugins stay findable.
      const fallback = await bestEffort(fetchItems(`${trimmed} dsh in:name`.trim(), TERM_PER_PAGE))
      items = fallback.ok ? fallback.items.map(r => mapRepo(r, 'name')) : []
      match = 'name'
      total = fallback.ok && fallback.total > 0 ? fallback.total : items.length
    } else {
      items = [...tier1, ...tier2]
    }

    // Nothing showable from any source → surface the actionable failure
    // (rate limit, network) instead of a silent empty page.
    if (items.length === 0 && firstError !== null) throw firstError

    // Response-level fields with fresh values are attached on every return;
    // only the mode-stable result body is cached.
    const payload = { total, match, items: orderItems(items), sort: mode }
    writeCache(cacheKey, MARKET_TTL_MS, payload)
    return { ...payload, hasToken, cached: false }
  })
}
