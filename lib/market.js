/**
 * dsh-base-plugin — GitHub market search.
 *
 * Searches GitHub for dsh plugins through the Search API (5-minute cache
 * per query+sort, optional GITHUB_TOKEN for rate limits). Ordering:
 * `stars`/`updated` come from GitHub directly; `name` sorts alphabetically;
 * `default` applies the ecosystem tier ranking (real `dsh-` plugins first,
 * coincidental prefixes like "Dshell" sink).
 *
 * Query strategy (v0.5.1 — discovery-first):
 *  A. CERTIFIED SET (query-independent, cached on its own longer TTL):
 *     `topic:dsh-plugin dsh in:name` — the ecosystem-certified browse set:
 *     topic-tagged repos whose name mentions dsh. Kills topic-squatters
 *     (reactive-resume et al.) while covering every topic-variant author
 *     (dsh-plugin / deepseek-harness-plugin / …).
 *  B. TERM SET (per user input): `<terms> topic:dsh-plugin dsh in:name`.
 *  C. LOCAL SOFT MATCH: user terms also match against name+description of
 *     the certified set client-side — a plugin whose description lacks the
 *     literal term can still surface via the browse set instead of the whole
 *     tier vanishing (the AND-term false-negative that hid real plugins).
 *  D. NAME FALLBACK: only when both B and C are empty, the legacy
 *     `<terms> dsh in:name` shape runs so untagged-but-real plugins stay
 *     findable; those rows are marked `match: "name"` (no badge).
 *
 * Merged order under `default`: B (term hits) → C (local matches) — each
 * tier internally ranked by the ecosystem prefix heuristic, GitHub's stars
 * preserved inside a tier.
 * @module dsh-base-plugin/lib/market
 */

const marketCache = new Map() // `q::sort` → { at, payload }
const MARKET_TTL_MS = 5 * 60 * 1000
/** Bounded cache: entries expire by TTL but the map itself is capped too. */
const MARKET_CACHE_MAX = 50
/** The certified browse set is query-independent — cache it longer. */
const BARE_KEY = '::certified-set::'
const BARE_TTL_MS = 10 * 60 * 1000
const BARE_PER_PAGE = 100

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

/** Local soft match: every whitespace-separated token must appear in the
 *  repo's name or description (case-insensitive substring). */
const softMatch = (repo, tokens) => {
  if (tokens.length === 0) return false
  const hay = `${repo.name} ${repo.description}`.toLowerCase()
  return tokens.every(token => hay.includes(token))
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

/**
 * Search GitHub for dsh plugins. See the module comment for the full
 * strategy; briefly: certified-set browse + term query in parallel, local
 * soft matching, name-shape fallback only when both miss.
 */
export async function marketSearch(terms, sort) {
  const mode = MARKET_SORTS.has(sort) ? sort : 'default'
  const trimmed = terms.trim()
  const tokens = trimmed === '' ? [] : trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'dsh-base-plugin',
  }
  const token = process.env.GITHUB_TOKEN
  if (token !== undefined && token !== '') headers.authorization = `Bearer ${token}`
  const hasToken = token !== undefined && token !== ''
  const pushedSort = mode === 'updated' ? 'updated' : 'stars'

  const fetchItems = async (q, pushed, perPage) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', q)
    url.searchParams.set('sort', pushed)
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

  const readCache = (key, ttl) => {
    const hit = marketCache.get(key)
    if (hit !== undefined && Date.now() - hit.at < ttl) return hit.payload
    return undefined
  }
  const writeCache = (key, payload) => {
    if (marketCache.size >= MARKET_CACHE_MAX) {
      // Evict the oldest entry (insertion order ≈ oldest query).
      marketCache.delete(marketCache.keys().next().value)
    }
    marketCache.set(key, { at: Date.now(), payload })
  }

  const certify = q => `${q} topic:dsh-plugin dsh in:name`.trim()
  const BARE_Q = certify('')

  // Empty search: the certified browse set IS the answer (one call).
  if (tokens.length === 0) {
    const cached = readCache(BARE_KEY, BARE_TTL_MS)
    if (cached !== undefined) return { ...cached, cached: true }
    const { items, total } = await fetchItems(BARE_Q, pushedSort, BARE_PER_PAGE)
    const payload = { total, match: 'topic', items: items.map(r => mapRepo(r, 'topic')), sort: mode, hasToken }
    writeCache(BARE_KEY, payload)
    return { ...payload, cached: false }
  }

  const cacheKey = `${trimmed}::${mode}`
  const cached = readCache(cacheKey, MARKET_TTL_MS)
  if (cached !== undefined) return { ...cached, cached: true }

  // Term set + certified set in parallel (each may come from cache).
  const termP = fetchItems(certify(trimmed), pushedSort, 30).catch(() => ({ items: [], total: 0 }))
  let bare = readCache(BARE_KEY, BARE_TTL_MS)
  const bareP = bare !== undefined ? null : fetchItems(BARE_Q, pushedSort, BARE_PER_PAGE).catch(() => ({ items: [], total: 0 }))
  const [termSet, bareSet] = await Promise.all([termP, bareP])
  if (bare === undefined) {
    bare = { total: bareSet.total, items: bareSet.items.map(r => mapRepo(r, 'topic')) }
    writeCache(BARE_KEY, bare)
  }

  // Tier 1: GitHub term hits. Tier 2: certified-set local soft matches the
  // term query missed (cross-wording, partial descriptions, star-tail).
  const seen = new Set()
  const tier1 = termSet.items.map(r => mapRepo(r, 'topic'))
  for (const it of tier1) seen.add(it.fullName)
  const tier2 = bare.items
    .filter(r => !seen.has(r.fullName) && softMatch(r, tokens))
    .map(r => ({ ...r, match: 'topic' }))

  let items
  let match = 'topic'
  let total = termSet.total || tier1.length + tier2.length
  if (tier1.length + tier2.length === 0) {
    // Nothing certified matches the term — legacy name shape so untagged
    // real plugins stay findable.
    const fallback = await fetchItems(`${trimmed} dsh in:name`.trim(), pushedSort, 30).catch(() => ({ items: [], total: 0 }))
    items = fallback.items.map(r => mapRepo(r, 'name'))
    match = 'name'
    total = fallback.total || items.length
  } else {
    items = [...tier1, ...tier2]
  }

  // Order per the requested mode:
  // - stars/updated: GitHub already returned them in that order.
  // - name: alphabetical.
  // - default: ecosystem tiers first — exact `dsh` or `dsh-`/`dsh_` prefix
  //   (the ecosystem convention), then dsh-plugin/deepseek mentions, then
  //   coincidental prefixes — each tier keeps GitHub's stars order, so
  //   near-misses like "Dshell" (network forensics) sink below real plugins.
  const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  const ordered = mode === 'default'
    ? [...items].sort((a, b) => rankOf(a.name) - rankOf(b.name))
    : mode === 'name'
      ? [...items].sort(byName)
      : items

  const payload = { total, match, items: ordered, sort: mode, hasToken }
  writeCache(cacheKey, payload)
  return { ...payload, cached: false }
}
