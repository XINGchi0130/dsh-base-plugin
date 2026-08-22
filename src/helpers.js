// ══ helpers ══ 轻量响应式 store（createStore）与宿主 HTTP api() 辅助。所有节共享的数据获取底座。
    // ── 轻量 store ────────────────────────────────────────────────────────

    function createStore(initial) {
      var snapshot = initial
      var subs = new Set()
      return {
        getSnapshot: function () { return snapshot },
        set: function (next) {
          snapshot = next
          subs.forEach(function (fn) { fn() })
        },
        subscribe: function (fn) {
          subs.add(fn)
          return function () { subs.delete(fn) }
        },
      }
    }

    function useStore(store) {
      // 无条件走 useSyncExternalStore：本插件的 client bundle 恒带
      // React ≥18（dsh web 平台要求），旧版 useState 回退分支只是
      // 历史包袱且本身是条件 hook（崩溃潜伏雷）——删除。
      var value = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      return value
    }

    // ── api 辅助 ──────────────────────────────────────────────────────────

    function api(path, init) {
      var fetcher = typeof globalThis !== 'undefined' ? globalThis.fetch : undefined
      if (typeof fetcher !== 'function') {
        return Promise.reject(new Error('fetch is unavailable in this browser'))
      }
      return fetcher('/dsh-base-plugin/api' + path, init).then(function (res) {
        return res.json().then(function (payload) {
          if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
            throw new Error(payload !== null && typeof payload === 'object' && typeof payload.error === 'string'
              ? payload.error
              : 'HTTP ' + res.status)
          }
          return payload.value
        }, function () {
          // 非 JSON 应答体（代理错误页、截断响应）：裸的
          // "Unexpected token" 对谁都没帮助。
          throw new Error('bad response from the dsh-base-plugin API (HTTP ' + res.status + ') — is dsh restarting?')
        })
      })
    }
