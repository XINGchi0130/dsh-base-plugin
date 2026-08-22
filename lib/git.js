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
 *   baseline. Status itself is scoped to the workspace path (`.`), so a
 *   workspace nested inside a larger repo shows only its own subtree.
 * - `gitFileDiff(cwd, file)` returns a unified diff vs HEAD; untracked
 *   files fall back to `git diff --no-index /dev/null <file>` so brand-new
 *   AI files still show their full content as additions.
 *
 * Performance shape (v0.5.3):
 *  - Repo probing is ONE `rev-parse` per call (inside-work-tree + HEAD
 *    verification combined) plus the toplevel query; the common
 *    already-initialized path costs two spawns, not four.
 *  - `--numstat` pages run in PARALLEL (independent read-only diffs), so a
 *    workspace with thousands of changes no longer pays serial spawn time.
 *  - Untracked line counting and mtime sampling share one bounded worker
 *    pool (no `Promise.all` fan-out of unbounded `readFile`s on huge new
 *    workspaces) and one pass over the entries.
 *  - Diff output is capped (512 KiB, with a visible truncation marker):
 *    the client renders one DOM node per diff line, so an unbounded diff
 *    would freeze the tab rather than inform it.
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
/** Default output bound for status/numstat probes (records, not diffs). */
const MAX_OUTPUT_DEFAULT = 8 * 1024 * 1024
/** Diff texts feed one-DOM-node-per-line rendering — keep them bounded. */
const MAX_OUTPUT_DIFF = 512 * 1024
/** Worker pool width for file reads and stat sampling. */
const IO_POOL = 32
/** Inline identity for the baseline commit; never touches global git config. */
const BASELINE_IDENTITY = ['-c', 'user.name=dsh-base-plugin', '-c', 'user.email=dsh@local']

/**
 * Run `git <args>` in a directory; resolves { code, out } (stdout+stderr).
 * Output beyond `maxOutputChars` kills the process and resolves with a
 * visible truncation marker — callers never see silent mid-stream cuts.
 */
function runGit(args, cwd, timeoutMs = GIT_TIMEOUT_MS, maxOutputChars = MAX_OUTPUT_DEFAULT) {
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
    const finish = (code, suffix = '') => {
      if (done) return
      done = true
      clearTimeout(timer)
      // RAW output — porcelain -z records start with a status XY field that
      // may begin with a space (" M path"); trimming here would corrupt the
      // first record. Callers trim where a human-readable single line is
      // wanted.
      resolve({ code, out: `${out}${suffix}` })
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      finish(-1, `\n[dsh-base-plugin] git ${args.join(' ')} timed out`)
    }, timeoutMs)
    const onData = (chunk) => {
      out += String(chunk)
      if (out.length <= maxOutputChars) return
      try { child.kill('SIGKILL') } catch { /* already gone */ }
      finish(-1, '\n[dsh-base-plugin] output truncated (size limit reached)')
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      finish(-1, `\n[dsh-base-plugin] cannot spawn git: ${error.message}`)
    })
    child.on('close', (code) => {
      finish(code ?? -1)
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
 * Probing is one combined rev-parse: `--is-inside-work-tree` prints its
 * answer, then `--verify HEAD` resolves (exit 0) or fails (unborn) — the
 * common initialized-workspace path costs two spawns total, including the
 * toplevel query below.
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

async function ensureRepoImpl(cwd) {
  if (!(await gitAvailable())) return { available: false }
  const probe = await runGit(['rev-parse', '--quiet', '--is-inside-work-tree', '--verify', 'HEAD'], cwd)
  const inside = probe.out.startsWith('true')
  let createdBaseline = false
  if (!inside) {
    const init = await runGit(['init'], cwd)
    if (init.code !== 0) throw new Error(`dsh-base-plugin: git init failed: ${init.out.slice(-500)}`)
    createdBaseline = true
  } else if (probe.code !== 0) {
    // Repo exists with an UNBORN HEAD — the enclosing repo may be a PARENT of
    // the workspace (a `git init`-ed project root, even $HOME). Committing
    // from the nested cwd would baseline the parent's ENTIRE work tree (git
    // ≥2.0 runs `add -A` tree-wide from subdirs). Only baseline when the
    // workspace IS the repo root; a nested unborn parent degrades gracefully
    // (no baseline — the tab shows entries without counts, the existing
    // numstat-miss path) instead of writing a cross-repo commit.
    const toplevel = await runGit(['rev-parse', '--show-toplevel'], cwd)
    if (toplevel.code === 0 && toplevel.out.trim() === cwd) {
      createdBaseline = true
    }
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
 * Parse `git diff --numstat -z` output into path → counts.
 *
 * Why -z: the default tab form abbreviates a subdirectory rename to
 * `sub/{old => new}` — the brace shorthand never matches the porcelain
 * path, so rename rows lost their counts and the workspace totals
 * poisoned themselves into NaN. The -z form is NUL-delimited with
 * VERBATIM paths. Its wire shape (empirically confirmed):
 *
 *   plain:  `<added>\t<deleted>\t<path>` NUL
 *   rename: `<added>\t<deleted>\t` NUL `<old-path>` NUL `<new-path>` NUL
 *           (counts first with an EMPTY path field, then both paths)
 *
 * Rename counts are relative to the rename (a pure move reads 0/0); the
 * old-path field is consumed and skipped — the map is keyed by the new
 * path, exactly what the status entries look up. Binary files report `-`
 * for both counters; they map to null (rendered as "bin").
 */
function parseNumstatZ(out) {
  const counts = new Map()
  const numstatOf = (added, deleted) => ({
    added: /^\d+$/.test(added) ? Number(added) : null,
    deleted: /^\d+$/.test(deleted) ? Number(deleted) : null,
  })
  const chunks = out.split('\0')
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]
    if (chunk === '') continue
    const rename = /^(-|\d+)\t(-|\d+)\t$/.exec(chunk) // empty path field
    if (rename !== null) {
      const newPath = chunks[i + 2] // [i+1] is the old path — skipped
      i += 2
      if (newPath === undefined || newPath === '') continue
      counts.set(newPath, numstatOf(rename[1], rename[2]))
      continue
    }
    const plain = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(chunk)
    if (plain !== null) counts.set(plain[3], numstatOf(plain[1], plain[2]))
  }
  return counts
}

/** Chunk an array into pages (argv safety for very large workspaces). */
function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function pooled(items, limit, worker) {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item)
    }
  })
  await Promise.all(runners)
}

/** Line count for one untracked file: null (binary/oversized/error) or N. */
async function countUntrackedLines(absPath) {
  try {
    const buf = await readFile(absPath)
    if (buf.length > 1024 * 1024 || buf.includes(0)) return null
    const text = buf.toString('utf8')
    return text === '' ? 0 : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
  } catch {
    return null
  }
}

/**
 * Workspace file changes with per-file line counts and last-commit time.
 * See the module comment for the spawn/IO shape; the result contract
 * ({ entries, stats, lines, total, lastCommitAt, root, createdBaseline,
 * available }) is unchanged.
 */
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
  // the argv budget, and the chunks run in parallel (read-only diffs).
  // -z: NUL-delimited verbatim paths — see parseNumstatZ for why the tab
  // form's rename brace shorthand must never be parsed.
  const queryPaths = new Set()
  for (const entry of entries) {
    if (entry.xy === '??') continue
    queryPaths.add(entry.path)
    if (entry.from !== null && entry.from !== undefined) queryPaths.add(entry.from)
  }
  const counts = new Map() // path → parseNumstatZ counts
  const pages = chunk([...queryPaths], 200)
  if (pages.length > 0) {
    const numstats = await Promise.all(pages.map(page =>
      runGit(['diff', 'HEAD', '--numstat', '-z', '--', ...page], repo.root),
    ))
    for (const numstat of numstats) {
      if (numstat.code !== 0) continue
      for (const [path, parsed] of parseNumstatZ(numstat.out)) counts.set(path, parsed)
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

  // One pooled pass does the remaining per-file IO: untracked line counts
  // (bounded reads — no unbounded Promise.all fan-out) and mtime sampling
  // for every entry (deleted files have none — mtime stays null and the UI
  // omits the chip). The last-commit query is independent, so it rides along.
  const logP = runGit(['log', '-1', '--format=%cI'], repo.root)
  await pooled(entries, IO_POOL, async (entry) => {
    if (entry.xy === '??') {
      const counted = await countUntrackedLines(join(repo.root, entry.path))
      entry.added = counted
      entry.deleted = counted === null ? null : 0
    }
    try {
      const info = await stat(join(repo.root, entry.path))
      entry.mtime = info.mtime.toISOString()
    } catch {
      entry.mtime = null
    }
  })

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

  const log = await logP
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
 * content shows as additions. Binary markers pass through as text. Output
 * is capped at {@link MAX_OUTPUT_DIFF} with a visible truncation marker —
 * the client renders one DOM node per line.
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
    const diff = await runGit(['diff', 'HEAD', '--', file], root, GIT_TIMEOUT_MS, MAX_OUTPUT_DIFF)
    if (diff.code !== 0) {
      throw new Error(`dsh-base-plugin: git diff failed: ${diff.out.slice(-500)}`)
    }
    return { diff: diff.out.trim() }
  }
  // Untracked: --no-index exits 1 when differences exist (our success case).
  const diff = await runGit(['diff', '--no-index', '--', '/dev/null', file], root, GIT_TIMEOUT_MS, MAX_OUTPUT_DIFF)
  if (diff.code !== 0 && diff.code !== 1) {
    throw new Error(`dsh-base-plugin: git diff failed: ${diff.out.slice(-500)}`)
  }
  return { diff: diff.out.trim() }
}
