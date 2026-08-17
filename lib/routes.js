/**
 * dsh-base-plugin — the `/dsh-base-plugin/api/*` HTTP surface on the DSH web server.
 *
 * One prefix route with a small method/path dispatcher: state, market
 * search, install/uninstall, MCP config save (+ legacy add/remove), and
 * skills list/detail/save/delete. Mutations are guarded by a same-origin
 * check and a single-flight busy lock (installs/uninstalls).
 * @module dsh-base-plugin/lib/routes
 */
import { getYaml, homePatchPath, resolveProfileDir } from './env.js'
import { gitAvailable, gitFileDiff, gitStatus } from './git.js'
import { installPackage, uninstallPackage } from './installer.js'
import { restartService, serviceInfo, stopService } from './lifecycle.js'
import { marketSearch } from './market.js'
import { commit, serversYaml } from './patch.js'
import { deleteUserSkill, saveUserSkill } from './skills-io.js'
import { deleteSession, listSessions } from './sessions.js'
import { qrSvg } from './mobile/qr.js'
import { networkInterfaces } from 'node:os'
import { createTerminalsApi } from './terminals-api.js'
import { savePrices, scanUsage } from './usage.js'
import { defaultSkillScope, effectivePersona, isShippedPresetSkill, isUserSkill, loaderRows, mcpStatus } from './status.js'
import { loadState, saveState } from './state.js'

// ── busy lock (single-flight for long package operations) ────────────────

let busy = { op: null, since: 0 }

function acquireBusy(op) {
  if (busy.op !== null) return false
  busy = { op, since: Date.now() }
  return true
}

function releaseBusy() {
  busy = { op: null, since: 0 }
}

// ── http helpers ─────────────────────────────────────────────────────────

/** Read a JSON request body (max 1 MiB). */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 1024 * 1024) {
        reject(new Error('dsh-base-plugin: request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve(text === '' ? {} : JSON.parse(text))
      } catch (error) {
        reject(new Error(`dsh-base-plugin: invalid JSON body: ${String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

/** JSON response helper. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** Minimal same-origin check for state-changing requests. */
function sameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true // same-origin fetch/curl without Origin
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

// ── MCP config normalization ─────────────────────────────────────────────

const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** Validate and normalize one MCP server entry (stdio or streamable-http). */
export function normalizeMcpServer(input) {
  if (input === null || typeof input !== 'object') throw new Error('dsh-base-plugin: body must be an object')
  const serverName = String(input.serverName ?? '').trim()
  if (!SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error('dsh-base-plugin: serverName must match [A-Za-z0-9_-]{1,32}')
  }
  const transport = input.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
  if (transport === 'stdio') {
    const command = String(input.command ?? '').trim()
    if (command === '') throw new Error('dsh-base-plugin: command is required for stdio transport')
    const server = { transport, serverName, command }
    if (Array.isArray(input.args)) server.args = input.args.map(a => String(a))
    if (server.args !== undefined && server.args.length === 0) delete server.args
    if (input.env !== null && typeof input.env === 'object' && !Array.isArray(input.env)) {
      const env = {}
      for (const [k, v] of Object.entries(input.env)) env[String(k)] = String(v)
      if (Object.keys(env).length > 0) server.env = env
    }
    return server
  }
  const url = String(input.url ?? '').trim()
  if (!/^https?:\/\//.test(url)) throw new Error('dsh-base-plugin: url must start with http:// or https://')
  const server = { transport, serverName, url }
  if (input.headers !== null && typeof input.headers === 'object' && !Array.isArray(input.headers)) {
    const headers = {}
    for (const [k, v] of Object.entries(input.headers)) headers[String(k)] = String(v)
    if (Object.keys(headers).length > 0) server.headers = headers
  }
  return server
}

// ── route registration ───────────────────────────────────────────────────

/**
 * Verify a client-supplied `cwd` is a real session workspace. The git and
 * terminal endpoints would otherwise happily inspect or spawn shells in ANY
 * absolute directory on the host; the sessions store is the trusted source.
 * Best-effort: when the sessions service is absent the check passes (the
 * composition owns that decision), but a present store with no matching cwd
 * rejects.
 */
function assertSessionCwd(ctx, cwd) {
  if (typeof cwd !== 'string' || cwd === '' || !cwd.startsWith('/')) {
    throw new Error('dsh-base-plugin: cwd must be an absolute path')
  }
  const sessions = ctx.get('sessions')
  if (sessions === undefined || typeof sessions.list !== 'function') return
  for (const session of sessions.list()) {
    const header = session?.header
    if (typeof header?.cwd === 'string' && header.cwd === cwd) return
  }
  throw new Error('dsh-base-plugin: cwd is not a known session workspace')
}

/**
 * Register the `/dsh-base-plugin/api/*` routes on the web server. The webServer
 * service is a hard inject dependency, so this always runs with it present.
 */
export function registerRoutes(ctx, mobileControls) {
  const ensureAuth = mobileControls.ensureAuth
  const webServer = ctx.webServer
  const terminalApi = createTerminalsApi(ctx)

  const handled = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const path = url.pathname
    const method = req.method ?? 'GET'

    if (!path.startsWith('/dsh-base-plugin/api/')) return false

    if (method !== 'GET' && !sameOrigin(req)) {
      sendJson(res, 403, { ok: false, error: 'cross-origin request rejected' })
      return true
    }

    try {
      // GET /dsh-base-plugin/api/state — everything the pages need at mount.
      if (path === '/dsh-base-plugin/api/state' && method === 'GET') {
        const state = loadState()
        sendJson(res, 200, {
          ok: true,
          value: {
            profileDir: resolveProfileDir(ctx),
            homePatch: homePatchPath(),
            plugins: state.plugins.map(p => ({ name: p.name, spec: p.spec })),
            mcpServers: mcpStatus(ctx, state),
            mcpYaml: serversYaml(state.mcpServers),
            persona: state.persona,
            effectivePersona: effectivePersona(ctx),
            busy: busy.op,
            hasToken: process.env.GITHUB_TOKEN !== undefined && process.env.GITHUB_TOKEN !== '',
          },
        })
        return true
      }

      // GET /dsh-base-plugin/api/market?q=...&sort=default|stars|updated|name
      if (path === '/dsh-base-plugin/api/market' && method === 'GET') {
        const q = url.searchParams.get('q') ?? ''
        const result = await marketSearch(q, url.searchParams.get('sort') ?? 'default')
        const state = loadState()
        const installed = new Set([
          ...state.plugins.map(p => p.name),
          ...loaderRows(ctx).map(r => r.moduleName),
        ])
        sendJson(res, 200, {
          ok: true,
          value: {
            ...result,
            items: result.items.map(item => ({ ...item, installed: installed.has(item.name) })),
          },
        })
        return true
      }

      // GET /dsh-base-plugin/api/skills — list (deployment-shipped preset skills hidden)
      if (path === '/dsh-base-plugin/api/skills' && method === 'GET') {
        const skills = ctx.get('skills')
        if (skills === undefined) {
          sendJson(res, 200, { ok: true, value: { available: false, skills: [], hiddenCount: 0 } })
          return true
        }
        const scope = await defaultSkillScope(ctx)
        const list = await skills.list(scope === undefined ? {} : { scope })
        const visible = []
        let hiddenCount = 0
        for (const skill of list) {
          if (isShippedPresetSkill(skill)) {
            hiddenCount += 1
            continue
          }
          visible.push({
            name: skill.name,
            description: skill.description ?? '',
            whenToUse: typeof skill.whenToUse === 'string' ? skill.whenToUse : '',
            provider: skill.provider ?? '',
            writable: isUserSkill(skill),
          })
        }
        sendJson(res, 200, {
          ok: true,
          value: { available: true, skills: visible, hiddenCount, canCreate: true },
        })
        return true
      }

      // GET /dsh-base-plugin/api/skills/detail?name=...
      if (path === '/dsh-base-plugin/api/skills/detail' && method === 'GET') {
        const skills = ctx.get('skills')
        const skillName = url.searchParams.get('name') ?? ''
        if (skills === undefined) {
          sendJson(res, 200, { ok: true, value: null })
          return true
        }
        const scope = await defaultSkillScope(ctx)
        const definition = await skills.get(skillName, scope === undefined ? {} : { scope })
        if (definition === undefined) {
          sendJson(res, 200, { ok: true, value: null })
          return true
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            name: definition.name,
            description: definition.description ?? '',
            content: definition.content ?? '',
            path: typeof definition.path === 'string' ? definition.path : '',
            provider: definition.provider ?? '',
          },
        })
        return true
      }

      // POST /dsh-base-plugin/api/skills/save { name, description, content, existing? }
      if (path === '/dsh-base-plugin/api/skills/save' && method === 'POST') {
        const body = await readJsonBody(req)
        const result = saveUserSkill(body)
        sendJson(res, 200, { ok: true, value: result })
        return true
      }

      // POST /dsh-base-plugin/api/skills/delete { name }
      if (path === '/dsh-base-plugin/api/skills/delete' && method === 'POST') {
        const body = await readJsonBody(req)
        const result = deleteUserSkill(body?.name)
        sendJson(res, 200, { ok: true, value: result })
        return true
      }

      // POST /dsh-base-plugin/api/prompt { persona } — set/clear the global persona
      // override. Empty/whitespace text clears the override (deployment
      // default persona back in effect). Hot-loads via the managed block.
      if (path === '/dsh-base-plugin/api/prompt' && method === 'POST') {
        const body = await readJsonBody(req)
        const raw = typeof body.persona === 'string' ? body.persona : ''
        if (raw.length > 64 * 1024) throw new Error('dsh-base-plugin: persona text exceeds 64 KiB')
        const persona = raw.replace(/\s+$/, '')
        const state = loadState()
        state.persona = persona
        commit(state)
        sendJson(res, 200, { ok: true, value: { persona, active: persona.trim() !== '' } })
        return true
      }

      // ── terminals (conversation Terminal tab) ───────────────────────────

      // GET /dsh-base-plugin/api/terminal/available — terminals service mounted?
      if (path === '/dsh-base-plugin/api/terminal/available' && method === 'GET') {
        sendJson(res, 200, { ok: true, value: { available: terminalApi.available() } })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/open { sessionId, name, cwd }
      if (path === '/dsh-base-plugin/api/terminal/open' && method === 'POST') {
        const body = await readJsonBody(req)
        const cwd = String(body.cwd ?? '')
        if (cwd !== '') assertSessionCwd(ctx, cwd)
        const value = await terminalApi.open(String(body.sessionId ?? ''), String(body.name ?? ''), cwd)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/list { sessionId }
      if (path === '/dsh-base-plugin/api/terminal/list' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await terminalApi.list(String(body.sessionId ?? ''))
        sendJson(res, 200, { ok: true, value: { terminals: value } })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/send
      // { sessionId, terminalId, opKey, text, submit }
      if (path === '/dsh-base-plugin/api/terminal/send' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await terminalApi.send(
          String(body.sessionId ?? ''),
          String(body.terminalId ?? ''),
          String(body.opKey ?? ''),
          typeof body.text === 'string' ? body.text : '',
          body.submit === true,
        )
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/read { sessionId, terminalId, opKey }
      if (path === '/dsh-base-plugin/api/terminal/read' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await terminalApi.read(String(body.sessionId ?? ''), String(body.terminalId ?? ''), String(body.opKey ?? ''))
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/interrupt { sessionId, opKey }
      if (path === '/dsh-base-plugin/api/terminal/interrupt' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await terminalApi.interrupt(String(body.sessionId ?? ''), String(body.opKey ?? ''))
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/terminal/kill { sessionId, terminalId }
      if (path === '/dsh-base-plugin/api/terminal/kill' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await terminalApi.kill(String(body.sessionId ?? ''), String(body.terminalId ?? ''))
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // GET /dsh-base-plugin/api/usage/debug — service visibility diagnostics
      if (path === '/dsh-base-plugin/api/usage/debug' && method === 'GET') {
        const persistence = ctx.get('sessionPersistence')
        const sessionQuery = ctx.get('sessionQuery')
        const sessionsSvc = ctx.get('sessions')
        let persistedList = -1
        let queryList = -1
        let liveList = -1
        try { persistedList = persistence !== undefined ? (await persistence.list()).length : -1 } catch (e) { persistedList = 'err: ' + String(e.message).slice(0, 80) }
        try { queryList = sessionQuery !== undefined ? (await sessionQuery.listSessions()).length : -1 } catch (e) { queryList = 'err: ' + String(e.message).slice(0, 80) }
        try { liveList = sessionsSvc !== undefined ? sessionsSvc.list().length : -1 } catch (e) { liveList = 'err: ' + String(e.message).slice(0, 80) }
        sendJson(res, 200, {
          ok: true,
          value: {
            persistenceVisible: persistence !== undefined,
            sessionQueryVisible: sessionQuery !== undefined,
            sessionsVisible: sessionsSvc !== undefined,
            persistedList, queryList, liveList,
          },
        })
        return true
      }

      // GET /dsh-base-plugin/api/usage?force=1&start=YYYY-MM-DD&end=YYYY-MM-DD
      // — aggregated model usage (incremental scan; force=1 rescans every
      // session from seq 0; start/end narrow the token tables and series).
      if (path === '/dsh-base-plugin/api/usage' && method === 'GET') {
        if (!acquireBusy('usage scan')) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const dayParam = name => {
            const raw = url.searchParams.get(name) ?? ''
            return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : ''
          }
          const gran = url.searchParams.get('gran') ?? 'auto'
          const value = await scanUsage(ctx, {
            forceRescan: url.searchParams.get('force') === '1',
            startDay: dayParam('start'),
            endDay: dayParam('end'),
            granularity: ['auto', 'daily', 'hourly'].includes(gran) ? gran : 'auto',
          })
          sendJson(res, 200, { ok: true, value })
        } finally {
          releaseBusy()
        }
        return true
      }

      // POST /dsh-base-plugin/api/usage/prices { prices } — save the price table
      if (path === '/dsh-base-plugin/api/usage/prices' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = savePrices(body.prices)
        sendJson(res, 200, { ok: true, value: { prices: value } })
        return true
      }

      // GET /dsh-base-plugin/api/git/available — whether a git binary exists
      // (the Changes tab registers only when true).
      if (path === '/dsh-base-plugin/api/git/available' && method === 'GET') {
        sendJson(res, 200, { ok: true, value: { available: await gitAvailable() } })
        return true
      }

      // GET /dsh-base-plugin/api/git/status?cwd=... — workspace changes;
      // auto-inits the repo (with baseline commit) when needed.
      if (path === '/dsh-base-plugin/api/git/status' && method === 'GET') {
        const cwd = url.searchParams.get('cwd') ?? ''
        assertSessionCwd(ctx, cwd)
        const value = await gitStatus(cwd)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // GET /dsh-base-plugin/api/git/diff?cwd=...&file=... — one file's diff.
      if (path === '/dsh-base-plugin/api/git/diff' && method === 'GET') {
        const cwd = url.searchParams.get('cwd') ?? ''
        const file = url.searchParams.get('file') ?? ''
        assertSessionCwd(ctx, cwd)
        const value = await gitFileDiff(cwd, file)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // GET /dsh-base-plugin/api/sessions — the full session inventory
      // (persisted + live + archive-set ghosts) for the Sessions page.
      if (path === '/dsh-base-plugin/api/sessions' && method === 'GET') {
        const value = await listSessions(ctx)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/sessions/delete { sessionId } — destructive
      // delete (archived or not); refuses live sessions.
      if (path === '/dsh-base-plugin/api/sessions/delete' && method === 'POST') {
        const body = await readJsonBody(req)
        const value = await deleteSession(ctx, body?.sessionId)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // ── mobile access (pairing proxy control) ───────────────────────────

      /**
       * LAN IPv4 candidates worth showing a phone, from live
       * os.networkInterfaces(). Filters:
       *  - loopback/internal (os already flags these)
       *  - link-local 169.254.0.0/16 (self-assigned, unroutable)
       *  - benchmark range 198.18.0.0/15 (RFC 2544) — in practice the
       *    utun/Clash/Surge TUN virtual adapter's placeholder address
       *    (198.18.0.1), which no phone can ever reach
       *  - CGNAT 100.64.0.0/10 (carrier-side, not a real LAN)
       */
      function lanAddresses() {
        const out = []
        try {
          for (const list of Object.values(networkInterfaces())) {
            for (const net of list ?? []) {
              if (net.family !== 'IPv4' || net.internal === true) continue
              const [a, b] = net.address.split('.').map(Number)
              if (a === 169 && b === 254) continue // link-local
              if (a === 198 && (b === 18 || b === 19)) continue // RFC 2544 / VPN TUN placeholder
              if (a === 100 && b >= 64 && b <= 127) continue // CGNAT
              out.push(net.address)
            }
          }
        } catch { /* none found — QR falls back to localhost */ }
        return out
      }

      // GET /dsh-base-plugin/api/mobile — status, LAN URLs, live pairing
      // code + QR (each call refreshes the code window: showing the QR IS
      // the mint).
      if (path === '/dsh-base-plugin/api/mobile' && method === 'GET') {
        const state = loadState()
        const mobile = state.mobile
        const status = mobileControls.mobileStatus()
        const addresses = lanAddresses()
        let pair = null
        let urls = []
        if (mobile !== null && mobile.enabled && status.running) {
          const auth = ensureAuth()
          const p = auth.currentPairing() ?? auth.newPairingCode()
          mobileControls.persistMobile()
          pair = { code: p.code, expiresAt: p.expiresAt }
          urls = addresses.map(a => `http://${a}:${status.port}/#pair=${p.code}`)
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            enabled: mobile !== null && mobile.enabled,
            running: status.running,
            port: status.port,
            addresses,
            pair,
            urls,
            qr: urls.length > 0 ? qrSvg(urls[0]) : '',
            devices: mobile === null ? [] : mobile.devices.map(d => ({
              id: d.id, name: d.name, pairedAt: d.pairedAt, lastSeenAt: d.lastSeenAt,
            })),
          },
        })
        return true
      }

      // POST /dsh-base-plugin/api/mobile/toggle { enabled, port? }
      if (path === '/dsh-base-plugin/api/mobile/toggle' && method === 'POST') {
        const body = await readJsonBody(req)
        const state = loadState()
        if (state.mobile === null) state.mobile = { enabled: false, port: 8787, secret: '', devices: [] }
        state.mobile.enabled = body.enabled === true
        if (Number.isInteger(body.port) && body.port > 0 && body.port < 65536) state.mobile.port = body.port
        saveState(state)
        if (state.mobile.enabled) await mobileControls.startMobile()
        else await mobileControls.stopMobile()
        sendJson(res, 200, { ok: true, value: mobileControls.mobileStatus() })
        return true
      }

      // POST /dsh-base-plugin/api/mobile/revoke { deviceId }
      if (path === '/dsh-base-plugin/api/mobile/revoke' && method === 'POST') {
        const body = await readJsonBody(req)
        const deviceId = String(body.deviceId ?? '')
        if (deviceId === '') throw new Error('dsh-base-plugin: deviceId is required')
        const auth = ensureAuth()
        const revoked = auth.revoke(deviceId)
        mobileControls.persistMobile()
        sendJson(res, 200, { ok: true, value: { deviceId, revoked } })
        return true
      }

      // POST /dsh-base-plugin/api/mobile/rotate — new HMAC secret; every
      // issued cookie dies. The proxy verifies against the shared auth
      // instance, so no restart is needed.
      if (path === '/dsh-base-plugin/api/mobile/rotate' && method === 'POST') {
        const auth = ensureAuth()
        auth.rotateSecret()
        mobileControls.persistMobile()
        sendJson(res, 200, { ok: true, value: { rotated: true } })
        return true
      }

      // GET /dsh-base-plugin/api/service/info — process facts + availability
      if (path === '/dsh-base-plugin/api/service/info' && method === 'GET') {
        sendJson(res, 200, { ok: true, value: serviceInfo() })
        return true
      }

      // POST /dsh-base-plugin/api/service/stop — graceful shutdown
      if (path === '/dsh-base-plugin/api/service/stop' && method === 'POST') {
        const value = stopService(ctx)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/service/restart — helper re-exec + shutdown
      if (path === '/dsh-base-plugin/api/service/restart' && method === 'POST') {
        const value = restartService(ctx)
        sendJson(res, 200, { ok: true, value })
        return true
      }

      // POST /dsh-base-plugin/api/install { spec }
      if (path === '/dsh-base-plugin/api/install' && method === 'POST') {
        const body = await readJsonBody(req)
        const spec = String(body.spec ?? '').trim()
        if (spec === '') throw new Error('dsh-base-plugin: spec is required')
        if (!acquireBusy(`install ${spec}`)) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const state = loadState()
          const result = await installPackage(ctx, state, spec)
          sendJson(res, 200, { ok: true, value: result })
        } finally {
          releaseBusy()
        }
        return true
      }

      // POST /dsh-base-plugin/api/uninstall { name }
      if (path === '/dsh-base-plugin/api/uninstall' && method === 'POST') {
        const body = await readJsonBody(req)
        const pkgName = String(body.name ?? '').trim()
        if (pkgName === '') throw new Error('dsh-base-plugin: name is required')
        if (!acquireBusy(`uninstall ${pkgName}`)) throw new Error('dsh-base-plugin: another operation is running')
        try {
          const state = loadState()
          const result = await uninstallPackage(ctx, state, pkgName)
          sendJson(res, 200, { ok: true, value: result })
        } finally {
          releaseBusy()
        }
        return true
      }

      // POST /dsh-base-plugin/api/mcp/save { yaml } — replace the whole managed list.
      if (path === '/dsh-base-plugin/api/mcp/save' && method === 'POST') {
        const body = await readJsonBody(req)
        const text = typeof body.yaml === 'string' ? body.yaml : ''
        const yaml = getYaml()
        if (yaml === null) throw new Error('dsh-base-plugin: the yaml package is not resolvable — cannot save MCP configuration')
        let parsed
        try {
          parsed = yaml.parse(text)
        } catch (error) {
          throw new Error(`dsh-base-plugin: YAML syntax error: ${error instanceof Error ? error.message : String(error)}`)
        }
        if (parsed === null || parsed === undefined) parsed = []
        if (!Array.isArray(parsed)) throw new Error('dsh-base-plugin: the document must be a YAML list of server entries (or an empty list)')
        const servers = parsed.map((item, index) => {
          try {
            return normalizeMcpServer(item)
          } catch (error) {
            throw new Error(`dsh-base-plugin: server #${index + 1}: ${error instanceof Error ? error.message : String(error)}`)
          }
        })
        const seen = new Set()
        for (const server of servers) {
          if (seen.has(server.serverName)) throw new Error(`dsh-base-plugin: duplicate serverName "${server.serverName}"`)
          seen.add(server.serverName)
        }
        const state = loadState()
        state.mcpServers = servers
        commit(state)
        sendJson(res, 200, { ok: true, value: { count: servers.length } })
        return true
      }

      // POST /dsh-base-plugin/api/mcp/add { transport, serverName, ... } (legacy form)
      if (path === '/dsh-base-plugin/api/mcp/add' && method === 'POST') {
        const body = await readJsonBody(req)
        const server = normalizeMcpServer(body)
        const state = loadState()
        if (state.mcpServers.some(s => s.serverName === server.serverName)) {
          throw new Error(`dsh-base-plugin: server name "${server.serverName}" already exists`)
        }
        state.mcpServers.push(server)
        commit(state)
        sendJson(res, 200, { ok: true, value: { serverName: server.serverName } })
        return true
      }

      // POST /dsh-base-plugin/api/mcp/remove { serverName } (legacy form)
      if (path === '/dsh-base-plugin/api/mcp/remove' && method === 'POST') {
        const body = await readJsonBody(req)
        const serverName = String(body.serverName ?? '').trim()
        const state = loadState()
        const before = state.mcpServers.length
        state.mcpServers = state.mcpServers.filter(s => s.serverName !== serverName)
        if (state.mcpServers.length === before) {
          throw new Error(`dsh-base-plugin: server "${serverName}" is not managed by dsh-base-plugin (hand-added row — edit cordis.patch.yml directly)`)
        }
        commit(state)
        sendJson(res, 200, { ok: true, value: { serverName } })
        return true
      }

      sendJson(res, 404, { ok: false, error: `unknown route ${method} ${path}` })
      return true
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return true
    }
  }

  ctx.effect(
    () => webServer.register({
      kind: 'prefix',
      path: '/dsh-base-plugin',
      handler: async (req, res) => {
        const claimed = await handled(req, res)
        if (!claimed) sendJson(res, 404, { ok: false, error: 'not found' })
      },
    }),
    'dsh-base-plugin: api routes',
  )

  ctx.logger.info('dsh-base-plugin: HTTP API ready at /dsh-base-plugin/api/*')
}
