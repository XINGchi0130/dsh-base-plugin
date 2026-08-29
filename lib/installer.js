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
import { mutateState } from './patch.js'
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
    // 纯 registry spec：剥离版本部分（`pkg@1.2.3` → `pkg`；scoped
    // `@scope/pkg@1.2.3` → `@scope/pkg`——取最后一个 `@` 前段，首个
    // `@` 是 scope 前缀）。不剥离则 `${pkgName}/package.json` 永远解析
    // 失败，且回滚 remove 的名字也不匹配——"幽灵依赖"残留磁盘。
    const lastAt = spec.lastIndexOf('@')
    pkgName = lastAt > 0 ? spec.slice(0, lastAt) : spec
  }
  if (pkgName === undefined || pkgName === '') throw new Error('dsh-base-plugin: cannot derive a package name from the spec')
  // 本地目录名可能派生出 `-foo` 这类被 pnpm 当选项解析的名字——remove
  // 会静默失败，先行拒绝。
  if (pkgName.startsWith('-')) throw new Error(`dsh-base-plugin: derived package name "${pkgName}" is not a valid npm package name`)

  /** 失败回滚 remove 并核实其结果：回滚本身失败（名字不匹配/网络错）
   * 时幽灵依赖留在 package.json——错误信息必须点名手动清理。 */
  const rollback = async (reason) => {
    const removed = await runPnpm(['remove', pkgName], profileDir)
    if (removed.code !== 0) {
      throw new Error(`${reason}\nROLLBACK FAILED — run \`pnpm remove ${pkgName}\` in ${profileDir} manually`)
    }
    throw new Error(reason)
  }

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
    await rollback(`dsh-base-plugin: package installed but ${pkgName}/package.json is not resolvable from the profile`)
  }

  // Validate: a DSH plugin declares dsh fields or ships a bundle patch.
  const dshDecl = pkgJson.dsh !== null && typeof pkgJson.dsh === 'object' ? pkgJson.dsh : {}
  const patchRel = typeof dshDecl.bundle?.patch === 'string' ? dshDecl.bundle.patch : undefined
  const hasClient = pkgJson.exports !== null && typeof pkgJson.exports === 'object'
    && pkgJson.exports['./client'] !== undefined
  if (patchRel === undefined && !hasClient && dshDecl.client === undefined) {
    await rollback(`dsh-base-plugin: ${pkgName} does not look like a DSH plugin (no dsh.client / dsh.bundle.patch declaration)`)
  }

  // Composition rows: prefer the package's own bundle patch; fall back to a bare row.
  let rows = null
  if (patchRel !== undefined) {
    rows = rowsFromPatchFile(join(pkgDir, patchRel))
  }
  if (rows === null) rows = [{ id: String(pkgJson.name ?? pkgName), name: String(pkgJson.name ?? pkgName) }]
  // Id-collision fence + 状态写入收进 mutateState 临界区（commitTail 串
  // 行化），两个 P1 一并修掉：
  // ① 栅栏盲区：除 loader.entries() 外同时查 state 里已记录的 rows——
  //   同进程先后安装两个携带同 row id 的包时，第一次的行尚未进 loader，
  //   旧栅栏查不到，两份同 id 行一起落盘，下次 boot 仍是 duplicate id。
  // ② 读改写竞态：pnpm 是分钟级 await，旧 loadState→commit 快照整体
  //   写回会让并发安装/卸载互相覆盖 plugins 记录（丢记录 → 幽灵依赖）。
  try {
    await mutateState(s => {
      const reserved = new Set(['system-prompt'])
      const loader = ctx.get('loader')
      if (loader !== undefined && typeof loader.entries === 'function') {
        for (const entry of loader.entries()) reserved.add(String(entry.id))
      }
      for (const recorded of s.plugins) {
        for (const row of Array.isArray(recorded?.rows) ? recorded.rows : []) {
          reserved.add(String(row?.id ?? ''))
        }
      }
      for (const row of rows) {
        const id = String(row?.id ?? '')
        if (id === '' || reserved.has(id) || id.startsWith('mcp-') || id.startsWith('dsh-base-plugin-terminal')) {
          throw new Error(`dsh-base-plugin: package "${pkgName}" ships row id "${id}" colliding with an existing composition entry — refusing to install (this would break the next boot)`)
        }
      }
      s.plugins = s.plugins.filter(p => p.name !== pkgName)
      s.plugins.push({ name: pkgName, spec, rows })
    })
  } catch (error) {
    await rollback(error instanceof Error ? error.message : String(error))
  }
  return { name: pkgName, rows: rows.length }
}

/** Remove one package: drop rows first (fiber disposal), then pnpm remove. */
export async function uninstallPackage(ctx, state, pkgName) {
  const profileDir = resolveProfileDir(ctx)
  const before = state.plugins.length
  if (state.plugins.filter(p => p.name !== pkgName).length === before) {
    throw new Error(`dsh-base-plugin: ${pkgName} is not installed through dsh-base-plugin`)
  }
  // 同款竞态修复：mutateState 临界区内剔除本包（并发安装的记录不再被
  // 旧快照整体抹掉）。
  await mutateState(s => {
    s.plugins = s.plugins.filter(p => p.name !== pkgName)
  })
  if (profileDir !== undefined) {
    const removed = await runPnpm(['remove', pkgName], profileDir)
    if (removed.code !== 0) {
      return { name: pkgName, warning: `rows removed, but pnpm remove failed (exit ${removed.code}): ${removed.out.slice(-2000)}` }
    }
  }
  return { name: pkgName }
}
