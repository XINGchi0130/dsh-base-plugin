/**
 * dsh-base-plugin — mobile-access authentication core.
 *
 * Server-owned state (persisted under $DSH_HOME/dsh-base-plugin.json):
 *  - `secret`: 32-byte hex HMAC key. Rotating it invalidates EVERY issued
 *    cookie at once (devices stay listed but their cookies stop verifying —
 *    re-pairing re-enrolls them under the same device ids).
 *  - `devices`: registered device rows { id, name, pairedAt, lastSeenAt }.
 *
 * Ephemeral state (memory only, per process):
 *  - one live pairing code: 8 chars from a 32-char alphabet (~40 bits),
 *    single-use, expires after 10 minutes; guessing is further throttled by
 *    per-IP exponential backoff on failed attempts.
 *
 * Cookie format: `v1.<deviceId>.<expiryEpochSeconds>.<hmacHex>` where the
 * HMAC covers `v1.<deviceId>.<expiry>` — tamper with any field and the
 * signature check fails. HttpOnly + SameSite=Lax; the proxy also requires
 * the request to carry it (no query-param fallback, so pairing URLs never
 * leak a usable credential into browser history).
 * @module dsh-base-plugin/lib/mobile/auth
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Pairing-code alphabet: unambiguous uppercase+digits (no 0/O/1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Pairing code lifetime. */
export const PAIRING_TTL_MS = 10 * 60 * 1000
/** Cookie lifetime (sliding: refreshed on use when past half-life). */
export const COOKIE_TTL_S = 30 * 24 * 3600
/** Cookie name on the wire. */
export const COOKIE_NAME = 'dshm'

/**
 * Mutable auth state machine. The caller owns persistence of `secret` and
 * `devices`; this object only mutates them and expects a save afterwards.
 */
export class MobileAuth {
  /** @param {{ secret: string, devices: Array<{id:string,name:string,pairedAt:number,lastSeenAt:number}> }} state persisted auth fields */
  constructor(state) {
    this.state = state
    /** Active pairing: { code, expiresAt, used } | null */
    this.pairing = null
    /** Failed-attempt backoff per IP: Map<string, { fails: number, until: number }> */
    this.backoff = new Map()
  }

  /** Ensure a usable HMAC secret exists (call at boot for legacy state). */
  ensureSecret() {
    if (typeof this.state.secret !== 'string' || this.state.secret.length !== 64) {
      this.state.secret = randomBytes(32).toString('hex')
      return true // changed → persist
    }
    return false
  }

  /** Mint a fresh pairing code (replaces any previous one). */
  newPairingCode(now = Date.now()) {
    const bytes = randomBytes(8)
    let code = ''
    for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    this.pairing = { code, expiresAt: now + PAIRING_TTL_MS, used: false }
    return this.pairing
  }

  /** The live pairing (may be expired/used); null when none was minted. */
  currentPairing(now = Date.now()) {
    if (this.pairing === null) return null
    if (this.pairing.expiresAt <= now || this.pairing.used) return null
    return this.pairing
  }

  /**
   * Register a backoff entry's gate: how long this IP must wait before
   * another pairing attempt. Free after the window passes.
   * @returns {number} milliseconds remaining (0 = allowed).
   */
  backoffRemaining(ip, now = Date.now()) {
    const entry = this.backoff.get(ip)
    if (entry === undefined) return 0
    if (entry.until <= now) {
      this.backoff.delete(ip)
      return 0
    }
    return entry.until - now
  }

  /**
   * Attempt pairing: consume the code (single-use) and enroll a device.
   * A wrong or expired code registers a failure (exponential backoff for
   * the IP) and returns null.
   * @returns {{ id: string, name: string, cookie: string, expiresAt: number } | null}
   */
  pair(code, deviceName, ip, now = Date.now()) {
    if (typeof code !== 'string' || code === '' || typeof deviceName !== 'string' || deviceName === '') return null
    // Backoff gates EVERY attempt from this IP (a correct code inside the
    // window must not bypass the throttle — brute force must always slow
    // down, even after the attacker finds the code).
    if (this.backoffRemaining(ip, now) > 0) return null
    const live = this.currentPairing(now)
    const matches = live !== null && live.code.toUpperCase() === code.toUpperCase()
    if (!matches) {
      const entry = this.backoff.get(ip) ?? { fails: 0, until: 0 }
      entry.fails += 1
      entry.until = now + Math.min(1000 * 2 ** entry.fails, 10 * 60 * 1000)
      this.backoff.set(ip, entry)
      return null
    }
    live.used = true
    this.backoff.delete(ip)
    const device = {
      id: randomBytes(8).toString('hex'),
      name: deviceName.slice(0, 60),
      pairedAt: now,
      lastSeenAt: now,
    }
    this.state.devices.push(device)
    const expiresAt = Math.floor(now / 1000) + COOKIE_TTL_S
    return { ...device, cookie: this.signCookie(device.id, expiresAt), expiresAt }
  }

  /** HMAC over the cookie's signed prefix. */
  sign(deviceId, expiry) {
    return createHmac('sha256', this.state.secret).update(`v1.${deviceId}.${expiry}`).digest('hex')
  }

  /** Full cookie value for a device. */
  signCookie(deviceId, expiry) {
    return `v1.${deviceId}.${expiry}.${this.sign(deviceId, expiry)}`
  }

  /**
   * Verify a cookie value: parse, constant-time signature check, expiry
   * check, device-registered check. Updates lastSeenAt on success.
   * @returns {{ id: string, name: string } | null}
   */
  verify(cookieValue, now = Date.now()) {
    if (typeof cookieValue !== 'string') return null
    const parts = cookieValue.split('.')
    if (parts.length !== 4 || parts[0] !== 'v1') return null
    const [, deviceId, expiry, mac] = parts
    if (!/^[0-9a-f]{16}$/.test(deviceId) || !/^\d+$/.test(expiry) || !/^[0-9a-f]{64}$/.test(mac)) return null
    const expected = this.sign(deviceId, expiry)
    const a = Buffer.from(mac)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    if (Number(expiry) <= Math.floor(now / 1000)) return null
    const device = this.state.devices.find(d => d.id === deviceId)
    if (device === undefined) return null // rotated/revoked device id
    device.lastSeenAt = now
    return { id: device.id, name: device.name }
  }

  /** A fresh cookie for an existing device (sliding renewal), same device. */
  renew(deviceId, now = Date.now()) {
    const device = this.state.devices.find(d => d.id === deviceId)
    if (device === undefined) return null
    const expiresAt = Math.floor(now / 1000) + COOKIE_TTL_S
    return { cookie: this.signCookie(deviceId, expiresAt), expiresAt }
  }

  /** Whether a device's cookie is past half-life (renew on next response). */
  shouldRenew(cookieValue, now = Date.now()) {
    const parts = typeof cookieValue === 'string' ? cookieValue.split('.') : []
    if (parts.length !== 4) return false
    const expiry = Number(parts[2])
    if (!Number.isFinite(expiry)) return false
    return expiry - Math.floor(now / 1000) < COOKIE_TTL_S / 2
  }

  /** Revoke one device by id; true when it was listed. */
  revoke(deviceId) {
    const before = this.state.devices.length
    this.state.devices = this.state.devices.filter(d => d.id !== deviceId)
    return this.state.devices.length !== before
  }

  /** Rotate the HMAC secret: every issued cookie dies instantly. */
  rotateSecret() {
    this.state.secret = randomBytes(32).toString('hex')
  }
}

/** Parse our cookie out of a Cookie header (first match by name). */
export function readCookie(header) {
  if (typeof header !== 'string') return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === COOKIE_NAME) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}
