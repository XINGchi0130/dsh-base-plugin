/**
 * dsh-base-plugin — git file-changes reader for the conversation Changes tab.
 *
 * Read-only git surface over the session workspace:
 * - `gitAvailable()` probes the git binary once per process.
 * - `gitStatus(cwd)` ensures a repo exists first: when git is available but
 *   the workspace is not inside any work tree, it runs `git init` AND a
 *   full baseline commit (inline identity config, so machines without a
 *   configured git user never fail) — an unborn HEAD in an existing repo
 *   gets the same baseline. All later "changes" are then relative to that
 *   baseline. Status itself is scoped to the workspace path (`.´), so a
 *   workspace nested inside a larger repo shows only its own subtree.
 * - `gitFileDiff(cwd, file)` returns a unified diff vs HEAD; untracked
 *   files fall back to `git diff --no-index /dev/null <file>` so brand-new
 *   AI files still show their full content as additions.
 *
 * Every operation spawns git directly (no shell) with a bounded timeout;
 * paths are validated before use. Nothing here writes to the work tree
 * except the one-time init/baseline.
 * @module dsh-base-plugin/lib/git
 */
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const GIT_TIMEOUT_MS = 20_000
const BASELINE_TIMEOUT_MS = 120_000
/** Inline identity for the baseline commit; never touches global git config. */
const BASELINE_IDENTITY = ['-c', 'user.name=dsh-base-plugin', '-c', 'user.email=dsh@local']

/** Run `git <args>` in a directory; resolves { code, out } (stdout+stderr, trimmed). */
function runGit(args, cwd, timeoutMs = GIT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let out = ''
    let done = false
    let child
    try {
      child = spawn('git', args, { cwd, env: process.env })
    } catch (error) {
      resolve({ code: -1, out: String(error) })
      return
    }
    const timer = setTimeout(() => {
      if (done) return
      done = true
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      resolve({ code: -1, out: `${out}\n[dsh-base-plugin] git ${args.join(' ')} timed out` })
    }, timeoutMs)
    const onData = (chunk) => { out += String(chunk) }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ code: -1, out: `${out}\n[dsh-base-plugin] cannot spawn git: ${error.message}` })
    })
    child.on('close', (code) => {
      if (done) return
      done = true
      clearTimeout(timer)
      // RAW output — porcelain -z records start with a status XY field that
      // may begin with a space (" M path"); trimming here would corrupt the
      // first record. Callers trim where a human-readable single line is
      // wanted.
      resolve({ code: code ?? -1, out })
    })
  })
}

/** Probe the git binary once per process (cached, includes negative). */
let gitAvailableCache = undefined

/** Whether a `git` binary is spawnable on this host. */
export async function gitAvailable() {
  if (gitAvailableCache !== undefined) return gitAvailableCache
  const probe = await runGit(['--version'], process.env.HOME ?? '/')
  gitAvailableCache = probe.code === 0
  return gitAvailableCache
}

/**
 * Ensure `cwd` sits in a usable repo with at least one commit. Auto-init
 * (with a baseline commit) covers requirement: git present + uninitialized
 * workspace → initialize. Never nests a repo inside an existing one.
 *
 * Serialized per cwd by an in-process mutex: two concurrent status calls on
 * an un-initialized workspace would otherwise both run `git init` + baseline
 * commit and race on the index lock.
 * @returns { available, createdBaseline, root } or { available: false }.
 */
const repoMutexes = new Map()

/** Run `fn` exclusively per key (queued, in-process). */
function withMutex(key, fn) {
  const previous = repoMutexes.get(key) ?? Promise.resolve()
  const next = previous.then(fn, fn)
  repoMutexes.set(key, next.catch(() => {}))
  return next
}

let ensureRepoImpl = async (cwd) => {
  if (!(await gitAvailable())) return { available: false }
  const inside = await runGit(['rev-parse', '--is-inside-work-tree'], cwd)
  let createdBaseline = false
  if (inside.code !== 0 || inside.out.trim() !== 'true') {
    const init = await runGit(['init'], cwd)
    if (init.code !== 0) throw new Error(`dsh-base-plugin: git init failed: ${init.out.slice(-500)}`)
    createdBaseline = true
  } else {
    const head = await runGit(['rev-parse', '--verify', 'HEAD'], cwd)
    if (head.code !== 0) createdBaseline = true // repo exists, unborn HEAD
  }
  if (createdBaseline) {
    await runGit(['add', '-A'], cwd, BASELINE_TIMEOUT_MS)
    // --allow-empty: a brand-new EMPTY workspace must still get its baseline
    // commit, or "nothing to commit" fails the very first status call.
    const commit = await runGit(
      [...BASELINE_IDENTITY, 'commit', '--allow-empty', '-m', 'chore: baseline snapshot by dsh-base-plugin'],
      cwd,
      BASELINE_TIMEOUT_MS,
    )
    if (commit.code !== 0) {
      throw new Error(`dsh-base-plugin: baseline commit failed: ${commit.out.slice(-500)}`)
    }
  }
  const root = await runGit(['rev-parse', '--show-toplevel'], cwd)
  if (root.code !== 0) throw new Error(`dsh-base-plugin: git rev-parse failed: ${root.out.slice(-500)}`)
  return { available: true, createdBaseline, root: root.out.trim().split('\n')[0] }
}

export function ensureRepo(cwd) {
  return withMutex(cwd, () => ensureRepoImpl(cwd))
}

/** Classify one porcelain XY pair into the UI's kind buckets. */
function kindOf(xy) {
  if (xy === '??') return 'new'
  const [x, y] = xy
  if (x === 'A' || y === 'A') return 'new'
  if (x === 'R' || y === 'R') return 'renamed'
  if (x === 'D' || y === 'D') return 'deleted'
  return 'modified'
}

/** Parse `status --porcelain=v1 -z` output (rename/copy records carry a second NUL field). */
function parsePorcelainZ(out) {
  const parts = out.split('\0')
  const entries = []
  for (let i = 0; i < parts.length;) {
    const record = parts[i]
    if (record === '') { i += 1; continue }
    const xy = record.slice(0, 2)
    const path = record.slice(3)
    i += 1
    let from = null
    if (xy[0] === 'R' || xy[0] === 'C') {
      from = parts[i] ?? null
      i += 1
    }
    entries.push({ xy, path, from, kind: kindOf(xy) })
  }
  return entries
}

/**
 * Workspace file changes: ensureRepo (auto-init as configured) then a
 * pathspec-scoped status. Entries are `{ xy, path, from, kind }` with kind
 * one of new/modified/deleted/renamed; `stats` carries per-kind counts.
 */
/**
 * Parse one `--numstat` line; handles the rename "old => new" path form.
 * Binary files report `-` for both; they map to null (rendered as "bin").
 */
function parseNumstatLine(line) {
  const parts = line.split('\t')
  const [added, deleted] = parts
  const rawPath = parts.slice(2).join('\t')
  // Rename records may print "old => new"; the entry is keyed by the new path.
  const path = rawPath.includes('=> ') ? rawPath.slice(rawPath.indexOf('=> ') + 3) : rawPath
  return {
    path,
    added: /^\d+$/.test(added) ? Number(added) : null,
    deleted: /^\d+$/.test(deleted) ? Number(deleted) : null,
  }
}

/** Chunk an array into pages (argv safety for very large workspaces). */
function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Workspace file changes with per-file line counts and last-commit time. */
export async function gitStatus(cwd) {
  const repo = await ensureRepo(cwd)
  if (repo.available !== true) return repo
  // -uall lists untracked FILES (a new directory's contents), not the
  // collapsed "dir/" entry a per-file diff view cannot open.
  const status = await runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', '.'], cwd)
  if (status.code !== 0) {
    throw new Error(`dsh-base-plugin: git status failed: ${status.out.slice(-500)}`)
  }
  const entries = parsePorcelainZ(status.out)
  const stats = { new: 0, modified: 0, deleted: 0, renamed: 0 }
  for (const entry of entries) stats[entry.kind] += 1

  // Line counts: batched numstat against HEAD covers every tracked entry.
  // A RENAME entry must be queried on BOTH sides — filtering by the new path
  // alone misses the old path's deletions; the entry's counts are the SUM.
  // Paths go in chunks so a workspace with thousands of changes cannot blow
  // the argv budget.
  const queryPaths = new Set()
  for (const entry of entries) {
    if (entry.xy === '??') continue
    queryPaths.add(entry.path)
    if (entry.from !== null && entry.from !== undefined) queryPaths.add(entry.from)
  }
  const counts = new Map() // path → parseNumstatLine result
  for (const page of chunk([...queryPaths], 200)) {
    const numstat = await runGit(['diff', 'HEAD', '--numstat', '--', ...page], repo.root)
    if (numstat.code !== 0) continue
    for (const line of numstat.out.split('\n')) {
      if (line === '') continue
      const parsed = parseNumstatLine(line)
      if (parsed.path !== '') counts.set(parsed.path, parsed)
    }
  }
  for (const entry of entries) {
    if (entry.xy === '??') continue
    const mine = counts.get(entry.path)
    if (mine === undefined) continue
    entry.added = mine.added
    entry.deleted = mine.deleted
    const fromSide = entry.from !== null && entry.from !== undefined ? counts.get(entry.from) : undefined
    if (fromSide !== undefined) {
      // Rename: aggregate both sides; binary on either side stays binary.
      if (entry.added === null || fromSide.added === null) {
        entry.added = null
        entry.deleted = null
      } else {
        entry.added += fromSide.added
        entry.deleted += fromSide.deleted
      }
    }
  }
  // Untracked entries: counted in-process (read + line count) — a spawn per
  // file would melt on workspaces with many new files. Binary (NUL byte) or
  // files past the size cap map to nulls, matching numstat's "-  -".
  await Promise.all(entries.map(async (entry) => {
    if (entry.xy !== '??') return
    try {
      const buf = await readFile(join(repo.root, entry.path))
      if (buf.length > 1024 * 1024 || buf.includes(0)) {
        entry.added = null
        entry.deleted = null
        return
      }
      const text = buf.toString('utf8')
      entry.added = text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
      entry.deleted = 0
    } catch {
      entry.added = null
      entry.deleted = null
    }
  }))

  // Totals (binary entries contribute nothing).
  const lines = { added: 0, deleted: 0, binary: 0 }
  for (const entry of entries) {
    if (entry.added === null || entry.deleted === null) {
      if (entry.added === null) lines.binary += 1
      continue
    }
    lines.added += entry.added
    lines.deleted += entry.deleted
  }

  // Per-file modification time (disk mtime, ISO string). Deleted entries
  // have no file on disk — mtime stays null and the UI omits the chip.
  await Promise.all(entries.map(async (entry) => {
    try {
      const info = await stat(join(repo.root, entry.path))
      entry.mtime = info.mtime.toISOString()
    } catch {
      entry.mtime = null
    }
  }))

  // Last commit time (the baseline or any user commit since) — the page's
  // temporal anchor.
  const log = await runGit(['log', '-1', '--format=%cI'], repo.root)
  const lastCommitAt = log.code === 0 ? log.out.trim() : ''

  return { ...repo, entries, stats, lines, total: entries.length, lastCommitAt }
}

/** Reject path shapes that could escape the workspace (must be relative, no `..`). */
function safeRelative(file) {
  return typeof file === 'string' && file !== '' && !file.startsWith('/')
    && !file.split('/').includes('..')
}

/**
 * Unified diff for one file. Tracked files diff against HEAD (staged and
 * unstaged together); untracked files diff against /dev/null so the whole
 * content shows as additions. Binary markers pass through as text.
 *
 * `file` comes from a porcelain entry, so it is REPO-ROOT-relative; every
 * git call here therefore runs with the repo root as cwd (the workspace may
 * be nested deeper inside the repo).
 */
export async function gitFileDiff(cwd, file) {
  if (!safeRelative(file)) throw new Error('dsh-base-plugin: invalid file path')
  const repo = await ensureRepo(cwd)
  if (repo.available !== true) throw new Error('dsh-base-plugin: git is unavailable')
  const root = repo.root
  const tracked = await runGit(['ls-files', '--error-unmatch', '--', file], root)
  if (tracked.code === 0) {
    const diff = await runGit(['diff', 'HEAD', '--', file], root)
    if (diff.code !== 0) {
      throw new Error(`dsh-base-plugin: git diff failed: ${diff.out.slice(-500)}`)
    }
    return { diff: diff.out.trim() }
  }
  // Untracked: --no-index exits 1 when differences exist (our success case).
  const diff = await runGit(['diff', '--no-index', '--', '/dev/null', file], root)
  if (diff.code !== 0 && diff.code !== 1) {
    throw new Error(`dsh-base-plugin: git diff failed: ${diff.out.slice(-500)}`)
  }
  return { diff: diff.out.trim() }
}
