# dsh-base-plugin

English | [中文](README.zh.md)

A base plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): a Plugin
Market, MCP server management, and skill browsing — added to Settings without touching DSH source
code. UI text follows the DSH language setting (中文 / English), and every page adapts to
phone-width screens (see Mobile below).

## Features

1. **Plugin Market** — a new tab inside Settings → Plugins. Discovery-first search over the
   ecosystem-certified set (`topic:dsh-plugin` + dsh-named): your term hits GitHub directly AND
   soft-matches names/descriptions locally, so real plugins no longer vanish behind literal
   keyword misses (Chinese terms find Chinese-described plugins); empty search browses the top
   100 certified plugins; only when nothing certified matches does a legacy name-search fallback
   run (unbadged rows). Certified rows carry a "topic verified" badge. One-click install
   (`pnpm add` into the web profile + composition rows written into the managed block of
   `~/.dsh/cordis.patch.yml`), validation that the result is really a DSH plugin (auto-rollback
   otherwise), and one-click uninstall.
2. **MCP** — a new Settings page. Edit the MCP server list directly as YAML (stdio or Streamable
   HTTP per entry); saving writes the managed block of `~/.dsh/cordis.patch.yml` and hot-loads
   through the official `@deepseek-ai/dsh-mcp-client` — no restart needed. Live status per server
   (fiber phase + registered tool count); hand-added rows are listed read-only. A **health panel**
   aggregates every session log's MCP tool traffic (grouped by the `mcp__<server>__` prefix):
   per-server call count, error rate (red ≥30%, amber ≥10%), average latency (call→result wall
   time paired by callId), last-used time, and per-tool call counts — the data to answer "is this
   server worth keeping". Incremental: per-session seq cursors plus a cross-call aggregate cache;
   a call whose result has not landed yet is not counted until it does (and pairs correctly across
   refresh boundaries); deleting a session resets the fold.
3. **Skills** — a new Settings page. List registered skills with a content viewer; skills under
   `~/.dsh/skills/` can be created, edited, and deleted right on the page (writes are hot-registered
   by dsh's watched skill roots). Deployment-shipped preset skills (not user-editable) are hidden
   with a count note.
4. **System Prompt** — a new Settings page. Edit the global persona (order-0 system prompt
   section, effective for every session). The persona override row is always present in the
   managed block — empty by default, which neutralizes the deployment bundle's own default
   persona — and saves hot-load. `{{model}}`/`{{cwd}}` variables are supported.
5. **Service Stop/Restart** — compact buttons beside Settings at the sidebar foot. Stop asks
   the launcher for a graceful exit (sessions flush first). Restart spawns a detached helper
   that re-execs the same invocation (execArgv included) once the old pid is gone; the page
   polls and reloads itself when the new process answers.
6. **File Changes panel** — an entry in the session header's top-right ⋯ menu
   opening a right-docked panel with the session workspace's git changes
   (new/modified/deleted/renamed with per-file colored diffs, strictly
   read-only). The menu entry appears only when a git binary exists; a
   workspace without a repo is auto-initialized with a baseline commit
   (inline identity, never touches global git config), so changes are always
   relative to a baseline.

7. **Terminal panel** — an entry in the session header's top-right ⋯ menu
   opening a right-docked panel with multiple PTY terminals in the session
   workspace (new/close per terminal, line input with Enter to run, Ctrl+C
   interrupt, streaming output). Built on the official `terminals` service;
   requires the host composition to mount `@deepseek-ai/dsh-terminal` and a
   backend row (`@deepseek-ai/dsh-terminal-bash`); the entry is hidden
   otherwise.

   Both panels dock as a REAL column on the right of the chat (not a
   floating sheet): while open, the whole app frame is squeezed by the
   panel width, so the chat column genuinely narrows and nothing is
   covered. The left edge drags to resize (the frame follows live); the
   panel's TOP bar carries the breadcrumb (session title › active panel)
   and the close button, with a horizontal tool nav row beneath it —
   switching between File Changes, Terminal, and Monitor in place. Esc or
   the close button dismisses it.

   **Monitor** is the third panel in the same dock, split into two tabs —
   **Overview** (the session's vital figures at a glance) — turns & steps, LLM vs tool wall time, average
   first-token latency, decode throughput (tok/s), cache-hit rate, and
   input/output token totals (reasoning tokens too when present). Stats
   come from the official `sessionStats` whole-log projection
   (`@deepseek-ai/dsh-session-stats` — live sessions via the projection
   registry, cold ones via the projection cache), so figures match the
   composer stats line exactly and survive paging/compaction; token totals
   fold incrementally from the durable log (a per-session seq cursor makes
   the 5-second auto-refresh cheap). Two more cards: **Jobs** (the official
   `jobs` registry, agent-scoped like the session/jobs frames — live
   sessions only, since the registry is process-local) and **Subagents**
   (the official `subagents` registry's durable descendant tree, indented
   by depth, each row showing mode, running state, and mini figures —
   turns·steps plus output tokens — folded incrementally through the same
   cursor machinery; unreadable child logs show as gray rows). The Overview tab also carries a **context-pressure bar** (the official
   `contextPressure` projection: projected next-prompt tokens ÷ the route's
   context window — amber at 70%, red at 85%) plus a composition legend from
   the official `contextBreakdown` projection (system prompt / tools /
   messages — heuristic estimates, deliberately NOT summed into the bar: the
   official contract keeps them on a different denominator than the
   provider-anchored ratio). The entry appears when the
   core data sources are mounted; a missing optional service hides its card
   only. The tab strip reuses the dock's tool-nav
   button style.

8. **Usage** — a Settings section right after Models (order 11): aggregated token usage over
   every session log (input / cache-read / cache-write / output / reasoning — exact
   adapter-reported counts), a per-model table with request counts and estimated cost under an
   editable USD/1M-token price table (DeepSeek reference prices built in; unpriced models show
   "—"), a 31-day usage trend, and the top sessions by usage. Scans are incremental (a
   per-session last-seq cache in `$DSH_HOME/dsh-usage-cache.json`).

9. **Sessions** — a new Settings page. Every persisted session in one list
   (title, project path, workspace, created time, live/archived badges) with
   filter chips (All / Live / Archived / Ghosts), a search box
   (title / id / path), and a destructive per-row Delete (confirmation
   dialog, refuses live sessions — close first). Deletion first walks the
   official teardown channel (`agents.resume()` + dispose) so every connected
   client drops the sidebar row immediately — no page refresh needed — then
   removes, in a crash-idempotent order: workspace accounting, the
   projection-cache row, the durable log directory itself (jsonl backend
   only), and best-effort the archive-set entry. Ghost rows (archived ids
   whose log is already gone) delete as a pure metadata sweep. Deleting a
   session destroys its full conversation log and cannot be undone. Each row
   also exports: **Export MD** (a readable Markdown transcript folded
   host-side — user prompts, assistant replies with collapsed reasoning,
   tool calls paired with results, injected context as collapsed blocks) and
   **Export Zip** (the official `GET /api/session.export` endpoint — the
   complete durable log plus attachment artifacts; the plugin adds no route,
   the browser downloads it directly), plus a **Time machine** action: list
   the session's completed turns (each with a preview of its first human
   prompt) and fork a copy from any turn through the official
   `sessions.fork(boundary)` primitive — the child session appears in every
   connected client's sidebar immediately. Forking needs the source session
   live in this process (the store's contract); cold sessions get a hint to
   open them first.

10. **Mobile Access** — a new Settings page. Use the full DSH UI from your
    phone on the LAN: an authenticated reverse proxy starts on its own port
    (the main dsh server keeps listening on loopback only). Scan the QR →
    enter a one-time pairing code (single-use, 10-minute lifetime, per-IP
    exponential backoff) → receive an HttpOnly device cookie (HMAC-signed,
    device-bound, 30-day sliding renewal). Paired devices can be revoked
    individually; "Rotate key" disconnects every device at once
    (loopback-only action). Off by default. Transport is plain HTTP on the
    LAN — pair over an encrypted overlay like Tailscale when remote.

    The proxy front-ends both HTTP and WebSocket traffic (dsh's event
    channels need the upgrade), strips cross-origin headers the upstream
    would reject, and relays the upstream 101 handshake byte-for-byte. The
    HTML shell is served with `cache-control: no-store` and carries one
    small polyfill: `crypto.randomUUID` (browsers expose it only in secure
    contexts — `http://127.0.0.1` desktop qualifies, a LAN IP does not —
    and dsh's client mints an RPC id with it on every call, so phones
    without the shim get a dead session list).

    The Mobile Access settings page also shows a "Current address" card —
    every reachable LAN URL for this machine (live `os.networkInterfaces()`,
    never hardcoded) with a copy button. Virtual adapter placeholders a
    phone can never reach are filtered (VPN TUN 198.18.0.0/15, link-local
    169.254.0.0/16, CGNAT 100.64.0.0/10), so the pairing QR and the card
    only ever show real candidates.

11. **Message rail** — a slim rail of colored ticks beside the conversation
    scrollbar (desktop only): blue = user messages (incl. steering), green =
    AI replies, positioned proportionally to their flow offset. Click a tick
    to jump to that message; hover for a content-only excerpt (clock, run
    stats, and button labels are structurally skipped); the tick nearest the
    viewport stays highlighted while scrolling; the rail hides while the
    session More menu is open and on touch/narrow viewports (<760px).
    The harness's own themed scrollbar skin is left untouched.

12. **Notifications** — a new Settings page. Push dsh events to your phone through
    Bark (iOS), ntfy (cross-platform), or a generic webhook (Feishu/DingTalk/WeCom
    custom bots and anything that accepts a JSON POST). Three event sources, all
    official host services: agent **turn finished** (`session/event` filtered to
    `turn/end` — the long-task-done signal), **background job settled**
    (`jobs.onJobDone`, failures included), and **approval waiting** (the
    `approval/request` waterfall: the bridge notifies, then passes through — the
    outcome itself is not re-notified), and **context nearly full** (the
    `contextPressure` projection crossing 85% — hysteresis: one notice per
    crossing, re-notice only every +10 points, re-armed below 70%). Per-event toggles, a one-click test send,
    and a mute window (1h / cancel). Delivery is best-effort with a 10s timeout:
    a failing channel logs once and never blocks the event flow. Listeners live
    on the plugin fiber (removed on unload); settings are re-read per event, so
    saving takes effect immediately.

### Mobile (phone-width) adaptation

All of this plugin's own surfaces reflow below 760px: touch-sized buttons,
horizontally scrollable wide tables (usage/price), a full-screen tool dock
(file changes / terminal) instead of the resizable side column,
viewport-scaled QR, the message rail hidden entirely (a pointer-precision
affordance), and the host Settings dialog itself — a fixed 800px desktop
modal with a 188px left nav — is re-tagged into a full-screen sheet with a
top horizontally-scrolling nav strip (a DOM attribute patch, since the
shell's class names are CSS-module hashed; harness source stays untouched).

## Security notes

- The state file `$DSH_HOME/dsh-base-plugin.json` carries the mobile-access
  HMAC secret and is written `0o600` (pre-existing files are tightened at
  boot). Parity with dsh's own `.credentials.yaml`.
- Pairing: 8-char code (~40 bits), single-use, 10 minutes, per-IP
  exponential backoff (2^n s, capped 10 min). Cookies are HttpOnly +
  SameSite=Lax, HMAC-SHA256 signed, device-bound, 30-day sliding renewal.
- The proxy binds `0.0.0.0` by design (LAN access); the upstream dsh server
  must stay loopback-only. Rotate the key to instantly invalidate every
  issued cookie.
- Process spawning is shell-free (`spawn` with argv arrays only); skill
  names are validated against the kebab-case contract before any path is
  joined (no traversal); JSON request bodies are capped at 1 MB.
- WebSocket upgrade sockets have error/close handlers attached before the
  handshake gap — a phone radio reset mid-upgrade can never surface an
  uncaught `'error'` event (which would take the whole dsh host down).

## Development: split sources

The browser half is PROTOCOL-CONSTRAINED to a single file (one bundle, one
factory per package), but its content is authored split: `src/*.js` (22
modules, each with a doc header) are concatenated in a fixed order by
`scripts/build-client.mjs` into `client.js` (which carries a GENERATED stamp).
Edit `src/`, then rebuild:

```bash
pnpm build:client     # regenerate client.js (also syntax-checked)
pnpm check:client     # verify sync (a pre-commit hook auto-rebuilds anyway)
```

## How it works

- The **node half** (`index.js` entry + `lib/` feature modules: `routes`, `market`, `installer`,
  `patch`, `git`, `skills-io`, `sessions`, `usage`, `mobile/*` (`server`, `auth`, `qr` + vendored
  QR, `pwa`), `status`, `lifecycle`, `notify`, `export`, `env`, `state`, `pnpm`, `terminals-api`) serves
  `/dsh-base-plugin/api/*` on the DSH web server: state, market search, install/uninstall, MCP
  config save, skills list/detail/create/edit/delete, session inventory/delete, mobile-access
  control (toggle/QR/devices/revoke/rotate) plus the LAN pairing proxy itself, service
  stop/restart, git changes, and PTY terminal streaming.
- The managed block also composes the official PTY rows (`@deepseek-ai/dsh-terminal` + `dsh-terminal-bash`) so the Terminal panel works wherever this plugin is installed.
- Authoritative state lives in `$DSH_HOME/dsh-base-plugin.json`; the block between `# >>> dsh-base-plugin managed`
  markers inside `~/.dsh/cordis.patch.yml` is always regenerated from it (edits outside the markers
  are preserved byte-exact). dsh hot-watches that file, so changes take effect without a restart.
- The **browser half** (`client.js`) registers UI through the standard slots
  (`settings.plugins.tab`, `settings.section`) and localizes through the DSH locale service.

## Install (deployment owner)

```bash
# in the dsh web profile (~/.dsh/profiles/web)
pnpm add /path/to/dsh-base-plugin
# then add to ~/.dsh/profiles/web/cordis.patch.yml (NOT ~/.dsh/cordis.patch.yml —
# the home patch applies to every profile, and dsh-base-plugin resolves only where it
# is a dependency):
#   - insert:
#       - id: dsh-base-plugin
#         name: dsh-base-plugin
```

Set `GITHUB_TOKEN` in the dsh process environment to raise the market's GitHub API rate limit.

## License

MIT
