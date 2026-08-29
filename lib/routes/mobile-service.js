/**
 * 手机访问控制路由（配对代理 开关/二维码/设备/吊销/轮换）与 dsh 进程
 * 生命周期路由（信息/停止/重启）。
 * @module dsh-base-plugin/lib/routes/mobile-service
 */
import { networkInterfaces } from 'node:os'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dshHome } from '../env.js'
import { restartService, serviceInfo, stopService } from '../lifecycle.js'
import { qrSvg } from '../mobile/qr.js'
import { mutateState } from '../patch.js'
import { loadState } from '../state.js'
import { readJsonBody, sameOrigin, sendJson } from './http.js'

/**
 * 实时读取 os.networkInterfaces()，筛出值得展示给手机的局域网 IPv4。
 * 过滤规则：
 *  - 回环/内部网卡（os 已标记 internal）
 *  - 链路本地 169.254.0.0/16（自分配、不可路由）
 *  - 基准测试段 198.18.0.0/15（RFC 2544）——实际场景里就是
 *    utun/Clash/Surge TUN 虚拟网卡的占位地址（198.18.0.1），
 *    手机永远连不上
 *  - CGNAT 100.64.0.0/10（运营商侧，不是真实局域网）
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

export function mobileRoutes(ctx, deps) {
  const ensureAuth = deps.ensureAuth
  const mobileControls = deps.mobileControls
  return [
    // GET /dsh-base-plugin/api/mobile —— 状态、局域网 URL、实时配对码 +
    // 二维码。每次调用都刷新配对码窗口：打开本页即铸造（展示即签发），
    // 旧码立即作废。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/mobile',
      handler: async (_req, res) => {
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
      },
    },
    // POST /dsh-base-plugin/api/mobile/toggle { enabled, port? }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mobile/toggle',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        // 经 mutateState 互斥临界区（与 install 的 commit 窗口并发时，
        // 同步直写会被旧快照覆盖——enabled/port 静默回跳）。
        await mutateState(function (state) {
          if (state.mobile === null) state.mobile = { enabled: false, port: 8787, secret: '', devices: [] }
          state.mobile.enabled = body.enabled === true
          if (Number.isInteger(body.port) && body.port > 0 && body.port < 65536) state.mobile.port = body.port
        })
        if (body.enabled === true) await mobileControls.startMobile()
        else await mobileControls.stopMobile()
        sendJson(res, 200, { ok: true, value: mobileControls.mobileStatus() })
      },
    },
    // POST /dsh-base-plugin/api/mobile/revoke { deviceId }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mobile/revoke',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const deviceId = String(body.deviceId ?? '')
        if (deviceId === '') throw new Error('dsh-base-plugin: deviceId is required')
        const auth = ensureAuth()
        const revoked = auth.revoke(deviceId)
        mobileControls.persistMobile()
        sendJson(res, 200, { ok: true, value: { deviceId, revoked } })
      },
    },
    // POST /dsh-base-plugin/api/mobile/rotate —— 轮换 HMAC 密钥，所有已
    // 签发的 Cookie 立即失效。代理用共享的 auth 实例校验，无需重启。
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/mobile/rotate',
      handler: async (_req, res) => {
        const auth = ensureAuth()
        auth.rotateSecret()
        mobileControls.persistMobile()
        sendJson(res, 200, { ok: true, value: { rotated: true } })
      },
    },
  ]
}

export function serviceRoutes(ctx) {
  return [
    // GET /dsh-base-plugin/api/service/info — process facts + availability
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/service/info',
      handler: async (_req, res) => {
        sendJson(res, 200, { ok: true, value: serviceInfo() })
      },
    },
    // GET /dsh-base-plugin/api/service/login-url —— 当前进程的浏览器登录
    // URL（重启恢复专用：外壳轮询到新进程后跳它自动换 30 天 cookie，
    // 免去 401 与手动找 token）。
    //
    // 暴露面收敛（launch token 等同 API 全权凭证）：
    //  - strict 同源（Sec-Fetch 语义）——跨源浏览器请求拒；
    //  - 携带 x-forwarded-for 的请求拒——手机代理转发即带此头，LAN 设备
    //    无法经 8787 套取 token（代理自身已用注入 cookie，无需它）；
    //  - Host 白名单由分发器统一把关。
    // 剩余可达面 = 本机浏览器同源页面（本就有 cookie）与本机进程
    // （可直接读同文件，同一信任域）。
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/service/login-url',
      handler: async (req, res) => {
        if (!sameOrigin(req, true) || req.headers['x-forwarded-for'] !== undefined) {
          sendJson(res, 403, { ok: false, error: 'forbidden' })
          return
        }
        let urls = []
        try {
          urls = readFileSync(join(dshHome(), 'dsh-web-url.txt'), 'utf8')
            .split('\n').map(line => line.trim()).filter(line => line.startsWith('http'))
        } catch {
          urls = []
        }
        // cookie 按访问域名绑定：优先返回与本次请求 Host 同域的行，
        // 使换发的 cookie 恰好落当前浏览器所在的域。
        const host = String(req.headers.host ?? '')
        const url = urls.find(u => {
          try { return new URL(u).host === host } catch { return false }
        }) ?? urls[0] ?? ''
        sendJson(res, 200, { ok: true, value: { url } })
      },
    },
    // POST /dsh-base-plugin/api/service/stop — graceful shutdown
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/service/stop',
      handler: async (_req, res) => {
        const value = stopService(ctx)
        sendJson(res, 200, { ok: true, value })
      },
    },
    // POST /dsh-base-plugin/api/service/restart — helper re-exec + shutdown
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/service/restart',
      handler: async (_req, res) => {
        const value = restartService(ctx)
        sendJson(res, 200, { ok: true, value })
      },
    },
  ]
}
