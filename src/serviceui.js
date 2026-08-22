// ══ serviceui ══ 服务控制 UI：FooterBackdrop（防闪烁背垫）、ServiceFooterActions（停止/重启按钮）、ServiceOverlay（满屏状态卡）。
    function FooterBackdrop() {
      var colorState = React.useState(null)
      var color = colorState[0]
      var setColor = colorState[1]
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var read = function () {
          // 侧栏列自己的背景色——无论主题/解析到哪个 token——从活动
          // DOM 读一次，使垫层与周围绘制逐像素一致。
          var wrap = document.querySelector('.dhb-svcWrap')
          if (wrap === null) return
          var col = wrap
          while (col !== null && col.parentElement !== null) {
            const cs = getComputedStyle(col)
            if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') break
            col = col.parentElement
          }
          if (col === null) return
          var bg = getComputedStyle(col).backgroundColor
          setColor(function (prev) { return prev === bg ? prev : bg })
        }
        read()
        var t = setInterval(read, 2000)
        return function () { clearInterval(t) }
      }, [])
      if (color === null) return null
      return h('div', { style: { position: 'relative', height: 0, width: '100%' } },
        h('div', { className: 'dhb-svcBackdrop', style: { background: color } }))
    }

    /**
     * 设置旁的停止/重启控件（sidebar.footer.action）。两种形态跟随侧栏
     * 自身节奏：宽列 = 两枚 34px 连排行（共用设置触发器的 12px 圆角与
     * 悬停底色）；56px 轨道 = 叠放的 36px 圆钮（与轨道设置钮同款）。
     */
    function ServiceFooterActions(props) {
      var t = props.t
      var controller = props.controller
      var wide = props.wide !== false
      var snap = useStore(controller.store)

      React.useEffect(function () { controller.checkAvailable() }, [controller])

      var avail = snap.available === true
      var busyPhase = snap.phase !== 'idle' && snap.phase !== 'failed'

      function onAction(kind) {
        var isStop = kind === 'stop'
        showConfirm(
          t(isStop ? 'confirmStopSvc' : 'confirmRestartSvc'),
          { okLabel: t(isStop ? 'serviceStop' : 'serviceRestart'), danger: isStop },
        )
          .then(function (ok) {
            if (!ok) return
            if (isStop) controller.stop()
            else controller.restart()
          })
      }

      var stopBtn = h('button', {
        className: (wide ? 'dhb-svcBtn dhb-svcStop' : 'dhb-svcRail dhb-svcStop'),
        type: 'button',
        disabled: !avail || busyPhase,
        title: avail ? t('serviceStopTitle') : t('svcUnavailable'),
        'aria-label': t('serviceStop'),
        onClick: function () { onAction('stop') },
      },
        h(PowerIcon, { size: wide ? 15 : 18 }),
        wide ? h('span', null, t('serviceStop')) : null)

      var restartBtn = h('button', {
        className: wide ? 'dhb-svcBtn' : 'dhb-svcRail',
        type: 'button',
        disabled: !avail || busyPhase,
        title: avail ? t('serviceRestartTitle') : t('svcUnavailable'),
        'aria-label': t('serviceRestart'),
        onClick: function () { onAction('restart') },
      },
        h(RestartIcon, { size: wide ? 15 : 18 }),
        wide ? h('span', null, t('serviceRestart')) : null)

      return wide
        ? h('div', { className: 'dhb-svcWrap' }, stopBtn, restartBtn)
        : h('div', { className: 'dhb-svcRailWrap' }, stopBtn, restartBtn)
    }

    /** 停止/重启进行中的满屏状态卡。 */
    function ServiceOverlay(props) {
      var t = props.t
      var snap = useStore(props.controller.store)
      if (snap.phase === 'idle') return null
      var text
      var spinning = false
      if (snap.phase === 'stopping') { text = t('svcStopping'); spinning = true }
      else if (snap.phase === 'stopped') { text = t('svcStopped') }
      else if (snap.phase === 'restarting') {
        spinning = true
        text = snap.sec > 0 ? t('svcRestartWait', { sec: snap.sec }) : t('svcRestarting')
      } else { // failed
        text = t('svcRestartFailed', { cmd: snap.cmd !== '' ? snap.cmd : 'pnpm dsh web' })
      }
      return h('div', { className: 'dhb-svcOverlay' },
        h('div', { className: 'dhb-svcCard' },
          spinning ? h('div', { className: 'dhb-svcSpin' }) : null,
          h('div', null, text)))
    }
