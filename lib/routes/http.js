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

/**
 * 变更类请求的最小同源检查（防 CSRF 门槛）。
 *
 * 判定依据按优先级：
 * 1. `Origin` 存在 → 必须与 Host 同源（POST/PUT 等总带 Origin）。
 * 2. Origin 缺席但 `Sec-Fetch-Site` 存在 → 只认 `same-origin`（浏览器
 *    自己发起的同源 fetch）与 `none`（用户地址栏直开）。关键：Chromium
 *    对同源 GET fetch 不发 Origin、只发 Sec-Fetch-Site（Firefox 两者都
 *    发）——没有这条，工作区变更面板在 Chrome 系浏览器（含手机端）必然
 *    被 strict 检查误拒。跨站 `<img>`/no-cors 盲请求在现代浏览器同样
 *    携带 `Sec-Fetch-Site: cross-site`，照样被挡。
 * 3. 两个头都没有（curl / 旧浏览器）→ 非 strict 放行；strict 拒绝
 *    （盲 CSRF 触发面）。运维诊断请显式带
 *    `-H 'Origin: http://127.0.0.1:3080'`。
 */
export function sameOrigin(req, strict = false) {
  const origin = req.headers.origin
  if (origin !== undefined) {
    try {
      return new URL(origin).host === req.headers.host
    } catch {
      return false
    }
  }
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite !== undefined) return fetchSite === 'same-origin' || fetchSite === 'none'
  return !strict
}

/**
 * 校验客户端提交的 `cwd` 确为某个真实会话的工作区。否则 git/terminal
 * 端点可以在宿主任意绝对路径上读 diff、开 shell——等于远程文件探测；
 * 会话存储是唯一可信来源。fail-closed：sessions 服务缺席时直接拒绝
 * （web 服务器本身无鉴权，围栏是唯一防线——曾为 fail-open + 一次性
 * 告警，"开放"比"静默"更糟）；服务在场但无匹配 cwd 同样拒绝。
 */
export function assertSessionCwd(ctx, cwd) {
  if (typeof cwd !== 'string' || cwd === '' || !cwd.startsWith('/')) {
    throw new Error('dsh-base-plugin: cwd must be an absolute path')
  }
  const sessions = ctx.get('sessions')
  if (sessions === undefined || typeof sessions.list !== 'function') {
    ctx.logger?.warn?.('dsh-base-plugin: sessions service absent — cwd fence is CLOSED (git/terminal endpoints unavailable this compose)')
    throw new Error('dsh-base-plugin: sessions service unavailable — workspace fence closed')
  }
  for (const session of sessions.list()) {
    const header = session?.header
    if (typeof header?.cwd === 'string' && header.cwd === cwd) return
  }
  throw new Error('dsh-base-plugin: cwd is not a known session workspace')
}
