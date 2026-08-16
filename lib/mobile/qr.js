/**
 * dsh-base-plugin — QR code generation for mobile pairing (ESM face).
 *
 * Wraps the vendored `qrcode-svg@1.1.0` (MIT, zero dependencies, CommonJS).
 * The vendored file is loaded once via createRequire and re-exported as a
 * plain function; only the svg() path is used (no fs, no container).
 * @module dsh-base-plugin/lib/mobile/qr
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const QRCode = require(join(here, 'qr-vendor.cjs'))

/**
 * Render one QR code as an SVG string.
 * @param {string} text - payload to encode (a pairing URL).
 * @returns {string} standalone `<svg …>…</svg>` markup.
 */
export function qrSvg(text) {
  return new QRCode({ content: String(text), padding: 1, width: 240, height: 240, color: '#000', background: '#fff', ecl: 'M' }).svg()
}
