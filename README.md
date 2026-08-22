# dsh-base-plugin

English | [中文](README.zh.md)

An enhancement plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): **plugin market, MCP management, session management, mobile access, notifications, terminal, file changes, prompt optimization** — 12 capabilities delivered entirely through Settings pages and the tools dock, **without touching DSH source code**. Bilingual UI (follows the DSH language setting); every page adapts to phone screens.

## Features

| Feature | Entry | One-liner |
|---|---|---|
| **Plugin Market** | Settings → Plugins | Search GitHub ecosystem-certified plugins; one-click install/uninstall (DSH-plugin validation with auto-rollback) |
| **MCP** | Settings → MCP | Edit the server list as YAML, hot-reloads on save; per-server live status plus a **health panel** (calls / error rate / latency) |
| **Skills** | Settings → Skills | Browse registered skills; create/edit/delete under `~/.dsh/skills/` — writes hot-register instantly |
| **System Prompt** | Settings → System Prompt | Edit the global persona (effective for every session); `{{model}}`/`{{cwd}}` variables; hot-reload on save |
| **Usage** | Settings → Usage | Token totals across every session, per-model cost estimates (editable prices), 31-day trend, top sessions |
| **Sessions** | Settings → Sessions | Every persisted session in one list (filter/search); delete (rows vanish from every sidebar live); export MD/Zip; **time machine** (fork from any turn) |
| **Notifications** | Settings → Notifications | Turn finished / job settled / approval waiting / context nearly full → **browser notifications** (zero-config; the page must stay open — a background tab is fine, catches up on return) / Bark / ntfy / webhook |
| **Mobile Access** | Settings → Mobile Access | Pair by QR on the LAN and use the full DSH UI from your phone (HMAC device cookies + exponential backoff) |
| **File Changes** | session ⋯ menu | Two tabs: **Workspace Changes** (git baseline diff, strictly read-only) + **Operation Log** (AI read/write/bash trail with ±lines and success/failure) |
| **Terminal** | session ⋯ menu | Multiple PTY terminals: Enter to run, Ctrl+C interrupt, streaming output |
| **Monitor** | session ⋯ menu | Three tabs: **Overview** (turns/timing/tokens/context pressure), **Tasks** (background jobs + subagent tree), **System** (CPU/memory/load, pressure-based) |
| **Prompt** | session ⋯ menu | Type a rough idea → the default model rewrites it into a structured prompt; one-click copy |
| Message rail | in-session (automatic) | Slim tick bar beside the scrollbar: blue = user / green = AI messages; click to jump, hover for a preview |
| Service stop/restart | sidebar foot | Graceful exit (sessions flush first); restart reloads in place without a duplicate tab |

All tool panels dock as a REAL column right of the chat (the app frame squeezes — nothing is covered); drag the left edge to resize; switch panels in place.

## Requirements

- A running DeepSeek Harness (DSH) web deployment [TODO: minimum DSH version]
- Node.js ≥ 20 (ships with the DSH host) [TODO: confirmed minimum]
- git (optional — the File Changes panel needs it; the entry auto-hides without)
- pnpm (needed by the Plugin Market installer)

## Quick Start

```bash
# 1. Install into the dsh web profile
cd ~/.dsh/profiles/web
pnpm add /path/to/dsh-base-plugin

# 2. Add the composition row to the PROFILE-level patch (NOT
#    ~/.dsh/cordis.patch.yml — the home patch applies to every profile,
#    while dsh-base-plugin resolves only where it is a dependency)
cat >> cordis.patch.yml <<'EOF'
- insert:
    - id: dsh-base-plugin
      name: dsh-base-plugin
EOF

# 3. Restart dsh web — new pages appear in Settings
```

Set `GITHUB_TOKEN` in the dsh process environment to raise the market's GitHub API rate limit.

## Usage Examples

**Install a market plugin**: Settings → Plugins → Plugin Market tab → search (Chinese or English) → certified rows carry a "topic verified" badge → click Install → composition rows land in the managed block and hot-load.

**Configure an MCP server**: Settings → MCP → in the YAML editor:

```yaml
- transport: stdio
  serverName: my-server
  command: npx
  args: [-y, @some/mcp-server]
```

Saves hot-load; the health panel starts accumulating this server's calls and error rate.

**Fork a session from any turn**: Settings → Sessions → a row's "Time machine" → every completed turn listed → pick one → "Fork here" → the child session appears in every sidebar immediately.

**Optimize a prompt**: session ⋯ menu → Prompt → type a rough idea (Cmd/Ctrl+Enter) → get a structured prompt → one-click copy.

## Project Layout

```
dsh-base-plugin/
├── index.js               # host-half entry: state migration, managed block, route registration, notify/proxy wiring
├── client.js              # browser half (build artifact; single-file protocol constraint)
├── lib/                   # host feature modules
│   ├── routes.js          # /dsh-base-plugin/api/* table dispatcher (single-flight / same-origin / Host allowlist)
│   ├── routes/            # per-domain route modules
│   ├── market.js          # GitHub market search (cache / single-flight / soft matching)
│   ├── installer.js       # pnpm install + id-collision fence + spec allowlist
│   ├── monitor.js         # session monitor data plane (projections + token fold + subagent tree)
│   ├── mcp-health.js      # MCP health aggregation (two-level aggregate + epoch fence)
│   ├── file-ops.js        # operation-log fold (write/edit/read/bash)
│   ├── export.js          # Markdown transcript fold
│   ├── timemachine.js     # turn listing + official fork
│   ├── notify.js          # notification bridge (browser default + Bark/ntfy/webhook + context guard)
│   ├── prompt-optimizer.js# prompt optimizer (official llm service)
│   ├── sessions.js        # session deletion (five-step idempotent) + export/time machine
│   ├── git.js             # baseline/status/diff (numstat -z)
│   ├── sysres.js          # system resource sampling (pressure-based memory)
│   ├── mobile/            # mobile access (proxy/auth/QR/PWA)
│   └── ...
├── src/                   # browser-half sources (25 modules, concatenated into client.js)
├── scripts/
│   ├── build-client.mjs   # build chain (hooks check / ORDER assertion / byte-identical verify)
│   ├── check-hooks.mjs    # React hooks-order static check
│   └── verify-routes.mjs  # route-surface golden snapshot
└── cordis.patch.yml       # this package's composition layer
```

## FAQ

**Empty session list on the phone?**
The mobile proxy ships a `crypto.randomUUID` polyfill (LAN HTTP is not a secure context); if still empty, check that the proxy port is not firewalled.

**Market search rate-limited?**
Without a token, GitHub allows 10 searches/minute. Set `GITHUB_TOKEN` in the dsh process environment and restart.

**Restart opened a duplicate browser tab?**
Fixed (the re-exec appends `--no-open`). Upgrade if you are on an older version.

**File Changes says "no changes"?**
The panel shows the diff **relative to the git baseline** (the last commit) — not a disk inventory. A fully-committed workspace correctly shows empty; click Refresh inside the panel for the latest.

**Operation Log misses files changed via bash?**
By design: the Operation Log covers the AI's write/edit tool trail; bash-made file changes surface in the Workspace Changes (git) tab — the two tabs are complements.

**A removed MCP server came back?**
The managed block is always regenerated from `$DSH_HOME/dsh-base-plugin.json`. Remove servers via the Settings page; never hand-edit the managed block of `cordis.patch.yml` (content outside the markers is yours to edit).

## Security Notes

- The state file is written `0o600` (it carries the HMAC secret), same standard as DSH's own credentials
- Pairing: 8-char code (~40 bits), single-use, per-IP exponential backoff; device cookies are HMAC-SHA256 signed, HttpOnly, 30-day sliding renewal, individually revocable or rotatable all at once
- HTTP boundary: same-origin checks on every method + a loopback Host allowlist (DNS-rebinding defense); shell-free process execution + spec allowlist; kebab-case skill-name validation (no traversal)
- Mobile access transports plain HTTP on the LAN — pair over an encrypted overlay like Tailscale when remote

## Development

The browser half is protocol-constrained to a single file but authored split. After editing `src/`:

```bash
pnpm build:client     # regenerate client.js (hooks check + syntax check included)
pnpm check:client     # verify byte-identical sync (a pre-commit hook auto-rebuilds)
```

The build chain carries three guards: a hooks-order static check, byte-identical src↔artifact comparison, and a route-surface golden snapshot (`node scripts/verify-routes.mjs`).

## How It Works (brief)

- The **host half** (`index.js` + `lib/`) serves `/dsh-base-plugin/api/*` on the DSH web server
- Authoritative state lives in `$DSH_HOME/dsh-base-plugin.json`; the managed block of `~/.dsh/cordis.patch.yml` (between `# >>> dsh-base-plugin managed` markers) is always regenerated from it — dsh hot-watches that file, so changes take effect without a restart
- The **browser half** (`client.js`) registers UI through standard slots and localizes via the DSH locale service
- Statistics / health / operation logs fold incrementally from official services and the durable log (seq cursors + single-flight + epoch fences) — polling is near-zero cost

## License

MIT
