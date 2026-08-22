/**
 * dsh-base-plugin — the authoritative state file (`$DSH_HOME/dsh-base-plugin.json`).
 *
 * Shape: `{ plugins, mcpServers, persona, skipTerminalRows }`. The managed
 * block in the home patch is always REGENERATED from this state (see
 * lib/patch.js), so the JSON file is the single source of truth.
 * @module dsh-base-plugin/lib/state
 */
import { readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWrite, dshHome, statePath } from './env.js'

/**
 * Legacy state file from the package's `dsh-hub` era. Read once as a
 * migration fallback when the renamed file does not exist yet; the next
 * save writes the new path and the old file simply stops being read.
 */
function legacyStatePath() {
  return join(dshHome(), 'dsh-hub.json')
}

/** Normalize one loaded or legacy mobile section. */
function mobileFrom(raw) {
  if (raw === null || typeof raw !== 'object') return null
  return {
    enabled: raw.enabled === true,
    port: Number.isInteger(raw.port) && raw.port > 0 && raw.port < 65536 ? raw.port : 8787,
    secret: typeof raw.secret === 'string' ? raw.secret : '',
    devices: Array.isArray(raw.devices)
      ? raw.devices.filter(d => d !== null && typeof d === 'object' && typeof d.id === 'string')
          .map(d => ({
            id: String(d.id),
            name: typeof d.name === 'string' ? d.name : 'device',
            pairedAt: typeof d.pairedAt === 'number' ? d.pairedAt : 0,
            lastSeenAt: typeof d.lastSeenAt === 'number' ? d.lastSeenAt : 0,
          }))
      : [],
  }
}

/** Load the state file; missing/malformed means the empty state (after a one-time legacy read).
 * A PRESENT but unparseable file is backed up once (`*.corrupt-<ts>`) before
 * falling back — a hand-edit mistake曾静默清空全部插件/MCP/persona 配置。 */
export function loadState() {
  for (const path of [statePath(), legacyStatePath()]) {
    let raw
    try {
      raw = readFileSync(path, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error // 真实 IO 错误（权限等）应大声
      continue
    }
    try {
      const parsed = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object') {
        return {
          plugins: Array.isArray(parsed.plugins) ? parsed.plugins : [],
          mcpServers: Array.isArray(parsed.mcpServers) ? parsed.mcpServers : [],
          persona: typeof parsed.persona === 'string' ? parsed.persona : '',
          skipTerminalRows: parsed.skipTerminalRows === true,
          mobile: mobileFrom(parsed.mobile),
          notify: parsed.notify,
        }
      }
    } catch (error) {
      // 存在但解析失败：改名备份保住现场，再回落默认（而非静默覆盖）。
      try {
        renameSync(path, `${path}.corrupt-${Date.now()}`)
      } catch { /* 备份失败不阻断加载 */ }
      // eslint-disable-next-line no-console -- 插件加载早期 ctx.logger 未必可用
      console.warn(`dsh-base-plugin: state file ${path} is corrupt (backed up beside it): ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { plugins: [], mcpServers: [], persona: '', skipTerminalRows: false, mobile: null, notify: undefined }
}

/** Persist the state file atomically. */
export function saveState(state) {
  atomicWrite(statePath(), `${JSON.stringify(state, undefined, 2)}\n`)
}
