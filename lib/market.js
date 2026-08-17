/**
 * dsh-base-plugin — GitHub market search.
 *
 * Searches GitHub for `dsh` repositories through the Search API (5-minute
 * cache per query+sort, optional GITHUB_TOKEN for rate limits). Ordering:
 * `stars`/`updated` come from GitHub directly; `name` sorts alphabetically;
 * `default` applies the ecosystem tier ranking (real `dsh-` plugins first,
 * coincidental prefixes like "Dshell" sink).
 * @module dsh-base-plugin/lib/market
 */

const marketCache = new Map() // `q::sort` → { at, payload }
const MARKET_TTL_MS = 5 * 60 * 1000
/** Bounded cache: entries expire by TTL but the map itself is capped too. */
const MARKET_CACHE_MAX = 50

/** Recognized market sort modes (UI order labels live in the client half). */
const MARKET_SORTS = new Set(['default', 'stars', 'updated', 'name'])

/**
 * Search GitHub for dsh plugins; cached per query+sort for 5 minutes.
 * `stars`/`updated` fetch with GitHub's matching sort and return as-is;
 * `name` sorts alphabetically; `default` applies the ecosystem tier ranking.
 *
 * Query strategy (topic-first with name fallback):
 *  1. `<terms> topic:dsh-plugin topic:dsh` — ecosystem-certified hits only
 *     (authors who tagged the repo with the dsh topics). GitHub ANDs the
 *     qualifiers, so this is the precise set.
 *  2. If (1) returns nothing (the term is new, or the author never tagged
 *     the repo), retry with the legacy `<terms> dsh in:name` shape so the
 *     market doesn't go blind on untagged-but-real plugins; those rows are
 *     marked `match: "name"` so the UI can badge them as unverified.
 */
export async function marketSearch(terms, sort) {
  const mode = MARKET_SORTS.has(sort) ? sort : 'default'
  const trimmed = terms.trim()
  const queries = [
    { q: `${trimmed} topic:dsh-plugin topic:dsh`.trim(), match: 'topic' },
    { q: `${trimmed} dsh in:name`.trim(), match: 'name' },
  ]
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'dsh-base-plugin',
  }
  const token = process.env.GITHUB_TOKEN
  if (token !== undefined && token !== '') headers.authorization = `Bearer ${token}`

  const fetchItems = async (q, pushedSort) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', q)
    url.searchParams.set('sort', pushedSort)
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', '30')
    const response = await fetch(url, { headers })
    if (response.status === 403 || response.status === 429) {
      throw new Error('dsh-base-plugin: GitHub API rate limit reached — set GITHUB_TOKEN in the dsh process environment and restart dsh')
    }
    if (!response.ok) {
      throw new Error(`dsh-base-plugin: GitHub API ${response.status} ${response.statusText}`)
    }
    const data = await response.json()
    return Array.isArray(data.items) ? data.items : []
  }

  // Topic-first; the name query runs only when the topic set is empty.
  const pushedSort = mode === 'updated' ? 'updated' : 'stars'
  let raw = await fetchItems(queries[0].q, pushedSort)
  let matchKind = 'topic'
  let totalHint = raw.length
  if (raw.length === 0) {
    raw = await fetchItems(queries[1].q, pushedSort)
    matchKind = 'name'
    totalHint = raw.length
  }

  const mapped = raw.map(repo => ({
    name: repo.name,
    fullName: repo.full_name,
    description: typeof repo.description === 'string' ? repo.description : '',
    htmlUrl: repo.html_url,
    stars: repo.stargazers_count ?? 0,
    updatedAt: repo.pushed_at ?? repo.updated_at ?? '',
    defaultBranch: repo.default_branch ?? 'main',
    installSpec: `${repo.name}@github:${repo.full_name}`,
    match: matchKind,
  }))
  // Order per the requested mode:
  // - stars/updated: GitHub already returned them in that order.
  // - name: alphabetical.
  // - default: ecosystem tiers first — exact `dsh` or `dsh-`/`dsh_` prefix
  //   (the ecosystem convention), then dsh-plugin/deepseek mentions, then
  //   coincidental prefixes — each tier keeps GitHub's stars order, so
  //   near-misses like "Dshell" (network forensics) sink below real plugins.
  const rankOf = (repoName) => {
    const n = repoName.toLowerCase()
    if (n === 'dsh' || n.startsWith('dsh-') || n.startsWith('dsh_')) return 0
    if (n.includes('dsh-plugin') || n.includes('dsh_plugin') || n.includes('deepseek')) return 1
    if (n.startsWith('dsh')) return 2
    return 3
  }
  const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  const items = mode === 'default'
    ? [...mapped].sort((a, b) => rankOf(a.name) - rankOf(b.name))
    : mode === 'name'
      ? [...mapped].sort(byName)
      : mapped
  const payload = {
    total: totalHint || items.length,
    match: matchKind, // 'topic' (certified) | 'name' (fallback, unverified)
    items,
    sort: mode,
    hasToken: token !== undefined && token !== '',
  }
  const cacheKey = `${trimmed}::${mode}`
  if (marketCache.size >= MARKET_CACHE_MAX) {
    // Evict the oldest entry (insertion order ≈ oldest query).
    marketCache.delete(marketCache.keys().next().value)
  }
  marketCache.set(cacheKey, { at: Date.now(), payload })
  return { ...payload, cached: false }
}
