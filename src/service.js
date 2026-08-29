// ══ service ══ dsh 进程停止/重启控制器 createServiceController（轮询新进程、宽限期倒计时）。
    // ── 服务生命周期（停止/重启）──────────────────────────────────────────

    /**
     * dsh 进程停止/重启动作的控制器。宿主半的端点在应答后即销毁进程，
     * 因此确认成功后的 POST 失败是**预期内**的（连接被断开）、直接忽略。
     * 重启后轮询直到**新 pid**应答（旧进程有 EXIT_DELAY 退场窗口，期间
     * 仍能应答——不比 pid 会提前"恢复"，跳过去必 401），然后取新进程
     * 的登录 URL 跳 /?token=… 自动换 30 天 cookie；取不到再裸刷新兜底。
     */
    function createServiceController() {
      var store = createStore({ phase: 'idle', available: undefined, sec: 0, cmd: '', pid: null })
      var timers = [] // 本控制器排下的所有定时器（dispose 一并清）

      function checkAvailable() {
        api('/service/info')
          .then(function (value) {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle' || snap.phase === 'failed') {
              store.set({ phase: 'idle', available: true, sec: 0, cmd: value.command, pid: value.pid ?? null })
            }
          })
          .catch(function () {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle') {
              store.set({ phase: 'idle', available: false, sec: 0, cmd: '', pid: null })
            }
          })
      }

      function stop() {
        store.set({ phase: 'stopping', available: false, sec: 0, cmd: '' })
        post('/service/stop', {}).catch(function () { /* dropped = expected */ })
        // 没有复苏可等：宽限期后直接显示已停止提示。
        timers.push(setTimeout(function () {
          var snap = store.getSnapshot()
          if (snap.phase === 'stopping') {
            store.set({ phase: 'stopped', available: false, sec: 0, cmd: '' })
          }
        }, 5000))
      }

      function restart() {
        var cmd = store.getSnapshot().cmd
        var oldPid = store.getSnapshot().pid
        store.set({ phase: 'restarting', available: false, sec: 0, cmd: cmd, pid: oldPid })
        post('/service/restart', {}).catch(function () { /* dropped = expected */ })
        var start = Date.now()

        // 新进程应答后跳它的登录 URL：换 30 天 cookie 再落回 /，免除
        // 裸刷新撞上 dsh ≥ 0.1.2-alpha.1 的浏览器鉴权围栏（401）。
        // token 文件由 connection 服务就绪时写，可能比 webServer 晚几
        // 秒——失败重试三轮再降级裸刷新。
        function recoverWithLoginUrl(attempt) {
          api('/service/login-url')
            .then(function (v) {
              if (v !== null && typeof v === 'object' && typeof v.url === 'string'
                && v.url.indexOf('/?token=') !== -1) {
                window.location.replace(v.url) // 303 换 cookie 后重定向回 /
                return
              }
              throw new Error('no token url')
            })
            .catch(function () {
              if (attempt < 3) {
                timers.push(setTimeout(function () { recoverWithLoginUrl(attempt + 1) }, 1500))
              } else {
                try { window.location.reload() } catch (err) { /* manual refresh */ }
              }
            })
        }

        var tick = function () {
          var snap = store.getSnapshot()
          if (snap.phase !== 'restarting') return
          var sec = Math.round((Date.now() - start) / 1000)
          if (sec > 90) {
            store.set({ phase: 'failed', available: false, sec: sec, cmd: cmd })
            return
          }
          api('/service/info')
            .then(function (value) {
              // 必须是新 pid：旧进程退场宽限期内仍会应答。
              if (oldPid !== null && typeof value.pid === 'number' && value.pid === oldPid) {
                throw new Error('old process still answering')
              }
              store.set({ phase: 'restarting', available: true, sec: sec, cmd: cmd, pid: value.pid ?? null })
              recoverWithLoginUrl(0)
            })
            .catch(function () {
              store.set({ phase: 'restarting', available: false, sec: sec, cmd: cmd })
              timers.push(setTimeout(tick, 1500))
            })
        }
        timers.push(setTimeout(tick, 1500))
      }

      /** 停止/重启链的定时器全部清除（插件停止时由 apply 清理调用——
       * 轮询链曾最长残留 90s）。 */
      function dispose() {
        for (var i = 0; i < timers.length; i += 1) clearTimeout(timers[i])
        timers.length = 0
      }

      return { store: store, checkAvailable: checkAvailable, stop: stop, restart: restart, dispose: dispose }
    }

    /**
     * 按键是否发生在 IME 组合期间（中/日文输入）。按回车**确认候选词**
     * 会触发 isComposing=true 的 Enter——当作提交就会执行打了一半的
     * 命令。keyCode 229 兜底不设 isComposing 的旧引擎。
     */