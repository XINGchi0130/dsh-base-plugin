/**
 * dsh-base-plugin — market installs: pnpm add into the web profile + composition-row
 * bookkeeping.
 *
 * Install validates that the result really is a DSH plugin (package.json
 * `dsh` fields or a bundle patch file) and rolls the dependency back
 * otherwise. Uninstall drops the composition rows first (fiber disposal via
 * the hot-watched home patch), then removes the dependency.
 * @module dsh-base-plugin/lib/installer
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { getYaml, resolveProfileDir } from './env.js'
import { commit } from './patch.js'
import { runPnpm } from './pnpm.js'

/** Reject spec shapes that could smuggle pnpm flags or shell metacharacters.
 * Win32 runs pnpm through a shell (no .cmd argv guarantee), so the spec must
 * be a whitelist: package names, versions, scopes, GitHub specs, and absolute
 * paths — nothing else. */
const SAFE_SPEC = /^[A-Za-z0-9@/._~:#\[\]-]+$/
function assertSafeSpec(spec) {
  if (spec === '' || spec.length > 4096 || spec.startsWith('-') || !SAFE_SPEC.test(spec)) {
    throw new Error('dsh-base-plugin: invalid install spec')
  }
}

/**
 * Extract INSERT rows from a package's own bundle patch. Third-party patch
 * files may only ADD their own rows — id-targeted config patches (or
 * disables) against deployment rows (approval/sandbox/...) are dropped: a
 * one-click market install must not be able to rewire the deployment.
 */
function rowsFromPatchFile(file) {
  const yaml = getYaml()
  if (yaml === null) return null
  try {
    const parsed = yaml.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    const rows = []
    for (const patch of parsed) {
      if (patch === null || typeof patch !== 'object' || !Array.isArray(patch.insert)) continue
      for (const row of patch.insert) {
        if (row !== null && typeof row === 'object') rows.push(row)
      }
    }
    if (rows.length === 0) return null
    // Sanitize to plain JSON (defensive: parsed data is file data, not live objects).
    return JSON.parse(JSON.stringify(rows))
  } catch {
    return null
  }
}

/**
 * Install one package: pnpm add → validate it is a DSH plugin → record rows.
 * `spec` is `name@github:owner/repo` or an absolute local directory path.
 */
export async function installPackage(ctx, state, spec) {
  assertSafeSpec(spec)
  const profileDir = resolveProfileDir(ctx)
  if (profileDir === undefined) throw new Error('dsh-base-plugin: cannot resolve the profile directory')

  let pkgName
  if (spec.startsWith('/') || spec.startsWith('~')) {
    pkgName = spec.split('/').filter(Boolean).pop()
  } else if (spec.includes('@github:')) {
    pkgName = spec.split('@github:')[0]
  } else {
    pkgName = spec
  }
  if (pkgName === undefined || pkgName === '') throw new Error('dsh-base-plugin: cannot derive a package name from the spec')

  const added = await runPnpm(['add', spec], profileDir)
  if (added.code !== 0) throw new Error(`pnpm add failed (exit ${added.code}):\n${added.out.slice(-4000)}`)

  // Resolve the installed package directory from the profile.
  const req = createRequire(join(profileDir, 'package.json'))
  let pkgDir
  let pkgJson
  try {
    const pkgJsonPath = req.resolve(`${pkgName}/package.json`)
    pkgDir = dirname(pkgJsonPath)
    pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  } catch {
    await runPnpm(['remove', pkgName], profileDir)
    throw new Error(`dsh-base-plugin: package installed but ${pkgName}/package.json is not resolvable from the profile`)
  }

  // Validate: a DSH plugin declares dsh fields or ships a bundle patch.
  const dshDecl = pkgJson.dsh !== null && typeof pkgJson.dsh === 'object' ? pkgJson.dsh : {}
  const patchRel = typeof dshDecl.bundle?.patch === 'string' ? dshDecl.bundle.patch : undefined
  const hasClient = pkgJson.exports !== null && typeof pkgJson.exports === 'object'
    && pkgJson.exports['./client'] !== undefined
  if (patchRel === undefined && !hasClient && dshDecl.client === undefined) {
    await runPnpm(['remove', pkgName], profileDir)
    throw new Error(`dsh-base-plugin: ${pkgName} does not look like a DSH plugin (no dsh.client / dsh.bundle.patch declaration)`)
  }

  // Composition rows: prefer the package's own bundle patch; fall back to a bare row.
  let rows = null
  if (patchRel !== undefined) {
    rows = rowsFromPatchFile(join(pkgDir, patchRel))
  }
  if (rows === null) rows = [{ id: String(pkgJson.name ?? pkgName), name: String(pkgJson.name ?? pkgName) }]
  // Id-collision fence: a third-party row whose id matches an existing loader
  // entry (deployment rows like system-prompt, or our managed prefixes mcp-*/
  // dsh-base-plugin-terminal*) would fail the NEXT boot with "duplicate
  // loader entry id" — reject at install time and roll back the dependency.
  {
    const loader = ctx.get('loader')
    const reserved = new Set(['system-prompt'])
    if (loader !== undefined && typeof loader.entries === 'function') {
      for (const entry of loader.entries()) reserved.add(String(entry.id))
    }
    for (const row of rows) {
      const id = String(row?.id ?? '')
      if (id === '' || reserved.has(id) || id.startsWith('mcp-') || id.startsWith('dsh-base-plugin-terminal')) {
        await runPnpm(['remove', pkgName], profileDir)
        throw new Error(`dsh-base-plugin: package "${pkgName}" ships row id "${id}" colliding with an existing composition entry — refusing to install (this would break the next boot)`)
      }
    }
  }

  // pnpm 是分钟级 await——入参 state 是安装前的旧快照，直接整体写回会
  // 回滚窗口期内其他写盘（MCP/persona/mobile——含已轮换的 secret）。
  // 只合并本操作的 plugins 字段，其余字段以最新盘上状态为准。
  const fresh = loadState()
  fresh.plugins = fresh.plugins.filter(p => p.name !== pkgName)
  fresh.plugins.push({ name: pkgName, spec, rows })
  await commit(fresh)
  return { name: pkgName, rows: rows.length }
}

/** Remove one package: drop rows first (fiber disposal), then pnpm remove. */
export async function uninstallPackage(ctx, state, pkgName) {
  const profileDir = resolveProfileDir(ctx)
  const before = state.plugins.length
  const remaining = state.plugins.filter(p => p.name !== pkgName)
  if (remaining.length === before) throw new Error(`dsh-base-plugin: ${pkgName} is not installed through dsh-base-plugin`)
  const fresh = loadState()
  fresh.plugins = remaining
  await commit(fresh)
  if (profileDir !== undefined) {
    const removed = await runPnpm(['remove', pkgName], profileDir)
    if (removed.code !== 0) {
      return { name: pkgName, warning: `rows removed, but pnpm remove failed (exit ${removed.code}): ${removed.out.slice(-2000)}` }
    }
  }
  return { name: pkgName }
}
