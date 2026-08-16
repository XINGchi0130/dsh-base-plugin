/**
 * dsh-base-plugin — shared environment: paths, yaml resolution, atomic writes.
 *
 * Everything here is environment plumbing shared by the feature modules:
 * where `$DSH_HOME` is, which files dsh-base-plugin owns inside it, how the web
 * profile directory is found, and how the `yaml` package is resolved from
 * the healed profiles module fallback.
 * @module dsh-base-plugin/lib/env
 */
import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'

/** `$DSH_HOME` (defaults to `~/.dsh`). */
export function dshHome() {
  const v = process.env.DSH_HOME
  return v !== undefined && v !== '' ? v : join(homedir(), '.dsh')
}

/** Authoritative state file. */
export function statePath() {
  return join(dshHome(), 'dsh-base-plugin.json')
}

/** The home-level patch layer dsh hot-watches. */
export function homePatchPath() {
  return join(dshHome(), 'cordis.patch.yml')
}

/** The user-owned skill root (`~/.dsh/skills`), watched for hot registration. */
export function userSkillsDir() {
  return join(dshHome(), 'skills')
}

/**
 * Resolve the web profile directory (the pnpm workspace our dependencies
 * live in). Prefer the loader tree anchor `ctx.baseUrl`; fall back to the
 * conventional `~/.dsh/profiles/web`.
 */
export function resolveProfileDir(ctx) {
  const candidates = []
  if (typeof ctx.baseUrl === 'string' && ctx.baseUrl !== '') candidates.push(ctx.baseUrl)
  candidates.push(join(dshHome(), 'profiles', 'web'))
  for (const dir of candidates) {
    if (existsSync(join(dir, 'package.json'))) return dir
  }
  return undefined
}

/** Lazily resolved `yaml` module, or null when unavailable. */
let yamlLib = undefined

/**
 * Resolve the `yaml` package from the healed profiles module fallback or the
 * web profile. Cached per process; null means "unavailable" (also cached).
 */
export function getYaml() {
  if (yamlLib !== undefined) return yamlLib
  yamlLib = null
  const anchors = [
    join(dshHome(), 'profiles', 'package.json'),
    join(dshHome(), 'profiles', 'web', 'package.json'),
  ]
  for (const anchor of anchors) {
    try {
      const req = createRequire(anchor)
      yamlLib = req('yaml')
      return yamlLib
    } catch { /* try next anchor */ }
  }
  return null
}

/** Atomic write (tmp + rename). Parent directory must exist.
 * Mode 0o600: the state file carries the mobile-access HMAC secret, so it
 * must never be group/world readable (parity with dsh's own
 * .credentials.yaml). rename() carries the tmp file's mode onto the target,
 * so both the tmp write and a one-time chmod of a pre-existing file (see
 * index.js boot) keep the secret private. */
export function atomicWrite(path, content) {
  const tmp = `${path}.dsh-base-plugin.tmp`
  writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, path)
}
