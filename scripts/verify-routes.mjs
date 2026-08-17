// 路由等价性验证脚本（临时）：从新代码导出路由表，与 HEAD 旧版对比。
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// ── 新版本：导入各域模块，空 ctx/deps 拿到全部路由行 ──
const mods = await import('../lib/routes/state.js')
const panels = await import('../lib/routes/panels.js')
const us = await import('../lib/routes/usage-sessions.js')
const ms = await import('../lib/routes/mobile-service.js')
const pm = await import('../lib/routes/packages-mcp.js')

const noop = () => {}
// 空 ctx：域模块的 handler 不会被调用（只取 method/path 元数据），
// get() 恒 undefined 即可满足模块顶层无副作用的要求。
const ctx = { get: () => undefined }
const deps = {
  ensureAuth: noop, mobileControls: {}, terminalApi: {},
  acquireBusy: () => true, releaseBusy: noop, busyOp: () => null, assertCwd: noop,
}

const groups = [
  mods.stateRoutes(ctx, deps), mods.marketRoutes(ctx, deps),
  mods.skillsRoutes(ctx, deps), mods.promptRoutes(ctx, deps),
  panels.terminalsRoutes(ctx, deps), panels.gitRoutes(ctx, deps),
  us.usageRoutes(ctx, deps), us.sessionsRoutes(ctx),
  ms.mobileRoutes(ctx, deps), ms.serviceRoutes(ctx),
  pm.packageRoutes(ctx, deps), pm.mcpRoutes(),
]
const newSet = new Set()
for (const g of groups) {
  for (const r of g) {
    if (typeof r.handler !== 'function') throw new Error(`域模块返回了无 handler 的行: ${r.method} ${r.path}`)
    newSet.add(`${r.method} ${r.path}`)
  }
}

// ── 旧版本：从 git HEAD 提取源码，正则抓取 if 链里的路由谓词 ──
execSync('git show HEAD:lib/routes.js > /tmp/old-routes-src.js')
const src = readFileSync('/tmp/old-routes-src.js', 'utf8')
const oldSet = new Set()
// 谓词形如: path === '/dsh-base-plugin/api/x' && method === 'GET'
const re = /path === '(\/dsh-base-plugin\/api\/[a-z/]+)' && method === '(GET|POST)'/g
for (const m of src.matchAll(re)) oldSet.add(`${m[2]} ${m[1]}`)

// ── 对比 ──
const missing = [...oldSet].filter(x => !newSet.has(x))
const extra = [...newSet].filter(x => !oldSet.has(x))
console.log(`旧版本路由: ${oldSet.size} | 新版本路由: ${newSet.size}`)
if (missing.length) console.log('缺失(旧有新无):', missing)
if (extra.length) console.log('多余(新有旧无):', extra)
const equal = missing.length === 0 && extra.length === 0 && oldSet.size === newSet.size
console.log(equal ? '✅ 路由表完全等价' : '❌ 不一致')
process.exit(equal ? 0 : 1)
