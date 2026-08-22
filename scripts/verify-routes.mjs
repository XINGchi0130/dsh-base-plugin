// 路由面快照校验：当前代码导出的路由表 vs scripts/routes.snapshot.json。
// 新增/删除路由时先跑 `node scripts/verify-routes.mjs --update` 固化新基线。
import { readFileSync, writeFileSync } from 'node:fs'

const mods = await import('../lib/routes/state.js')
const panels = await import('../lib/routes/panels.js')
const us = await import('../lib/routes/usage-sessions.js')
const ms = await import('../lib/routes/mobile-service.js')
const pm = await import('../lib/routes/packages-mcp.js')
const nt = await import('../lib/routes/notify.js')

const noop = () => {}
const ctx = { get: () => undefined }
const deps = { ensureAuth: noop, mobileControls: {}, terminalApi: {}, acquireBusy: () => true, releaseBusy: noop, busyOp: () => null, assertCwd: noop }

const groups = [
  mods.stateRoutes(ctx, deps), mods.marketRoutes(ctx, deps),
  mods.skillsRoutes(ctx, deps), mods.promptRoutes(ctx, deps),
  panels.terminalsRoutes(ctx, deps), panels.gitRoutes(ctx, deps),
  panel_monitor(panels), us.usageRoutes(ctx, deps), us.sessionsRoutes(ctx),
  ms.mobileRoutes(ctx, deps), ms.serviceRoutes(ctx),
  pm.packageRoutes(ctx, deps), pm.mcpRoutes(ctx), nt.notifyRoutes(),
]
function panel_monitor(panels) { return panels.monitorRoutes(ctx) }
function panel_fileops(panels) { return panels.fileOpsRoutes(ctx) }
function panel_promptopt(panels) { return panels.promptOptimizerRoutes(ctx) }
groups.push(panel_fileops(panels))
groups.push(panel_promptopt(panels))

const rows = []
for (const g of groups) {
  for (const r of g) {
    if (typeof r.handler !== 'function') throw new Error(`域模块返回了无 handler 的行: ${r.method} ${r.path}`)
    rows.push(`${r.method} ${r.path}`)
  }
}
rows.sort()
const snapshotPath = new URL('./routes.snapshot.json', import.meta.url)

if (process.argv.includes('--update')) {
  writeFileSync(snapshotPath, `${JSON.stringify(rows, null, 2)}\n`)
  console.log(`✓ 快照已更新（${rows.length} 条路由）`)
  process.exit(0)
}

let expected = []
try { expected = JSON.parse(readFileSync(snapshotPath, 'utf8')) } catch {
  console.error('✗ 无快照——先运行 node scripts/verify-routes.mjs --update')
  process.exit(1)
}
const missing = expected.filter(x => !rows.includes(x))
const extra = rows.filter(x => !expected.includes(x))
if (missing.length || extra.length) {
  if (missing.length) console.error('缺失:', missing)
  if (extra.length) console.error('新增:', extra, '（确认无误后 --update 固化）')
  process.exit(1)
}
console.log(`✓ 路由面与快照一致（${rows.length} 条）`)
