/**
 * dsh-base-plugin — live status readers over host services.
 *
 * Reads only the scalar leaves the settings pages need: loader rows as plain
 * data (fiber phase, enabled), MCP server statuses (managed ones from state
 * plus hand-added rows detected live, with per-server tool counts from the
 * tool registry), and skill-view discriminators (which skills are
 * deployment-shipped vs user-owned, plus the default preset's standing
 * scope so preset-contributed skills are included).
 * @module dsh-base-plugin/lib/status
 */
import { userSkillsDir } from './env.js'

/**
 * Resolve the default agent preset's standing scope, so skill views include
 * preset-contributed skills (the global layer alone is usually empty).
 * Best effort: undefined falls back to the global layer.
 */
export async function defaultSkillScope(ctx) {
  const agentPresets = ctx.get('agentPresets')
  if (agentPresets === undefined || typeof agentPresets.standingKeyFor !== 'function') return undefined
  try {
    return await agentPresets.standingKeyFor()
  } catch {
    return undefined
  }
}

/**
 * Whether a skill summary belongs to a deployment-shipped agent preset
 * (mounted from `.../config/agent-presets/<preset>/skills/...` via
 * customSkillDirs). Those skills are deployment-owned — an upgrade overwrites
 * them and users cannot edit them — so the settings page hides them. Skills
 * from user presets (`~/.dsh/.agent-presets/`), user/project roots, and
 * runtime registrations all stay visible.
 */
export function isShippedPresetSkill(summary) {
  const base = summary?.resourceBase
  if (base === null || typeof base !== 'object') return false
  const dir = String(base.path ?? '').replaceAll('\\', '/')
  return dir.includes('/config/agent-presets/')
}

/** Whether a skill summary's files live in the user-owned skill root. */
export function isUserSkill(summary) {
  const base = summary?.resourceBase
  if (base === null || typeof base !== 'object') return false
  const dir = String(base.path ?? '').replaceAll('\\', '/')
  return dir.startsWith(`${userSkillsDir().replaceAll('\\', '/')}/`)
}

const FIBER_PHASE = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

/** Loader entries as plain rows (id, name, enabled, phase, mcp leaf fields). */
export function loaderRows(ctx) {
  const loader = ctx.get('loader')
  if (loader === undefined) return []
  const rows = []
  for (const entry of loader.entries()) {
    if (entry.options.group) continue
    const row = {
      entryId: entry.id,
      moduleName: entry.options.name,
      enabled: !entry.disabled,
      phase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? String(entry.fiber.state),
    }
    // Scalar leaves only — never pass the live config object through.
    if (entry.options.name === '@deepseek-ai/dsh-mcp-client') {
      const config = entry.options.config
      if (typeof config?.serverName === 'string') row.mcpServerName = config.serverName
      row.mcpTransport = config?.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
    }
    if (entry.options.name === '@deepseek-ai/dsh-system-prompt') {
      const config = entry.options.config
      if (typeof config?.persona === 'string') row.persona = config.persona
    }
    rows.push(row)
  }
  return rows
}

/**
 * The persona currently in effect: the composed `system-prompt` row's config
 * (dsh-base-plugin's override when set, otherwise the deployment bundle's own).
 * Empty string when the row or field is absent.
 */
export function effectivePersona(ctx) {
  const row = loaderRows(ctx).find(r => r.moduleName === '@deepseek-ai/dsh-system-prompt')
  return row === undefined || typeof row.persona !== 'string' ? '' : row.persona
}

/** MCP server statuses: managed ones from state, hand-added rows detected live. */
export function mcpStatus(ctx, state) {
  const rows = loaderRows(ctx)
  const tools = ctx.get('tools')
  const schemas = tools === undefined ? [] : tools.schemas()
  const managedNames = new Set(state.mcpServers.map(s => s.serverName))
  const out = []

  const toolCount = (serverName) => {
    const prefix = `mcp__${serverName}__`
    let count = 0
    for (const schema of schemas) {
      if (typeof schema?.name === 'string' && schema.name.startsWith(prefix)) count += 1
    }
    return count
  }

  for (const server of state.mcpServers) {
    // Match by the row's config serverName: entry ids carry the Include
    // subtree prefix, so an exact `mcp-<name>` id match is unreliable.
    const entry = rows.find(r => r.moduleName === '@deepseek-ai/dsh-mcp-client'
      && r.mcpServerName === server.serverName)
    out.push({
      ...server,
      managed: true,
      phase: entry === undefined ? 'absent' : entry.enabled ? entry.phase : 'disabled',
      tools: toolCount(server.serverName),
    })
  }
  for (const row of rows) {
    if (row.moduleName !== '@deepseek-ai/dsh-mcp-client') continue
    const serverName = row.mcpServerName ?? row.entryId
    if (managedNames.has(serverName)) continue
    out.push({
      serverName,
      transport: row.mcpTransport ?? 'stdio',
      managed: false,
      phase: row.enabled ? row.phase : 'disabled',
      tools: toolCount(serverName),
    })
  }
  return out.sort((a, b) => a.serverName.localeCompare(b.serverName))
}
