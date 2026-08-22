// ══ moremenu ══ 会话头部 ⋯ 菜单 SessionHeaderMore：工具面板入口（按 git/终端能力门控）。
    // ── 会话头部 ⋯ 菜单（工具面板入口）───────────────────────────────────

    /**
     * 会话头部操作行末端的 ⋯ 按钮：小下拉菜单，承载文件变更/终端面板
     * （右侧停靠覆盖层，按可用性门控）。两个宿主能力都未就绪时整体隐
     * 藏——没有 git 或终端服务的宿主不会看到孤儿按钮。
     */
    function SessionHeaderMore(props) {
      var t = props.t
      var kit = props.kit
      var caps = useStore(props.caps)
      useLocaleVersion()

      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]

      React.useEffect(function () {
        if (!open) return undefined
        var onDoc = function (e) {
          var el = e.target
          while (el !== null && el instanceof Element) {
            if (typeof el.className === 'string' && el.className.indexOf('dhb-smWrap') !== -1) return
            el = el.parentElement
          }
          setOpen(false)
        }
        if (typeof document !== 'undefined') {
          document.addEventListener('mousedown', onDoc)
          return function () { document.removeEventListener('mousedown', onDoc) }
        }
        return undefined
      }, [open])

      var sessionId = kit !== undefined ? kit.sessionId : undefined
      // 工具覆盖层是根作用域的，因此会话上下文在这里（会话作用域、真
      // kit）捕获、打开时移交：视图用的 cwd、侧栏面包屑用的标题。两个
      // 独立选择器（只返回字符串）——返回对象会让每次 getSnapshot 产生
      // 新快照引用、令 useSyncExternalStore 死循环。
      // hook 无条件调用一次（kit 形状恒定取值，不恒定 hook 数——条件调用
      // 曾是工具坞崩溃的同族潜伏雷：任一 kit 来源中途补上/丢失
      // useSessions，hook 数即变，直接"Rendered fewer hooks"级崩溃）。
      var useSessionsHook = kit !== undefined && typeof kit.useSessions === 'function' ? kit.useSessions : function () { return '' }
      var rowRef = useSessionsHook(function (s) {
        return sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
      })
      var cwd = rowRef !== undefined && typeof rowRef.cwd === 'string' ? rowRef.cwd : ''
      var title = rowRef !== undefined && typeof rowRef.title === 'string' && rowRef.title !== ''
        ? rowRef.title
        : (sessionId !== undefined ? sessionId.slice(0, 8) : '')

      function onOpenTool(panel) {
        setOpen(false)
        if (props.tools !== undefined) props.tools.open(panel, sessionId, title, cwd)
      }

      // 无可用面板（无 git 二进制、无终端服务、无监控数据源）：⋯ 菜单
      // 会是空的——干脆不渲染按钮。
      if (caps.changes !== true && caps.terminal !== true && caps.monitor !== true) return null

      return h('div', { className: 'dhb-smWrap' },
        h('button', {
          className: 'dhb-smBtn', type: 'button',
          title: t('sessionMore'),
          'aria-label': t('sessionMore'),
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function (e) { e.stopPropagation(); setOpen(function (v) { return !v }) },
        },
          h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
            h('circle', { cx: 5, cy: 12, r: 1.6 }),
            h('circle', { cx: 12, cy: 12, r: 1.6 }),
            h('circle', { cx: 19, cy: 12, r: 1.6 }))),
        open ? h('div', { className: 'dhb-smMenu', role: 'menu' },
          caps.changes === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('changes') },
          }, h(FileDiffIcon, { size: 14 }), h('span', null, t('tabChanges'))) : null,
          caps.terminal === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('terminal') },
          }, h(TerminalIcon, { size: 14 }), h('span', null, t('tabTerminal'))) : null,
          caps.monitor === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('monitor') },
          }, h(MonitorIcon, { size: 14 }), h('span', null, t('tabMonitor'))) : null,
        ) : null,
      )
    }
