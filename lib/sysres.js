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
 *  - process CPU: process.resourceUsage().userCPU+systemCPU deltas over the
 *    same window, normalized by cpus×window (so 100% = all cores busy).
 *  - memory: os.freemem/totalmem (system), process.memoryUsage (rss/heap).
 *  - loadavg + os.uptime + process.uptime for context.
 *
 * @module dsh-base-plugin/lib/sysres
 */
import { cpus, freemem, totalmem, loadavg, uptime } from 'node:os'

/** CPU 差分采样窗口：小于此间隔复用上一次答案（面板 5s 轮询近零开销）。 */
const SAMPLE_WINDOW_MS = 4000

/** Cached cpu-times snapshot pair state. */
let cpuSample = null // { at, total, idle, procTotal }

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
  return {
    time: now,
    cpus: cpus().length,
    cpuPct,
    procCpuPct,
    loadavg: loadavg().map(n => Math.round(n * 100) / 100),
    totalMem: total,
    usedMem: total - free,
    freeMem: free,
    rss: mem.rss,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    osUptimeSec: Math.round(uptime()),
    procUptimeSec: Math.round(process.uptime()),
  }
}
