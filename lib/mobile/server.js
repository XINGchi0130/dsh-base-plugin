/**
 * dsh-base-plugin — mobile-access reverse proxy server.
 *
 * A standalone node:http server bound to 0.0.0.0:<port> that fronts the
 * UNAUTHENTICATED dsh web server on 127.0.0.1:3080. Every request from a
 * non-loopback peer must carry a valid pairing cookie; loopback peers
 * (the desktop itself) pass through without one and additionally reach the
 * localhost-only control routes (rotate secret, shutdown).
 *
 * Traffic handling:
 *  - `GET /__dshm/pair` (no auth): the pairing landing page (tiny inline
 *    HTML — works before any cookie exists). It POSTs the code to
 *    `/__dshm/api/pair`; success sets the HttpOnly cookie and redirects to /.
 *  - `/__dshm/api/*`: the proxy's own control surface (pair attempt, and
 *    localhost-only shutdown/rotate). All JSON.
 *  - everything else: streamed reverse proxy to the dsh web server —
 *    method, path, query, body headers, and both body directions copied
 *    chunk-by-chunk (SSE needs unbuffered pass-through; attachments need
 *    full-size streams). Outgoing hop sets `Host: 127.0.0.1:3080` and
 *    forwards the client address in `X-Forwarded-For`.
 *
 * Security notes:
 *  - cookie is HttpOnly + SameSite=Lax + Path=/ (no Secure: plain HTTP on
 *    LAN by design — documented; Tailscale covers the remote case).
 *  - pairing is single-use, 10-minute, per-IP exponential backoff (auth.js).
 *  - the dsh web origin MUST stay loopback-only; this server is the sole
 *    intended LAN surface.
 * @module dsh-base-plugin/lib/mobile/server
 */
import { createServer, request as httpRequest } from 'node:http'
import { readCookie, COOKIE_NAME } from './auth.js'
import { servePwaAsset } from './pwa.js'

/** The upstream dsh web origin this proxy fronts. Port defaults to 3080 but
 * callers pass the live webServer.port (startMobile in index.js) — the server
 * port is configurable and may even be 0 (OS-assigned), a hardcoded 3080
 * 502'd the whole proxy on any non-default deployment. */
const UPSTREAM_HOST = '127.0.0.1'
const UPSTREAM_PORT = Number(process.env.DSHM_UPSTREAM_PORT ?? 3080)
/** Resolve the upstream port per start call (falls back to the constant). */
function upstreamPortOf(override) {
  return Number.isInteger(override) && override > 0 ? override : UPSTREAM_PORT
}

/** Tiny inline pairing page (no external assets: nothing to load pre-auth). */
function pairPage(message) {
  const hint = message === '' ? '' : `<p class="m">${escapeHtml(message)}</p>`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DSH Mobile Pairing</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#141517;color:#e8eaed;
display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center}
.c{max-width:320px;padding:24px;text-align:center}
h1{font-size:18px;margin:0 0 6px}.s{font-size:13px;color:#9aa0a6;margin:0 0 18px}
input{width:100%;box-sizing:border-box;padding:12px;font-size:20px;letter-spacing:4px;
text-align:center;border-radius:10px;border:1px solid #3c4043;background:#202124;color:#e8eaed}
button{margin-top:12px;width:100%;padding:12px;font-size:15px;border-radius:10px;
border:none;background:#2f6fed;color:#fff;cursor:pointer}
.m{font-size:13px;color:#f28b82;margin:14px 0 0;min-height:1em}
</style></head><body><div class="c">
<h1>DSH Mobile Access</h1>
<p class="s">Enter the pairing code shown in desktop Settings</p>
<form method="post" action="/__dshm/api/pair">
<input name="code" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="••••••••" required>
<input type="hidden" name="name" value="">
<button type="submit">Pair</button></form>${hint}
</div></body></html>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/** Detect a plausible mobile UA for a friendly default device name. */
function guessDeviceName(header) {
  const ua = typeof header === 'string' ? header : ''
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  return 'Mobile device'
}

/**
 * Start the mobile-access proxy.
 * @param {object} options
 * @param {number} options.port LAN port to bind (0.0.0.0).
 * @param {import('./auth.js').MobileAuth} options.auth the auth state machine.
 * @param {() => void} options.onStateChange persistence hook (device list /
 *   secret mutated — caller saves state).
 * @param {string} options.version UI-facing version label.
 * @returns {Promise<{ server: import('node:http').Server, port: number, close: () => Promise<void> }>}
 */
export function startMobileProxy({ port, upstreamPort, auth, onStateChange, version }) {
  const livePort = upstreamPortOf(upstreamPort)
  return new Promise((resolve, reject) => {
    const server = httpRequestServer({ auth, onStateChange, version, upstreamPort: livePort })

    // WebSocket upgrade pass-through: dsh's event channel
    // (/api/events.host, /api/events.mux) REQUIRES a WS upgrade (a plain
    // GET answers 426), so without this handler the phone UI mounts but
    // receives no events. Auth mirrors the plain-HTTP path: the browser
    // sends the pairing cookie in the upgrade request headers.
    // Fault fence (same rationale as the request handler): a throw in an
    // 'upgrade' listener is uncaught in Node and kills the host — degrade
    // to one destroyed socket instead.
    const handleUpgrade = (req, socket, head) => {
      const ip = req.socket.remoteAddress ?? '?'
      const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
      // Client-side error handling MUST be attached BEFORE anything async
      // happens: between here and the upstream 101 this socket has no other
      // listener, and a mobile radio reset (ECONNRESET) or a write to an
      // already-gone socket (ERR_STREAM_DESTROYED) surfaces as an uncaught
      // 'error' event — the try/catch fence around handleUpgrade only
      // catches SYNCHRONOUS throws, so async errors in this gap killed the
      // whole dsh host. clientGone covers the entire lifecycle: during the
      // handshake gap it aborts the pending upstream request; after a
      // settled 101 destroying the finished ClientRequest is a harmless
      // no-op (the tunnel lives in upSocket, owned by drop below).
      let upstreamReq = null
      const clientGone = () => {
        if (upstreamReq !== null) { try { upstreamReq.destroy() } catch { /* already settled */ } }
        try { socket.destroy() } catch { /* already gone */ }
      }
      socket.on('error', clientGone)
      socket.on('close', clientGone)
      if (!isLoopback) journal(`UPGRADE ${req.url} <- ${ip}`)
      const device = isLoopback ? { id: 'loopback' } : auth.verify(readCookie(req.headers.cookie))
      if (!isLoopback) journal(`  upgrade auth ${device === null ? 'REJECT' : 'ok(' + device.name + ')'}`)
      if (device === null) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
      }
      // The upstream rejects WS upgrades whose Origin names a different
      // authority (403 — an anti-cross-site fence). The phone's origin
      // is the PROXY, which by definition is not the upstream's origin;
      // strip it so the upgrade looks exactly like a same-origin
      // (loopback) one. The proxy itself already authenticated this
      // socket via the pairing cookie.
      const upgradeHeaders = {
        ...req.headers,
        host: `${UPSTREAM_HOST}:${upstreamPort}`,
        'x-forwarded-for': ip,
      }
      delete upgradeHeaders.origin
      const upstream = httpRequest({
        host: UPSTREAM_HOST,
        port: upstreamPort,
        method: 'GET',
        path: req.url,
        headers: upgradeHeaders,
        // WS-proxy classic traps, both avoided here:
        // 1. agent:false — a keep-alive agent may hand this upgrade request
        //    to a REUSED socket whose server treats it as a normal request;
        //    upgrades need a fresh dedicated connection.
        // 2. the request must be flushed with .end() (below) — http.request,
        //    unlike http.get, buffers headers until then.
        agent: false,
      })
      upstreamReq = upstream // seen by clientGone while the request is in flight
      upstream.on('upgrade', (upRes, upSocket, upHead) => {
        if (!isLoopback) journal(`  upstream 101 for ${req.url}`)
        // Relay the upstream 101 BYTE-FOR-BYTE from rawHeaders instead of
        // re-synthesizing it: strict mobile WebSocket stacks reject a
        // hand-built handshake over details desktop engines tolerate (header
        // name casing, exact status line). The upstream's own bytes are by
        // definition a valid 101 for this exact key.
        let handshake = 'HTTP/1.1 101 Switching Protocols\r\n'
        for (let i = 0; i < upRes.rawHeaders.length; i += 2) {
          handshake += `${upRes.rawHeaders[i]}: ${upRes.rawHeaders[i + 1]}\r\n`
        }
        handshake += '\r\n'
        socket.write(handshake)
        if (upHead !== undefined && upHead.length > 0) upSocket.unshift(upHead)
        if (head !== undefined && head.length > 0) socket.unshift(head)
        upSocket.pipe(socket).pipe(upSocket)
        const drop = () => { upSocket.destroy(); socket.destroy() }
        upSocket.on('error', drop)
        socket.on('error', drop)
      })
      upstream.on('error', (err) => {
        if (!isLoopback) journal(`  upstream-ERROR ${req.url}: ${String(err?.message ?? err).slice(0, 100)}`)
        socket.destroy()
      })
      // A non-101 answer: relay the status so the client sees why.
      upstream.on('response', upRes => {
        if (!isLoopback) journal(`  upstream NON-101 ${req.url}: HTTP ${upRes.statusCode}`)
        socket.write(`HTTP/1.1 ${upRes.statusCode ?? 502} ${upRes.statusMessage ?? ''}\r\n\r\n`)
        upRes.resume()
        socket.end()
      })
      // http.request (unlike http.get) buffers until .end(): without this
      // the handshake headers are never flushed upstream and everything
      // silently times out.
      upstream.end()
    }
    server.on('upgrade', (req, socket, head) => {
      try {
        handleUpgrade(req, socket, head)
      } catch (error) {
        journal(`UPGRADE-ERROR ${req.url}: ${String(error?.message ?? error).slice(0, 120)}`)
        try { socket.destroy() } catch { /* already gone */ }
      }
    })

    server.once('error', reject)
    server.listen(port, '0.0.0.0', () => {
      const bound = server.address().port
      resolve({
        server,
        port: bound,
        close: () => new Promise(done => {
          server.close(() => done())
          server.closeAllConnections()
        }),
      })
    })
    server.on('error', err => {
      // Late listener errors (EADDRINUSE races, abrupt resets) must not
      // kill dsh; request-level errors are handled per-socket above.
      void err
    })
  })
}

/** Request journal for diagnostics (ring buffer, in-memory). */
const JOURNAL = []
function journal(entry) {
  JOURNAL.push(`${new Date().toISOString().slice(11, 19)} ${entry}`)
  if (JOURNAL.length > 200) JOURNAL.splice(0, JOURNAL.length - 200)
}

/** Read + clear the diagnostic journal. */
export function takeJournal() {
  const out = [...JOURNAL]
  JOURNAL.length = 0
  return out
}

/** Build the request handler and server (split out for testability). */
function httpRequestServer({ auth, onStateChange, version, upstreamPort }) {
  const handle = (req, res) => {
    const ip = req.socket.remoteAddress ?? '?'
    const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
    if (!isLoopback) journal(`${req.method} ${req.url} <- ${ip}`)

    // ── PWA assets (manifest + icons; not sensitive, no auth) ────────────
    if (req.method === 'GET' && servePwaAsset(new URL(req.url ?? '/', 'http://x').pathname, res)) {
      return
    }

    // ── control surface (before auth; pair must work without a cookie) ──
    if (req.url === '/__dshm/pair' || req.url === '/__dshm') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(pairPage(''))
      return
    }

    if (req.method === 'POST' && req.url === '/__dshm/api/pair') {
      handlePair(req, res, ip, auth, onStateChange)
      return
    }

    if (req.url !== undefined && req.url.startsWith('/__dshm/api/')) {
      // Remaining control routes are localhost-only.
      if (!isLoopback) {
        json(res, 403, { ok: false, error: 'loopback only' })
        return
      }
      if (req.method === 'POST' && req.url === '/__dshm/api/rotate') {
        auth.rotateSecret()
        onStateChange()
        json(res, 200, { ok: true, value: { rotated: true, devices: auth.state.devices.length } })
        return
      }
      // Diagnostic journal (loopback-only, read-and-clear).
      if (req.method === 'GET' && req.url === '/__dshm/api/journal') {
        json(res, 200, { ok: true, value: { lines: takeJournal() } })
        return
      }
      json(res, 404, { ok: false, error: 'unknown control route' })
      return
    }

    // ── everything else: authenticate, then proxy ─────────────────────────
    const cookie = readCookie(req.headers.cookie)
    const device = isLoopback ? { id: 'loopback', name: 'desktop' } : auth.verify(cookie)
    if (!isLoopback) journal(`  auth ${device === null ? 'REJECT' : 'ok(' + device.name + ')'}`)
    if (device === null) {
      if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/html')) {
        // Humans get the pairing page; APIs get 401 JSON.
        res.writeHead(302, { location: '/__dshm/pair', 'cache-control': 'no-store' })
        res.end()
      } else {
        json(res, 401, { ok: false, error: 'not paired' })
      }
      return
    }

    // Sliding renewal: refresh the cookie when past half-life.
    const headers = { ...req.headers }
    delete headers.cookie
    if (!isLoopback) {
      const renewed = auth.renew(device.id)
      if (renewed !== null && auth.shouldRenew(cookie)) {
        onStateChange()
        res.setHeader('set-cookie',
          `${COOKIE_NAME}=${renewed.cookie}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`)
      }
    }

    proxyRequest(req, res, headers)
  }

  // Fault fence: a throw inside the handler must degrade to one 500, never
  // an uncaught exception killing the whole dsh host (the lesson of the
  // origin:undefined crash). Node does NOT catch request-listener throws.
  return createServer((req, res) => {
    try {
      handle(req, res)
    } catch (error) {
      journal(`HANDLER-ERROR ${req.method} ${req.url}: ${String(error?.message ?? error).slice(0, 120)}`)
      try {
        if (res.headersSent) res.destroy()
        else {
          res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ ok: false, error: 'mobile proxy handler failed' }))
        }
      } catch { /* socket already gone */ }
    }
  })
}

/** POST /__dshm/api/pair: form-encoded code (+optional name). */
function handlePair(req, res, ip, auth, onStateChange) {
  const chunks = []
  let size = 0
  req.on('data', c => {
    size += c.length
    if (size > 4096) { req.destroy(); return }
    chunks.push(c)
  })
  req.on('end', () => {
    const params = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
    const code = params.get('code') ?? ''
    const name = (params.get('name') ?? '') || guessDeviceName(req.headers['user-agent'])
    const waitMs = auth.backoffRemaining(ip)
    if (waitMs > 0) {
      res.writeHead(429, { 'content-type': 'text/html; charset=utf-8', 'retry-after': String(Math.ceil(waitMs / 1000)), 'cache-control': 'no-store' })
      res.end(pairPage('', `Too many attempts — retry in ${Math.ceil(waitMs / 1000)}s`))
      return
    }
    const result = auth.pair(code, name, ip)
    if (result === null) {
      const wait = auth.backoffRemaining(ip)
      res.writeHead(403, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(pairPage('', wait > 0 ? `Invalid code — retry in ${Math.ceil(wait / 1000)}s` : 'Invalid or expired code'))
      return
    }
    onStateChange()
    res.writeHead(200, {
      'set-cookie': `${COOKIE_NAME}=${result.cookie}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    })
    res.end('<!doctype html><meta http-equiv="refresh" content="0;url=/"><body>Paired. Opening DSH…')
  })
  req.on('error', () => { try { res.destroy() } catch { /* gone */ } })
}

/** Early <head> polyfill for non-secure contexts: dsh's client bundles call
 * crypto.randomUUID() (session ids, draft attachments, and mintRpcId() on
 * EVERY RPC) unguarded. Browsers expose randomUUID only in secure contexts
 * — http://127.0.0.1 desktop is one, http://<LAN-IP> phones are not, so on
 * phones every module dies at init ("crypto.randomUUID is not a function"),
 * no WebSocket is ever attempted, and the session list stays empty. This
 * shim (getRandomValues IS available in insecure contexts) restores the
 * API before any bundle runs. Document structure stays valid: a <script>
 * as head's first child — no quirks mode, no body rewriting. */
const POLYFILL_SNIPPET = '<script>(function(){if(typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function")return;var g=crypto&&crypto.getRandomValues?crypto:msCrypto;function uuid(){var b=new Uint8Array(16);g.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=[];for(var i=0;i<16;i++)h.push((b[i]+256).toString(16).slice(1));return h.slice(0,4).join("")+"-"+h.slice(4,6).join("")+"-"+h.slice(6,8).join("")+"-"+h.slice(8,10).join("")+"-"+h.slice(10).join("")}try{Object.defineProperty(crypto,"randomUUID",{value:uuid,configurable:true,writable:true})}catch(e){}})()</script>'

/** Stream one request to the upstream dsh web server and the answer back.
 *
 * HTML documents get ONLY the randomUUID polyfill above — no beacons, no
 * WebSocket wrappers, no Accept rewriting (an earlier diagnostic build did
 * all three and the wrapper's hand-rolled constructor made every app
 * WebSocket die client-side on real browsers). */
function proxyRequest(req, res, clientHeaders) {
  const headers = {
    ...clientHeaders, // client's real Accept preserved — API POSTs included
    host: `${UPSTREAM_HOST}:${upstreamPort}`,
    'x-forwarded-for': req.socket.remoteAddress ?? '',
  }
  // Same Origin rationale as the upgrade path: the phone's origin is
  // this proxy; forwarding it would trip the upstream's cross-site
  // fences (the POST write fence behaves identically). Deleting the
  // key (not assigning undefined) keeps Node from rejecting the header.
  delete headers.origin
  const upstream = httpRequest(
    {
      host: UPSTREAM_HOST,
      port: upstreamPort,
      method: req.method,
      path: req.url,
      headers,
    },
    up => {
      // Copy status/headers, then pipe BOTH directions without buffering
      // (SSE requires the event stream to reach the phone as it happens).
      const headers = { ...up.headers }
      delete headers['transfer-encoding'] // Node re-chunks per its own framing
      const isDoc = (up.statusCode === 200)
        && String(headers['content-type'] ?? '').includes('text/html')
      if (isDoc) {
        // The polyfill inflates the body: drop the upstream length so
        // Node's chunked framing carries the larger body correctly.
        delete headers['content-length']
        // The HTML shell must never be heuristically cached: a phone that
        // cached a pre-fix shell kept executing dead code long after the
        // server was fixed. no-store forces every shell load back through
        // the proxy; hashed JS/CSS assets keep their own cache headers.
        headers['cache-control'] = 'no-store'
      }
      res.writeHead(up.statusCode ?? 502, headers)
      if (isDoc) {
        // Buffer JUST the head of the document to inject the polyfill
        // INSIDE <head> (a script before <!doctype html> would push the
        // page into quirks mode — the KaTeX lesson). Everything after the
        // head keeps streaming untouched.
        injectPolyfill(up, res)
      } else {
        up.pipe(res)
      }
      res.on('close', () => up.destroy())
    },
  )
  upstream.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    }
    res.end(JSON.stringify({ ok: false, error: `upstream unavailable: ${err.message}` }))
  })
  req.pipe(upstream)
}

/** Inject the polyfill as the first child of <head> by buffering only the
 * document's head region; the rest streams through untouched. Falls back
 * to a plain stream when no <head> is found (never blocks a page). */
function injectPolyfill(up, res) {
  let buf = Buffer.alloc(0)
  const finish = () => { res.write(buf); buf = null; up.pipe(res) }
  up.on('data', (chunk) => {
    if (buf === null) return // already piped
    buf = Buffer.concat([buf, chunk])
    const text = buf.toString('latin1')
    const at = text.search(/<head[^>]*>/i)
    if (at !== -1) {
      const open = /<head[^>]*>/i.exec(text)
      const cut = at + open[0].length
      const pre = buf.subarray(0, cut)
      const rest = buf.subarray(cut)
      res.write(pre)
      res.write(POLYFILL_SNIPPET)
      res.write(rest)
      buf = null
      up.removeAllListeners('data')
      up.pipe(res) // subsequent chunks stream untouched
    } else if (buf.length > 64 * 1024) {
      finish() // head not found in 64KB — give up injection, just stream
    }
  })
  up.on('end', () => { if (buf !== null) finish() })
}

/** Small JSON helper for control routes. */
function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

