/**
 * dsh-base-plugin —— 会话全文搜索（会话设置页的数据面）。
 *
 * 现有会话页只按标题/元数据筛选；本模块在持久化日志（官方
 * `sessionPersistence.readFrom` 分页事件流）上做跨会话全文匹配：
 * 只搜用户/助手消息文本（工具噪声不搜），空格分词全 AND、大小写不敏感。
 *
 * 有界性（全部防失控）：最多扫 MAX_SESSIONS 个会话、累计 MAX_MATCHES 条
 * 命中、单会话最多 MAX_PAGES 页事件、总时长 TIME_BUDGET_MS——任一触顶
 * 即返回并标记 truncated，前端明示"结果不完整"。
 *
 * @module dsh-base-plugin/lib/search
 */

const MAX_SESSIONS = 200
const MAX_MATCHES = 200
const MAX_PAGES = 200
const TIME_BUDGET_MS = 8000
const SNIPPET_RADIUS = 60

/** 从 content blocks 提取纯文本（与 export.js 的 blocksToText 同思路，轻量版）。 */
function blocksToText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    if (typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n')
}

/** 多词 AND 匹配：返回首个命中位置（无则 -1）。 */
function matchAll(text, lowerTerms) {
  let at = -1
  for (const term of lowerTerms) {
    const hit = text.indexOf(term)
    if (hit === -1) return -1
    if (at === -1 || hit < at) at = hit
  }
  return at
}

/**
 * 跨会话全文搜索。
 * @param {import('cordis').Context} ctx 插件 fiber 上下文。
 * @param {string} query 查询串（空格分词，全 AND）。
 * @param {import('./sessions.js').listSessions} listSessions 会话清单读取器。
 * @returns {Promise<{ query: string, terms: string[], sessionsScanned: number,
 *   truncated: boolean, matches: Array<{ id: string, title: string, turn: number,
 *   role: 'user'|'assistant', snippet: string, matchesInSession: number }> }>}
 */
export async function searchSessions(ctx, query, listSessions) {
  const terms = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  const empty = { query: String(query ?? ''), terms, sessionsScanned: 0, truncated: false, matches: [] }
  if (terms.length === 0) return empty
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }
  const inventory = await listSessions(ctx)
  // 活跃会话优先（最近的对话最可能要找），其次新创建在前。
  const items = [...inventory.items]
    .sort((a, b) => (Number(b.live) - Number(a.live)) || (Number(b.createdAt) - Number(a.createdAt)))
    .slice(0, MAX_SESSIONS)

  const matches = []
  const perSession = new Map()
  const deadline = Date.now() + TIME_BUDGET_MS
  let truncated = false
  let scanned = 0

  for (const item of items) {
    if (Date.now() > deadline) { truncated = true; break }
    scanned += 1
    let seq = 0
    let turn = 0
    let sessionMatches = 0
    try {
      for (let page = 0; ; page += 1) {
        if (page >= MAX_PAGES) {
          // 页数触顶但日志未到尾：该会话只被部分扫描，必须标记，
          // 否则结果"看起来完整"而实际漏了后半段。
          truncated = true
          break
        }
        if (Date.now() > deadline) { truncated = true; break }
        const result = await persistence.readFrom(item.id, seq)
        const events = result?.events ?? []
        if (events.length === 0) break
        for (const event of events) {
          const data = event.data ?? {}
          if (event.type === 'turn/start') {
            turn = typeof data.turn === 'number' ? data.turn : turn + 1
            continue
          }
          let role = ''
          let text = ''
          if (event.type === 'user/message') {
            // 注入上下文（skill/文件提示等）不搜：命中会淹没在系统噪声里。
            const kind = data.source?.kind
            if (kind !== undefined && kind !== 'user') continue
            role = 'user'
            text = blocksToText(data.content)
          } else if (event.type === 'assistant/message') {
            role = 'assistant'
            text = blocksToText(data.message?.content)
          } else {
            continue
          }
          if (text === '') continue
          const at = matchAll(text, terms)
          if (at === -1) continue
          sessionMatches += 1
          if (matches.length < MAX_MATCHES) {
            const start = Math.max(0, at - SNIPPET_RADIUS)
            matches.push({
              id: item.id,
              title: item.title,
              turn,
              role,
              snippet: `${start > 0 ? '…' : ''}${text.slice(start, at + SNIPPET_RADIUS).replace(/\s+/gu, ' ')}${at + SNIPPET_RADIUS < text.length ? '…' : ''}`,
              matchesInSession: 0,
            })
          } else {
            truncated = true
          }
        }
        // 与 export.js 同款终止条件：页空或 seq 不再前进即到日志尾。
        const next = (events[events.length - 1]?.seq ?? seq) + 1
        if (next <= seq) break
        seq = next
      }
    } catch {
      // 单会话读取失败（后端不支持/并发删除）：跳过该会话。
    }
    if (sessionMatches > 0) perSession.set(item.id, sessionMatches)
    if (matches.length >= MAX_MATCHES) { truncated = true; break }
  }
  for (const match of matches) match.matchesInSession = perSession.get(match.id) ?? 1
  return { query: String(query ?? ''), terms, sessionsScanned: scanned, truncated, matches }
}
