// ══ panels ══ 工具坞 ToolsOverlay：真实停靠（框架被面板宽度挤窄）、拖拽调宽、面包屑 + 面板切换 + createToolsController。
    // ── 工具坞覆盖层（文件变更/终端面板）─────────────────────────────────

    /**
     * ⋯ 菜单工具面板的控制器。覆盖层在根作用域（shell.overlay），那里
     * 没有会话 kit，因此菜单在点击时捕获 {sessionId, sessionTitle, cwd}，
     * 覆盖层给内嵌视图喂合成 kit——两个视图都只消费 sessionId 与
     * useSessions(选择器 → row.cwd)。sessionTitle 供侧栏面包屑；switch()
     * 换面板时保留已捕获的上下文。
     */
    function createToolsController() {
      var store = createStore({ panel: null, sessionId: undefined, sessionTitle: '', cwd: '' })
      return {
        store: store,
        open: function (panel, sessionId, sessionTitle, cwd) {
          store.set({
            panel: panel,
            sessionId: sessionId,
            sessionTitle: typeof sessionTitle === 'string' ? sessionTitle : '',
            cwd: typeof cwd === 'string' ? cwd : '',
          })
        },
        switch: function (panel) {
          var snap = store.getSnapshot()
          if (snap.panel === panel) return
          store.set({ panel: panel, sessionId: snap.sessionId, sessionTitle: snap.sessionTitle, cwd: snap.cwd })
        },
        close: function () {
          store.set({ panel: null, sessionId: undefined, sessionTitle: '', cwd: '' })
        },
      }
    }

    /**
     * 右侧停靠的非模态面板，承载文件变更与终端，从会话头部 ⋯ 菜单打开
     * 而非会话 tab 环（tab 栏不进插件项）。真停靠、非浮层：打开期间应用
     * 框架（外壳三列网格）被面板宽度经行内 margin 挤窄，聊天列真正变窄、
     * 固定定位的面板占据视口右缘腾出的条带——无任何重叠。框架经外壳
     * 稳定的 `[data-shell-overlay]` 标记（其父级）定位；该锚点若消失则
     * 跳过 margin 步骤、面板退回纯浮动（优雅降级）。
     * 布局：左缘拖拽调宽柄（宽 360–760px，框架 margin 随拖动），顶栏
     * ——面包屑（会话标题 › 当前面板）+ 关闭钮——之下是横向工具导航行
     * （文件变更/终端，就地切换），再往下是活动视图主区。Esc 关闭；
     * 卸载经视图自身的清理停掉终端轮询。z-index 1500：高于服务卡
     * （1000）、低于确认框（2000），面板内确认不被盖住。
     */
    function ToolsOverlay(props) {
      var t = props.t
      var caps = useStore(props.caps)
      useLocaleVersion()
      var snap = useStore(props.controller.store)

      var widthState = React.useState(520)
      var width = widthState[0]
      var setWidth = widthState[1]

      React.useEffect(function () {
        if (snap.panel === null) return undefined
        var onKey = function (e) { if (e.key === 'Escape') props.controller.close() }
        if (typeof document !== 'undefined') {
          document.addEventListener('keydown', onKey)
          return function () { document.removeEventListener('keydown', onKey) }
        }
        return undefined
      }, [snap.panel, props.controller])

      // 停靠挤压：按面板宽度收窄外壳框架，聊天列真正重排而非被覆盖。
      // 框架自己的 ResizeObserver 会对减小后的宽度重解网格列。每次宽度
      // 变化（拖拽）都重跑；清理时恢复先前的行内 margin。margin 与 CSS
      // 的 max-width 钳制（极小视口）保持一致，让腾出的条带与实际渲染
      // 的面板严格同宽。
      React.useEffect(function () {
        if (snap.panel === null) return undefined
        if (typeof document === 'undefined') return undefined
        var layer = document.querySelector('[data-shell-overlay]')
        var frame = layer !== null ? layer.parentElement : null
        if (frame === null || frame === undefined) return undefined
        var vw = typeof window !== 'undefined' ? window.innerWidth : 0
        var effective = vw > 0 && width > vw - 56 ? vw - 56 : width
        var prev = frame.style.marginRight
        frame.style.marginRight = effective + 'px'
        return function () { frame.style.marginRight = prev }
      }, [snap.panel, width])

      if (snap.panel === null) return null

      // A panel whose capability vanished (probe raced negative, service
      // went away) falls back to another available one; none → close.
      var panel = snap.panel
      if (panel === 'changes' && caps.changes !== true) panel = caps.terminal === true ? 'terminal' : (caps.monitor === true ? 'monitor' : null)
      else if (panel === 'terminal' && caps.terminal !== true) panel = caps.changes === true ? 'changes' : (caps.monitor === true ? 'monitor' : null)
      else if (panel === 'monitor' && caps.monitor !== true) panel = caps.changes === true ? 'changes' : (caps.terminal === true ? 'terminal' : null)
      if (panel === null) return null

      var sessionLabel = snap.sessionTitle !== ''
        ? snap.sessionTitle
        : (snap.sessionId !== undefined ? snap.sessionId.slice(0, 8) : '—')

      var changesIcon = h(FileDiffIcon, { size: 15 })
      var terminalIcon = h(TerminalIcon, { size: 15 })
      var monitorIcon = h(MonitorIcon, { size: 15 })

      var navItem = function (key, label, icon) {
        return h('button', {
          className: 'dhb-toolsNavItem', type: 'button',
          'data-active': panel === key ? '1' : '0',
          onClick: function () { props.controller.switch(key) },
        }, icon, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label))
      }

      var fakeKit = {
        sessionId: snap.sessionId,
        useSessions: function (selector) {
          var byId = {}
          if (snap.sessionId !== undefined) byId[snap.sessionId] = { cwd: snap.cwd }
          return selector({ byId: byId })
        },
      }

      // 左缘拖拽调宽：指针 x → 停靠宽度（钳制在 360–760）。监听器只在
      // 拖拽期间挂在 document 上。
      function startResize(e) {
        if (typeof document === 'undefined') return
        e.preventDefault()
        var onMove = function (ev) {
          var w = window.innerWidth - ev.clientX
          if (w < 360) w = 360
          if (w > 760) w = 760
          setWidth(w)
        }
        var onUp = function () {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }

      return h('div', { className: 'dhb-toolsDock', style: { width: width + 'px' } },
        h('div', {
          className: 'dhb-toolsResize', role: 'separator', 'aria-orientation': 'vertical',
          title: t('toolsResize'),
          onMouseDown: startResize,
        }),
        h('div', { className: 'dhb-toolsMain' },
          h('div', { className: 'dhb-toolsHead' },
            h('div', { className: 'dhb-toolsCrumb', title: sessionLabel },
              h('span', { className: 'dhb-toolsCrumbSess' }, sessionLabel)),
            h('button', { className: 'dhb-btn', type: 'button', onClick: props.controller.close }, t('toolsClose')),
          ),
          h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('sessionMore') },
            caps.changes === true ? navItem('changes', t('tabChanges'), changesIcon) : null,
            caps.terminal === true ? navItem('terminal', t('tabTerminal'), terminalIcon) : null,
            caps.monitor === true ? navItem('monitor', t('tabMonitor'), monitorIcon) : null,
          ),
          h('div', { className: 'dhb-toolsBody' },
            panel === 'terminal'
              ? h(TerminalView, { t: t, kit: fakeKit })
              : panel === 'monitor'
                ? h(MonitorView, { t: t, kit: fakeKit })
                : h(ChangesView, { t: t, kit: fakeKit }),
          ),
        ),
      )
    }
