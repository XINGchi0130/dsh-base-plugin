/**
 * dsh-base-plugin — upstream browser-session cookie minting.
 *
 * dsh ≥ 0.1.2-alpha.1 requires every browser request (the index document and
 * each /api call) to carry a signed `dsh-auth-<hash>` cookie. The cookie is
 * normally minted by opening the per-process launch-token URL once in a
 * desktop browser — an exchange a paired phone behind this proxy cannot
 * perform. The proxy therefore mints the same cookie itself: the signing
 * secret is a persistent credential record (scope `client-connection`, id
 * `browser-session`) owned by the upstream Connection plugin, and both run
 * inside the same dsh process, so this plugin reads the record through the
 * shared credentials service and signs a cookie bound to the fixed loopback
 * authority of the upstream hop.
 *
 * Lifetime: the upstream validates `expiresAt - issuedAt <= maxAgeDays`
 * (schema minimum 1 day), so a 1-day cookie is valid under every allowed
 * deployment config; it is refreshed lazily at half-life.
 * @module dsh-base-plugin/lib/mobile/upstream-auth
 */
import { createHash, createHmac } from 'node:crypto'

const DAY_MS = 24 * 60 * 60 * 1000
/** Signed cookie lifetime; must not exceed the upstream's smallest allowed max age. */
const COOKIE_LIFETIME_MS = DAY_MS
/** Re-mint once less than half the lifetime remains. */
const REFRESH_THRESHOLD_MS = DAY_MS / 2
const COOKIE_PREFIX = 'dsh-auth-'
const PAYLOAD_VERSION = 1
const SECRET_BYTES = 32
const B64URL_PATTERN = /^[A-Za-z0-9_-]*$/

/** Base64url without padding, matching the upstream's encoder. */
function b64url(value) {
  return Buffer.from(value).toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

/** Decode the credential record's stored secret into raw signing bytes. */
function secretFromRecord(record) {
  if (record === undefined || record === null) return undefined
  if (record.kind !== 'grant' || typeof record.payload !== 'object' || record.payload === null) return undefined
  if (record.payload.version !== 1) return undefined
  const stored = record.payload.secret
  if (typeof stored !== 'string' || !B64URL_PATTERN.test(stored) || stored.length % 4 === 1) return undefined
  const secret = Buffer.from(stored, 'base64url')
  return secret.byteLength === SECRET_BYTES && b64url(secret) === stored ? secret : undefined
}

/**
 * Create the upstream cookie source.
 * @param {() => Promise<import('node:buffer').Buffer | undefined>} readSecret
 *   Resolves the persistent browser-session signing secret, or undefined when
 *   unavailable (older upstream, credentials service missing) — in that state
 *   no cookie is attached and the proxy behaves like the pre-auth hop.
 * @param {string} authority Canonical `host:port` of the upstream hop; must
 *   equal the Host header the proxy sends upstream.
 * @returns {{ cookieHeader: () => Promise<string | undefined>, invalidate: () => void }}
 */
export function createUpstreamAuth(readSecret, authority) {
  /** @type {{ header: string, expiresAt: number } | null} */
  let cached = null

  const mint = (secret) => {
    const issuedAt = Date.now()
    const expiresAt = issuedAt + COOKIE_LIFETIME_MS
    const name = COOKIE_PREFIX + b64url(createHash('sha256').update(authority).digest())
    const body = b64url(Buffer.from(
      JSON.stringify({ version: PAYLOAD_VERSION, authority, issuedAt, expiresAt }),
      'utf8',
    ))
    const signature = b64url(createHmac('sha256', secret).update(body).digest())
    return { header: `${name}=v1.${body}.${signature}`, expiresAt }
  }

  return {
    async cookieHeader() {
      if (cached !== null && cached.expiresAt - Date.now() > REFRESH_THRESHOLD_MS) return cached.header
      let secret
      try {
        secret = await readSecret()
      } catch {
        secret = undefined
      }
      if (secret === undefined) {
        // A refresh failure must not drop a still-valid cookie (credentials
        // hiccup) — fall back to whatever time the cache has left.
        if (cached !== null && cached.expiresAt - Date.now() > 60_000) return cached.header
        return undefined
      }
      cached = mint(secret)
      return cached.header
    },
    invalidate() {
      cached = null
    },
  }
}

export { secretFromRecord }
