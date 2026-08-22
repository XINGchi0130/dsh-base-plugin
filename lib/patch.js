/**
 * dsh-base-plugin — the managed block inside the home patch layer.
 *
 * The block between `MARK_BEGIN`/`MARK_END` inside `$DSH_HOME/cordis.patch.yml`
 * is always REGENERATED from the state file, so hand edits inside the markers
 * are overwritten while everything outside the markers is preserved
 * byte-exact. The home patch layer is hot-watched by dsh (`watchUserPatches`),
 * so row changes mount/unmount fibers live without a restart.
 * @module dsh-base-plugin/lib/patch
 */
import { readFileSync } from 'node:fs'
import { atomicWrite, getYaml, homePatchPath } from './env.js'
import { saveState } from './state.js'

const MARK_BEGIN = '# >>> dsh-base-plugin managed (auto-generated; edits inside are overwritten) >>>'
const MARK_END = '# <<< dsh-base-plugin managed <<<'

/** One managed mcp-client row for a server config. */
export function mcpRow(server) {
  const config = { transport: server.transport, serverName: server.serverName }
  if (server.transport === 'stdio') {
    config.command = server.command
    if (server.args !== undefined && server.args.length > 0) config.args = server.args
    if (server.env !== undefined && Object.keys(server.env).length > 0) config.env = server.env
  } else {
    config.url = server.url
    if (server.headers !== undefined && Object.keys(server.headers).length > 0) config.headers = server.headers
  }
  return { id: `mcp-${server.serverName}`, name: '@deepseek-ai/dsh-mcp-client', config }
}

/** Serialize the managed server list as the YAML the settings page edits. */
export function serversYaml(servers) {
  const yaml = getYaml()
  if (yaml === null) return ''
  return servers.length === 0 ? '[]\n' : yaml.stringify(servers, { lineWidth: 0 })
}

/** All NEW rows the managed block should insert for a state. */
export function managedRows(state) {
  const rows = []
  // The official PTY registry + bash backend, so the Terminal tab works
  // out of the box wherever dsh-base-plugin is composed. The ids carry a
  // distinctive prefix: index.js apply() detects an EXTERNAL composition of
  // the same packages (whose ids cannot contain the prefix) and sets
  // `skipTerminalRows` — a second `terminals` service registration would
  // fail the next boot, exactly like a duplicate entry id.
  if (state.skipTerminalRows !== true) {
    rows.push({ id: 'dsh-base-plugin-terminal', name: '@deepseek-ai/dsh-terminal' })
    rows.push({ id: 'dsh-base-plugin-terminal-bash', name: '@deepseek-ai/dsh-terminal-bash' })
  }
  for (const plugin of state.plugins) {
    if (Array.isArray(plugin.rows)) rows.push(...plugin.rows)
  }
  for (const server of state.mcpServers) rows.push(mcpRow(server))
  return rows
}

/**
 * The full patch list for the managed block. Load-bearing distinction:
 * NEW rows (market plugins, MCP servers) travel as `{ insert: [...] }`;
 * the persona override travels as an id-targeted config PATCH —
 * `system-prompt` is a base-bundle row, and inserting another row with the
 * same id produces "duplicate loader entry id: system-prompt" and fails the
 * next boot. The patch form replaces that row's config instead; `persona:
 * ''` (the unset state) neutralizes the deployment bundle's default persona,
 * and the plugin schema refills includeHarnessIdentity etc.
 */
export function managedPatches(state) {
  const patches = []
  const rows = managedRows(state)
  if (rows.length > 0) patches.push({ insert: rows })
  patches.push({
    id: 'system-prompt',
    config: { persona: typeof state.persona === 'string' ? state.persona : '' },
  })
  return patches
}

/**
 * Regenerate the managed block inside the home patch from `state`.
 * Everything outside the markers is preserved byte-exact (a bare `[]` empty
 * document is dropped when rows follow — `[]` plus block-sequence items is
 * invalid YAML); the persona row is always present, so an identical
 * regeneration is skipped (no spurious config reloads). The result is
 * ALWAYS parse-validated before writing: the home patch is read at boot,
 * where invalid YAML fails the whole dsh launch, so this function refuses
 * to write anything that does not parse back to a YAML list.
 */
export function writeHomePatch(state) {
  const path = homePatchPath()
  let previous = ''
  try {
    previous = readFileSync(path, 'utf8')
  } catch { /* no home patch yet */ }

  // Strip any previous managed block, keep the rest verbatim. Both the
  // current markers and the legacy `dsh-hub` ones are stripped, so a rename
  // from the old package never orphans a stale block.
  let outside = previous
  for (const [begin, end] of [
    [MARK_BEGIN, MARK_END],
    ['# >>> dsh-hub managed (auto-generated; edits inside are overwritten) >>>', '# <<< dsh-hub managed <<<'],
  ]) {
    const beginIdx = outside.indexOf(begin)
    if (beginIdx === -1) continue
    const endIdx = outside.indexOf(end, beginIdx)
    const endLen = endIdx === -1 ? beginIdx : endIdx + end.length
    outside = outside.slice(0, beginIdx) + outside.slice(endLen)
  }
  outside = outside.replace(/\n+$/, '')

  const yaml = getYaml()
  if (yaml === null) {
    throw new Error('dsh-base-plugin: the yaml package is not resolvable — cannot regenerate the managed patch block')
  }

  const patches = managedPatches(state)
  let next
  if (patches.length === 0) {
    // `[]` is the valid empty form; an empty FILE parses to null and fails boot.
    next = outside === '' ? '[]\n' : `${outside}\n`
  } else {
    // A bare flow document (`[]`) cannot be followed by block-sequence
    // items — drop the `[]` line so the block becomes the whole document.
    // Comments are kept; any real hand-written rows append as usual.
    const skeleton = outside
      .split('\n')
      .filter(line => { const t = line.trim(); return t !== '' && !t.startsWith('#') })
      .join('\n')
      .trim()
    const base = skeleton === '' || skeleton === '[]'
      ? outside.split('\n').filter(line => line.trim() !== '[]').join('\n').replace(/\n+$/, '')
      : outside
    const body = yaml.stringify(patches, { lineWidth: 0 })
    const block = `${MARK_BEGIN}\n${body}${MARK_END}\n`
    next = base === '' ? block : `${base}\n\n${block}`
  }

  // Never write an unparseable or non-list home patch — refuse loudly and
  // keep the previous file instead of corrupting the next boot.
  let parsed
  try {
    parsed = yaml.parse(next)
  } catch (error) {
    throw new Error(`dsh-base-plugin: refusing to write an invalid home patch: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error('dsh-base-plugin: refusing to write a home patch that does not parse to a YAML list')
  }

  if (next !== previous) atomicWrite(path, next)
}

/**
 * Persist state and regenerate the patch block in one step. Serialized by a
 * promise queue: concurrent commits (an MCP save racing a usage price save)
 * would otherwise interleave read-modify-write cycles on the same two files
 * and one side's state would be lost.
 */
let commitTail = Promise.resolve()

export function commit(state) {
  const run = commitTail.then(() => {
    saveState(state)
    writeHomePatch(state)
  })
  // 调用方现已 await commit（错误走 HTTP 400）；此兜底为被等待的
  // 拒绝提供集中日志（可能双日志，无害），并覆盖无人等待的路径。
  run.catch(error => {
    console.warn(`dsh-base-plugin: background commit failed: ${error instanceof Error ? error.message : String(error)}`)
  })
  commitTail = run.catch(() => {})
  return run
}
