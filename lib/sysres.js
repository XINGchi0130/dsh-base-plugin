/**
 * dsh-base-plugin — system resources (the Monitor panel's System tab).
 *
 * Pure `node:os` + `process` readings — no official service exists for this
 * surface (verified), so this module owns the sampling:
 *
 *  - CPU %: derived from os.cpus() times DELTAS between two samples (a
 *    single snapshot is cumulative-since-boot and useless as "now"). The
 *    first call seeds the sample; the second onwards answers the true
 *    ratio. The sample pair is refreshed only after SAMPLE_WINDOW, keeping
 *    the 5s panel poll cheap.
 *  - process CPU: process.resourceUsage() userCPUTime+systemCPUTime deltas
 *    over the same window, as a per-core percentage (top's %CPU).
 *  - memory: PRESSURE-based, not "physical minus os.freemem" — on macOS
 *    free is narrow (file cache counts as used), which painted a healthy
 *    24G machine as 90% red. `available` therefore subtracts reclaimable
 *    pages: macOS via `vm_stat` (free+speculative+purgeable+inactive, page
 *    size taken from the tool's own header — it is 16K on Apple Silicon
 *    while sysctl hw.pagesize reports 4K), Linux via /proc/meminfo's
 *    MemAvailable, other platforms fall back to os.freemem(). The vm_stat
 *    read is cached alongside the CPU window; both `freeMem` (narrow) and
 *    `reclaimableMem` stay in the payload so the UI can show the split.
 *  - loadavg + os.uptime + process.uptime for context.
 *
 * @module dsh-base-plugin/lib/sysres
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { cpus, freemem, totalmem, loadavg, uptime } from 'node:os'

/** CPU 差分采样窗口：小于此间隔复用上一次答案（面板 5s 轮询近零开销）。 */
const SAMPLE_WINDOW_MS = 4000

/** Cached cpu-times snapshot pair state. */
let cpuSample = null // { at, total, idle, procTotal }

/** Cached vm_stat availability read: { at, available, reclaimable } | null. */
let memSample = null

/** macOS: parse `vm_stat` into { pageSize, pages: {name → count} } or null.
 * 单正则统一捕获：quoted 形态（旧版 macOS 的 `"Pages purgeable" count
 * in entire system: 14393.`）与裸形态都用第 3 组取数字——旧双正则在
 * quoted 形态上第一分支命中却不捕获数字，pages 落 NaN 且穿透守卫
 * （NaN 比较恒 false），整页内存数据静默失效。 */
function readVmStat() {
  try {
    const out = execFileSync('vm_stat', { encoding: 'utf8', timeout: 3000 })
    const pageMatch = /page size of (\d+)/.exec(out)
    if (pageMatch === null) return null
    const pageSize = Number(pageMatch[1])
    const pages = {}
    for (const line of out.split('\n')) {
      const m = /^(?:"([^"]+)"[^:]*|([A-Za-z][^:]+)):\s*(\d+)/.exec(line)
      if (m === null) continue
      const name = (m[1] ?? m[2] ?? '').trim()
      const count = Number(m[3])
      if (name !== '' && Number.isFinite(count)) pages[name] = count
    }
    return { pageSize, pages }
  } catch {
    return null
  }
}

/** Linux: MemAvailable from /proc/meminfo (kB) or null. */
function readMemAvailable() {
  try {
    const m = /MemAvailable:\s+(\d+)\s*kB/.exec(readFileSync('/proc/meminfo', 'utf8'))
    return m === null ? null : Number(m[1]) * 1024
  } catch {
    return null
  }
}

/**
 * Pressure-based availability { available, reclaimable } with the SAMPLE
 * window cache. reclaimable = available − os.freemem() (≤0 when the narrow
 * free already covers it); usedMem = total − available.
 *
 * Platform mapping: darwin → vm_stat reclaimable pages; linux → the
 * kernel's own MemAvailable; win32 → os.freemem() IS the availability
 * (Node maps GlobalMemoryStatusEx's ullAvailPhys, which already includes
 * standby/cache lists — the pressure semantics hold without subtraction);
 * anything else falls back to the same, degrading to "narrow free" at worst.
 */
function memoryAvailability(now) {
  if (memSample !== null && now - memSample.at < SAMPLE_WINDOW_MS) {
    return memSample
  }
  let available = null
  if (process.platform === 'darwin') {
    const vm = readVmStat()
    if (vm !== null) {
      const page = (name) => (vm.pages[name] ?? 0) * vm.pageSize
      available = page('Pages free') + page('Pages speculative')
        + page('Pages purgeable') + page('Pages inactive')
    }
  } else if (process.platform === 'linux') {
    available = readMemAvailable()
  } else {
    // win32 及其他：os.freemem() 本身即“可用”（含缓存/待机列表）。
    available = freemem()
  }
  if (!Number.isFinite(available) || available > totalmem()) available = freemem()
  const reclaimable = Math.max(0, available - freemem())
  memSample = { at: now, available, reclaimable }
  return memSample
}

/** Summed CPU times across all cores: { total, idle } in ms units. */
function cpuTimes() {
  let total = 0
  let idle = 0
  for (const cpu of cpus()) {
    const t = cpu.times
    total += t.user + t.nice + t.sys + t.idle + t.irq
    idle += t.idle
  }
  return { total, idle }
}

/** Read system+process resources; CPU ratios are window-delta based
 * (null until the second call — a one-shot snapshot cannot know "now"). */
export function systemResources() {
  const now = Date.now()
  // Node ≥20 的字段名是 userCPUTime/systemCPUTime（毫秒；旧文档的
  // userCPU/systemCPU 微秒名在当前 Node 上是 undefined——实测确认）。
  const ru = typeof process.resourceUsage === 'function' ? process.resourceUsage() : undefined
  const procTotal = ru !== undefined
    ? (ru.userCPUTime ?? 0) + (ru.systemCPUTime ?? 0) // milliseconds
    : 0

  const cur = cpuTimes()
  const prev = cpuSample
  let cpuPct = null
  let procCpuPct = null
  if (prev !== null) {
    const totalDelta = cur.total - prev.total
    const idleDelta = cur.idle - prev.idle
    if (totalDelta > 0) {
      cpuPct = Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)))
    }
    const procDeltaMs = procTotal - prev.procTotal // 已是毫秒
    const windowMs = now - prev.at
    if (windowMs > 0 && cpuPct !== null) {
      // 占单核的百分比（top 的 %CPU 语义，上限 = 核数×100）——
      // 比按核数归一化更直觉：120% = 一个多核在干活。
      procCpuPct = Math.round(procDeltaMs / windowMs * 100 * 100) / 100
    }
  }
  if (prev === null || now - prev.at >= SAMPLE_WINDOW_MS) {
    cpuSample = { at: now, total: cur.total, idle: cur.idle, procTotal }
  }

  const mem = process.memoryUsage()
  const total = totalmem()
  const free = freemem()
  const { available, reclaimable } = memoryAvailability(now)
  return {
    time: now,
    platform: process.platform,
    // os.loadavg() 在 Windows 恒为 [0,0,0]（Node 文档明确）——前端据此
    // 隐藏负载行，避免“0 / 0 / 0”的无信息展示。
    loadavgSupported: process.platform !== 'win32',
    cpus: cpus().length,
    cpuPct,
    procCpuPct,
    loadavg: loadavg().map(n => Math.round(n * 100) / 100),
    totalMem: total,
    // 压力口径：used = total − available（扣除可回收缓存页）。
    // macOS 的 os.freemem 是狭义空闲（文件缓存计为已用），不扣会把
    // 健康机器画成 90% 红——详见模块头。
    usedMem: Math.max(0, total - available),
    freeMem: free,
    availableMem: available,
    reclaimableMem: reclaimable,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    osUptimeSec: Math.round(uptime()),
    procUptimeSec: Math.round(process.uptime()),
  }
}
