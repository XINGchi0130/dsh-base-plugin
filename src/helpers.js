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
      if (React.useSyncExternalStore !== undefined) {
        return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      }
      var state = React.useState(store.getSnapshot())
      React.useEffect(function () {
        return store.subscribe(function () { state[1](store.getSnapshot()) })
      }, [store])
      return state[0]
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
