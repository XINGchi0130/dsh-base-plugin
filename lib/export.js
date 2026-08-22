/**
 * dsh-base-plugin — session export (the Sessions page's export data plane).
 *
 * Two formats:
 *  - ZIP: the OFFICIAL endpoint `GET /api/session.export?sessionId=…`
 *    (dsh-session-log-export: the durable log plus attachment artifacts).
 *    The plugin adds nothing — the client just opens the URL.
 *  - Markdown: THIS module folds the durable log into a readable transcript
 *    (user prompts, assistant replies with reasoning sections, tool calls
 *    paired with results by callId). Host-side fold so the browser never
 *    needs to page the whole log.
 *
 * Event shapes are the core SessionEventMap (verified against
 * packages/core/session/src/types.ts): user/message carries the UserMessage
 * directly (source.kind separates human prompts from injected context);
 * assistant/message wraps { message, usage?, interrupted? }; tool/call and
 * tool/result pair by callId.
 *
 * @module dsh-base-plugin/lib/export
 */

/** Per-field truncation for tool args/results (they can be enormous). */
const TOOL_TEXT_MAX = 2000
/** Whole-document bound — a transcript beyond this is truncated with a note. */
const DOC_MAX = 8 * 1024 * 1024

/** Clip one string for embedding, with a visible marker when clipped. */
function clip(text, max) {
  const s = String(text ?? '')
  return s.length <= max ? s : `${s.slice(0, max)}\n…(截断，共 ${s.length} 字符)`
}

/** Extract text-ish content from a ContentBlock array (text + reasoning + others summarized). */
function blocksToText(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  let images = 0
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block.type === 'reasoning' && typeof block.text === 'string' && block.text !== '') {
      parts.push(`<details>\n<summary>思考过程</summary>\n\n${block.text}\n\n</details>`)
    } else if (block.type === 'image') images += 1
    else if (block.type === 'tool-call') {
      parts.push(`\`\`\`json\n${clip(block.arguments, TOOL_TEXT_MAX)}\n\`\`\``)
    } else if (block.type === 'tool-result') {
      parts.push(blocksToText(block.content))
    } else if (typeof block.type === 'string') {
      parts.push(`\`[${block.type}]\``)
    }
  }
  if (images > 0) parts.push(`\`[${images} 张图片]\``)
  return parts.join('\n\n')
}

/** Filename-safe form of a session title. */
function safeName(title, id) {
  const base = typeof title === 'string' && title.trim() !== ''
    ? title.trim().replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60)
    : String(id ?? 'session').slice(0, 8)
  return `session-${base}`
}

/**
 * Fold one session's durable log into a Markdown transcript.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} sessionId - the session to export.
 * @returns the `{ filename, markdown }` payload.
 */
export async function exportMarkdown(ctx, sessionId) {
  const id = String(sessionId ?? '')
  if (id === '') throw new Error('dsh-base-plugin: sessionId is required')
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined || typeof persistence.readFrom !== 'function') {
    throw new Error('dsh-base-plugin: the sessionPersistence service is unavailable')
  }

  // Title: reuse the projection-cache lookup the Sessions page uses.
  let title = ''
  try {
    const domain = ctx.get('storageDomain')
    const table = typeof domain?.get === 'function' ? domain.get('session_projcache')?.table?.('sessions') : undefined
    const record = typeof table?.get === 'function' ? table.get(id) : undefined
    const val = record?.rows?.title?.val
    if (typeof val === 'string') title = val
  } catch { /* untitled exports are fine */ }

  // Created time from the header, when listable.
  let createdAt = 0
  try {
    if (typeof persistence.list === 'function') {
      const header = (await persistence.list()).find(h => String(h.id) === id)
      if (typeof header?.createdAt === 'number') createdAt = header.createdAt
    }
  } catch { /* header is enrichment only */ }

  const lines = []
  lines.push(`# ${title !== '' ? title : `会话 ${id.slice(0, 8)}`}`)
  lines.push('')
  const metaBits = [`会话 ID \`${id}\``]
  if (createdAt > 0) metaBits.push(`创建于 ${new Date(createdAt).toLocaleString()}`)
  lines.push(`> 导出自 DeepSeek Harness · ${metaBits.join(' · ')}`)
  lines.push('')

  // tool/call awaiting its result: callId → { name, args }
  const pending = new Map()
  let turn = 0
  let seq = 0
  let truncated = false

  for (;;) {
    let page
    try {
      page = await persistence.readFrom(id, seq)
    } catch (error) {
      throw new Error(`dsh-base-plugin: 无法读取会话日志: ${error instanceof Error ? error.message : String(error)}`)
    }
    const events = page?.events ?? []
    if (events.length === 0) break
    for (const event of events) {
      seq = (event.seq ?? seq) + 1
      if (lines.join('\n').length > DOC_MAX) { truncated = true; break }
      const data = event.data ?? {}
      if (event.type === 'turn/start') {
        turn = data.turn ?? turn + 1
        lines.push(`---`)
        lines.push('')
        lines.push(`## 第 ${turn} 轮`)
        lines.push('')
      } else if (event.type === 'user/message') {
        const text = blocksToText(data.content)
        if (data.source?.kind === 'user' || data.source?.kind === undefined) {
          lines.push(`### 🧑 用户`)
          lines.push('')
          lines.push(text)
          lines.push('')
        } else {
          // Injected context (file notices, skill content, goal rounds …)
          lines.push(`<details>\n<summary>📦 注入上下文 (${String(data.source.kind)})</summary>\n\n${clip(text, TOOL_TEXT_MAX * 4)}\n\n</details>`)
          lines.push('')
        }
      } else if (event.type === 'assistant/message') {
        const text = blocksToText(data.message?.content)
        lines.push(`### 🤖 助手${data.interrupted === true ? '（被中断）' : ''}`)
        lines.push('')
        lines.push(text !== '' ? text : '`(无文本输出)`')
        lines.push('')
      } else if (event.type === 'tool/call') {
        pending.set(String(data.callId), { name: String(data.name ?? ''), args: String(data.arguments ?? '') })
      } else if (event.type === 'tool/result') {
        // ToolResultMessage.content is [ToolResultBlock]; the block carries
        // toolCallId + isError + its own content blocks.
        const block = Array.isArray(data.message?.content) ? data.message.content[0] : data.message?.content
        const callId = String(block?.toolCallId ?? '')
        const call = pending.get(callId) ?? { name: '(未知调用)', args: '' }
        pending.delete(callId)
        const isError = block?.isError === true || data.error !== undefined
        const resultText = blocksToText(block?.content)
        lines.push(`<details>\n<summary>🔧 ${call.name}${isError ? ' ⚠️ 失败' : ''}</summary>\n\n`
          + `\`\`\`json\n${clip(call.args, TOOL_TEXT_MAX)}\n\`\`\`\n\n`
          + `**结果**\n\n\`\`\`\n${clip(resultText, TOOL_TEXT_MAX)}\n\`\`\`\n`
          + `</details>`)
        lines.push('')
      }
    }
    if (truncated) break
  }

  if (truncated) {
    lines.push('---')
    lines.push('')
    lines.push('> ⚠️ 文档达到大小上限，剩余内容未导出。')
  }

  return { filename: `${safeName(title, id)}.md`, markdown: lines.join('\n') }
}
