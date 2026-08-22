/**
 * dsh-base-plugin —— 路由域模块共享的 HTTP 基础设施。
 *
 * 请求体读取（1 MiB 上限）、JSON 应答写入、变更类请求的同源检查、
 * git/terminal 域共用的会话-cwd 围栏。纯管道代码：不引入任何域模块。
 * @module dsh-base-plugin/lib/routes/http
 */

/** 读取 JSON 请求体（上限 1 MiB，超出即断开并拒绝）。 */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1024 * 1024) {
        reject(new Error('dsh-base-plugin: request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) {
        reject(new Error(`dsh-base-plugin: invalid JSON body: ${String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

/** JSON 应答写入：统一 content-type 与 no-store。 */
export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** 变更类请求的最小同源检查（防 CSRF 门槛）。 */
export function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true // same-origin fetch/curl without Origin
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

/**
 * 校验客户端提交的 `cwd` 确为某个真实会话的工作区。否则 git/terminal
 * 端点可以在宿主任意绝对路径上读 diff、开 shell——等于远程文件探测；
 * 会话存储是唯一可信来源。尽力而为：sessions 服务缺席时放行（组合层
 * 自行决定），服务在场但无匹配 cwd 则拒绝。
 */
let cwdFenceWarned = false

export function assertSessionCwd(ctx, cwd) {
  if (typeof cwd !== 'string' || cwd === '' || !cwd.startsWith('/')) {
    throw new Error('dsh-base-plugin: cwd must be an absolute path')
  }
  const sessions = ctx.get('sessions')
  if (sessions === undefined || typeof sessions.list !== 'function') {
    // fail-open 是组合层决定，但完全静默曾让围栏名义失效无人知晓——
    // 一次性告警暴露这个状态。
    if (!cwdFenceWarned) {
      cwdFenceWarned = true
      ctx.logger?.warn?.('dsh-base-plugin: sessions service absent — cwd fence is OPEN (git/terminal endpoints accept any absolute path this compose)')
    }
    return
  }
  for (const session of sessions.list()) {
    const header = session?.header
    if (typeof header?.cwd === 'string' && header.cwd === cwd) return
  }
  throw new Error('dsh-base-plugin: cwd is not a known session workspace')
}
