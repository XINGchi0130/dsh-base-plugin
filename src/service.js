// ══ service ══ dsh 进程停止/重启控制器 createServiceController（轮询新进程、宽限期倒计时）。
    // ── 服务生命周期（停止/重启）──────────────────────────────────────────

    /**
     * dsh 进程停止/重启动作的控制器。宿主半的端点在应答后即销毁进程，
     * 因此确认成功后的 POST 失败是**预期内**的（连接被断开）、直接忽略。
     * 重启后轮询直到新进程应答，然后刷新外壳。
     */
    function createServiceController() {
      var store = createStore({ phase: 'idle', available: undefined, sec: 0, cmd: '' })
      var timers = [] // 本控制器排下的所有定时器（dispose 一并清）

      function checkAvailable() {
        api('/service/info')
          .then(function (value) {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle' || snap.phase === 'failed') {
              store.set({ phase: 'idle', available: true, sec: 0, cmd: value.command })
            }
          })
          .catch(function () {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle') {
              store.set({ phase: 'idle', available: false, sec: 0, cmd: '' })
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
        store.set({ phase: 'restarting', available: false, sec: 0, cmd: cmd })
        post('/service/restart', {}).catch(function () { /* dropped = expected */ })
        var start = Date.now()
        var tick = function () {
          var snap = store.getSnapshot()
          if (snap.phase !== 'restarting') return
          var sec = Math.round((Date.now() - start) / 1000)
          if (sec > 90) {
            store.set({ phase: 'failed', available: false, sec: sec, cmd: cmd })
            return
          }
          api('/service/info')
            .then(function () {
              // A process answered again — re-bootstrap the whole shell.
              try { window.location.reload() } catch (err) { /* manual refresh */ }
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