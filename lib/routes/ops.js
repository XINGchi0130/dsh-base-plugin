/**
 * dsh-base-plugin —— 「访问与安全」设置节的数据面（/ops/*）。
 *
 * 三个只读端点，全部服务于升级/鉴权事故的预防与自愈：
 * - `GET /ops/upstream` —— 本地 dsh 版本 vs 官方仓库最新标签 + 落后提
 *   交数（GitHub compare API，10 分钟缓存，GITHUB_TOKEN 透传）。升级
 *   决策不再靠手动查。
 * - `GET /ops/health` —— 插件健康自检：关键服务挂载、自家路由回环探
 *   活、状态文件权限。客户端另跑 DOM 契约探测并与此合并展示。
 *
 * @module dsh-base-plugin/lib/routes/ops
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { dshHome } from '../env.js'
import { sendJson } from './http.js'

/** 上游官方仓库（与插件市场一致的硬编码事实）。 */
const UPSTREAM_REPO = 'deepseek-ai/deepseek-harness'
/** 上游查询缓存时长。 */
const UPSTREAM_CACHE_MS = 10 * 60 * 1000
/** GitHub 请求超时：与 market.js 同口径。 */
const GITHUB_TIMEOUT_MS = 15000

let upstreamCache = { at: 0, key: '', value: null }

/** 逐位比较语义化键：返回 -1/0/1（先大后小，用于"最大者最新"）。 */
function compareKeys(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1
  }
  return 0
}

/** git 子调用包装：失败返回 undefined（git 缺席不算错误；stderr 静默）。 */
function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

/** 读本地 dsh 版本事实（checkout 根 = 进程 cwd；全部逐级降级）。 */
function localVersionFacts() {
  const root = process.cwd()
  let version = ''
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    // cwd 不一定是 dsh checkout（例如从其它目录 pnpm dsh web）：只有读到
    // dsh 根包才算数，否则宁可留空也不显示无关包的版本号。
    if (pkg.name === '@deepseek-ai/dsh-root' && typeof pkg.version === 'string') version = pkg.version
  } catch { /* 非 checkout 启动（如打包安装）：仅无版本号 */ }
  return {
    root,
    version,
    commit: git(['rev-parse', 'HEAD'], root) ?? '',
    describe: git(['describe', '--tags'], root) ?? '',
  }
}

/** 查官方仓库：最新发布标签 + 本地落后提交数。全部失败降级为字段缺失。 */
async function upstreamFacts(local) {
  const token = process.env.GITHUB_TOKEN
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'dsh-base-plugin',
    ...(token !== undefined && token !== '' ? { authorization: `Bearer ${token}` } : {}),
  }
  const getJson = async (path) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
    })
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub API rate limit reached — set GITHUB_TOKEN in the dsh process environment and restart dsh')
    }
    if (!response.ok) throw new Error(`GitHub API ${response.status} ${response.statusText}`)
    return response.json()
  }
  const facts = { latestTag: '', behindBy: null, remoteHead: '', rateLimited: false }
  try {
    const tags = await getJson(`/repos/${UPSTREAM_REPO}/tags?per_page=10`)
    const semver = (tag) => /^dsh-v(\d+)\.(\d+)\.(\d+)(?:-(rc|alpha|beta)\.(\d+))?$/.exec(tag)
    const weight = { rc: 2, beta: 1, alpha: 0 }
    let best = null
    for (const entry of Array.isArray(tags) ? tags : []) {
      const name = typeof entry?.name === 'string' ? entry.name : ''
      const m = semver(name)
      if (m === null) continue
      const pre = m[4] === undefined ? 3 : weight[m[4]]
      const key = [Number(m[1]), Number(m[2]), Number(m[3]), pre, Number(m[5] ?? 0)]
      if (best === null || compareKeys(key, best.key) > 0) best = { name, key }
    }
    facts.latestTag = best?.name ?? (Array.isArray(tags) && tags.length > 0 ? String(tags[0].name ?? '') : '')
  } catch (error) {
    facts.rateLimited = /rate limit/u.test(String(error?.message ?? error))
  }
  if (local.commit !== '') {
    try {
      const compare = await getJson(`/repos/${UPSTREAM_REPO}/compare/${local.commit.slice(0, 12)}...master`)
      if (typeof compare?.ahead_by === 'number') {
        facts.behindBy = compare.ahead_by
        facts.remoteHead = typeof compare.merge_base_commit_sha === 'string' ? compare.merge_base_commit_sha.slice(0, 12) : ''
      }
    } catch { /* compare 失败只缺计数 */ }
  }
  return facts
}

/** 缓存包裹：本地 commit 未变且未过期直接复用。 */
async function upstreamCached(local) {
  const key = `${local.commit}|${local.version}`
  if (upstreamCache.value !== null && upstreamCache.key === key
    && Date.now() - upstreamCache.at < UPSTREAM_CACHE_MS) {
    return { ...upstreamCache.value, cached: true }
  }
  const value = await upstreamFacts(local)
  upstreamCache = { at: Date.now(), key, value }
  return { ...value, cached: false }
}

/**
 * 注册 /ops/* 路由。
 * @param {import('cordis').Context} ctx 插件 fiber 上下文（webServer 已注入）。
 */
export function opsRoutes(ctx) {
  const healthInfo = async () => {
    const stateFile = join(dshHome(), 'dsh-base-plugin.json')
    let stateMode = null
    try {
      stateMode = (statSync(stateFile).mode & 0o777)
    } catch { /* 状态文件尚未创建 */ }
    let routeProbe = null
    try {
      const port = typeof ctx.webServer?.port === 'number' ? ctx.webServer.port : 3080
      const started = Date.now()
      const response = await fetch(`http://127.0.0.1:${String(port)}/dsh-base-plugin/api/service/info`, {
        headers: { host: `127.0.0.1:${String(port)}` },
        signal: AbortSignal.timeout(4000),
      })
      routeProbe = { ok: response.ok, status: response.status, ms: Date.now() - started }
    } catch (error) {
      routeProbe = { ok: false, status: 0, ms: 0, error: String(error?.message ?? error) }
    }
    return {
      services: {
        webServer: typeof ctx.webServer?.port === 'number',
        sessions: ctx.get('sessions') !== undefined,
        credentials: ctx.get('credentials') !== undefined,
        connection: ctx.get('connection') !== undefined,
        sessionPersistence: ctx.get('sessionPersistence') !== undefined,
        workspaceRegistry: ctx.get('workspaceRegistry') !== undefined,
      },
      routeProbe,
      stateFileModeOk: stateMode === null ? null : stateMode === 0o600,
      patchFileExists: existsSync(join(dshHome(), 'cordis.patch.yml')),
      local: localVersionFacts(),
    }
  }

  return [
    // GET /dsh-base-plugin/api/ops/upstream —— 本地 vs 官方版本
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/ops/upstream',
      handler: async (_req, res) => {
        const local = localVersionFacts()
        const remote = await upstreamCached(local)
        sendJson(res, 200, {
          ok: true,
          value: {
            repo: UPSTREAM_REPO,
            local: { version: local.version, commit: local.commit.slice(0, 12), describe: local.describe },
            remote,
          },
        })
      },
    },
    // GET /dsh-base-plugin/api/ops/health —— 健康自检
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/ops/health',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: await healthInfo() })
      },
    },
  ]
}
