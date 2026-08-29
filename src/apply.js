// ══ apply ══ 插件 apply()：locale 注册、全部槽位注册与清理、能力探测。插件的组装层。
    // ── 插件 apply ────────────────────────────────────────────────────────

    var inject = ['slots']

    async function apply(ctx) {
      // slots 是上方声明的硬依赖：Cordis 保证 apply 运行时服务已挂载，
      // 直接经声明通道读取（声明 inject 后不再对同一服务用 ctx.get 探测）。
      // locale 等可选能力仍走 ctx.get + 缺席处理。
      var slots = ctx.slots

      var disposeStyles = injectStyles()

      var locale = ctx.get('locale')
      var t = fallbackT
      var localeDisposers = []
      if (locale !== undefined && typeof locale.register === 'function' && typeof locale.bind === 'function') {
        localeDisposers.push(locale.register('dsh-base-plugin', 'zh', ZH))
        localeDisposers.push(locale.register('dsh-base-plugin', 'en', EN))
        t = locale.bind('dsh-base-plugin')
        if (typeof locale.subscribe === 'function') {
          localeDisposers.push(locale.subscribe(function () { bumpLocale() }))
        }
      }
      currentT = t

      var serviceController = createServiceController()
      var toolsController = createToolsController()

      // 设置导航图标：把我们的节与外壳的齿轮兜底区分开（按标签匹配的
      // DOM 补丁；见 installSettingsNavIcons）。
      var disposeNavIcons = installSettingsNavIcons(t)

      // 会话消息刻度轨道：原生滚动条旁按用户/AI 消息摆刻度，点击跳转
      // （见 installChatRail）。
      var disposeChatRail = installChatRail(t)

      // ⋯ 菜单各工具面板的可用性，从宿主半探测（git 二进制/终端服务/
      // 监控数据源是否挂载）。用 store 而非 apply 时常量：探测结果可能
      // 晚于菜单挂载返回。合并式更新（读改写）——多个探测并发落地时
      // 任何一个都不得覆盖其余字段。
      var capabilities = createStore({ changes: false, terminal: false, monitor: false, promptOpt: false })
      var mergeCaps = function (patch) {
        capabilities.set(Object.assign({}, capabilities.getSnapshot(), patch))
      }
      api('/git/available')
        .then(function (value) { mergeCaps({ changes: value.available === true }) })
        .catch(function () { /* older host half: entry stays hidden */ })
      api('/terminal/available')
        .then(function (value) { mergeCaps({ terminal: value.available === true }) })
        .catch(function () { /* terminals service not mounted: entry stays hidden */ })
      api('/monitor/available')
        .then(function (value) { mergeCaps({ monitor: value.available === true }) })
        .catch(function () { /* monitor sources not mounted: entry stays hidden */ })
      api('/prompt-opt/available')
        .then(function (value) { mergeCaps({ promptOpt: value.available === true }) })
        .catch(function () { /* llm service not mounted: entry stays hidden */ })

      // 会话头部 ⋯ 菜单（工具面板入口）——用右对齐的 utilities 行
      // （titleRow 右端），不用标题旁的 actions 组：视觉上是头部右上角、
      // 与标题同线，而不是挤在面包屑边上。
      var disposeHeaderMore = slots.inject('conversation.session.header.utilities', function () {
        return slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'dsh-base-plugin-session-more',
            order: 100,
            label: 'Session more',
            registrant: 'dsh-base-plugin',
          },
          function (kit) {
            return h(SessionHeaderMore, { t: t, kit: kit, caps: capabilities, tools: toolsController })
          },
        )
      })

      // 文件变更/终端面板经 ⋯ 菜单 + 上面的右侧停靠面板
      // （ToolsOverlay）呈现——不进 conversation.view 的 tab 环，tab 栏
      // 只保留外壳自己的标签（聊天/轨迹）。
      var disposeTools = slots.inject('shell.overlay', function () {
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-tools',
            order: 205, // above the service status card (200), below confirm (210)
            label: 'Tools overlay',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ToolsOverlay, { t: t, caps: capabilities, controller: toolsController }) },
        )
      })

      // 不透明底部背垫（防闪烁）：footer 首个动作项，整条底部区域下
      // 方的绝对定位垫层。
      var disposeFooterBackdrop = slots.inject('sidebar.footer.action', function () {
        return slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-base-plugin-footer-backdrop',
            order: -1000,
            label: 'Footer backdrop',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(FooterBackdrop) },
        )
      })

      // 应用内确认对话框（可主题化的 window.confirm 替代），挂载在所有
      // 页面之上：市场标签页、各设置节、侧栏底部按钮都经此卡等待
      // showConfirm。
      var disposeConfirmSlot = slots.inject('shell.overlay', function () { // 改名避开 shared.js 的 disposeConfirm()（同名曾使其被遮蔽成死代码）
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-confirm',
            order: 210,
            label: 'Confirm',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ConfirmDialog) },
        )
      })

      // 侧栏底部设置旁的停止/重启按钮。宿主传 `wide`（false = 56px 轨
      // 道模式），切换连排与圆形两种形态。
      var disposeSvcActions = slots.inject('sidebar.footer.action', function () {
        return slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-base-plugin-service',
            order: 10,
            label: 'Service',
            registrant: 'dsh-base-plugin',
          },
          function (ownerProps) {
            return h(ServiceFooterActions, {
              t: t,
              controller: serviceController,
              wide: ownerProps !== null && typeof ownerProps === 'object' && ownerProps.wide === false ? false : true,
            })
          },
        )
      })

      // 停止/重启期间的满屏状态卡。
      var disposeSvcOverlay = slots.inject('shell.overlay', function () {
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-service',
            order: 200,
            label: 'Service status',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ServiceOverlay, { t: t, controller: serviceController }) },
        )
      })

      var disposeMarket = slots.inject('settings.plugins.tab', function () {
        return slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'market',
            order: 80,
            label: function () { return t('tabMarket') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(MarketTab, { t: t }) },
        )
      })

      var disposeUsage = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-usage',
            order: 11, // right after Models (order 10)
            label: function () { return t('sectionUsage') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(UsageSection, { t: t }) },
        )
      })

      var disposePrompt = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-prompt',
            order: 199,
            label: function () { return t('sectionPrompt') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(PromptSection, { t: t }) },
        )
      })

      var disposeMcp = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-mcp',
            order: 200,
            label: function () { return t('sectionMcp') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(McpSection, { t: t }) },
        )
      })

      var disposeSkills = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-skills',
            order: 201,
            label: function () { return t('sectionSkills') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(SkillsSection, { t: t }) },
        )
      })

      var disposeSessions = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-sessions',
            order: 202,
            label: function () { return t('sectionSessions') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(SessionsSection, { t: t }) },
        )
      })

      var disposeMobile = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-mobile',
            order: 203,
            label: function () { return t('sectionMobile') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(MobileSection, { t: t }) },
        )
      })

      // 通知桥设置节（渠道/事件开关/测试/静音）。
      var disposeNotify = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-notify',
            order: 204,
            label: function () { return t('sectionNotify') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(NotifySection, { t: t }) },
        )
      })

      // 访问与安全设置节（登录 URL/二维码、上游版本、健康自检）。
      var disposeOps = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-ops',
            order: 205,
            label: function () { return t('sectionOps') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(OpsSection, { t: t }) },
        )
      })

      // 浏览器通知渠道的事件泵：启用且渠道=browser 且已授权时 30s 轮询。
      // 三个关键设计：
      // 1. 游标以「泵启动时刻」为起点（Date.now()）——若从 0 起会把环形
      //    缓冲里的历史事件在每次页面刷新后重放成一批迟到弹窗；
      // 2. 多标签页去重：同源标签共享 localStorage，泵用「标签专属键 + 
      //    时间窗」仲裁——30s 窗口内在另一个标签已处理的事件跳过；
      // 3. /notify 配置查询本身是门：禁用或非 browser 渠道时连
      //    /notify/events 都不发（避免每 30s 一发空转请求）。
      var ntfTimer = null
      // 游标只用宿主返回的 seq（跨机时钟不可比较——宿主 at/客户端
      // Date.now 混用曾在时钟偏差的手机上静默丢通知）。null = 首轮：
      // 先拉一次对齐 cursor，不弹历史。
      var ntfCursor = null
      var NTF_PUMP_KEY = 'dsh-base-plugin:notify-cursor'
      function ntfApplyResult(r) {
        var events = r.events ?? []
        for (var i = 0; i < events.length; i += 1) {
          var ev = events[i]
          // tag 去重：多标签并发泵时浏览器层合并同 tag 弹窗
          try { new Notification(ev.title, { body: ev.body, tag: 'dshbp-' + ev.seq }) } catch (err2) { /* 极端环境 */ }
        }
        if (typeof r.cursor === 'number') {
          ntfCursor = r.cursor
          try { window.localStorage.setItem(NTF_PUMP_KEY, String(ntfCursor)) } catch (err3) { /* 独立游标降级 */ }
        }
      }
      function ntfPump() {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        api('/notify').then(function (cfg) {
          if (cfg === undefined || cfg === null || cfg.enabled !== true || cfg.channel !== 'browser') return null
          if (ntfCursor === null) {
            // 首轮对齐：采纳跨标签共享 cursor（别的标签已在收），没有
            // 则拉当前 cursor 不弹历史。
            try { ntfCursor = Number(window.localStorage.getItem(NTF_PUMP_KEY) ?? '0') || 0 } catch (err) { ntfCursor = 0 }
          } else {
            try {
              var shared = Number(window.localStorage.getItem(NTF_PUMP_KEY) ?? '0')
              if (shared > ntfCursor) ntfCursor = shared
            } catch (err4) { /* 降级独立 */ }
          }
          return api('/notify/events?since=' + ntfCursor).then(ntfApplyResult)
        }).catch(function () { /* 泵失败静默，下轮再试 */ })
      }
      // 回前台立即补一次泵（Chrome 对后台标签节流 30s→~60s+）。
      var ntfVis = function () { if (document.visibilityState === 'visible') ntfPump() }
      document.addEventListener('visibilitychange', ntfVis)
      ntfTimer = setInterval(ntfPump, 30000)

      ctx.effect(function () {
        return function () {
          if (ntfTimer !== null) clearInterval(ntfTimer)
          document.removeEventListener('visibilitychange', ntfVis)
          if (disposeStyles !== undefined) disposeStyles()
          disposeConfirm() // body 级对话框 DOM 拆除（shared.js）
          serviceController.dispose()
          disposeSvcActions()
          disposeSvcOverlay()
          disposeFooterBackdrop()
          disposeConfirmSlot()
          disposeHeaderMore()
          disposeTools()
          disposeUsage()
          disposeMarket()
          disposePrompt()
          disposeMcp()
          disposeSkills()
          disposeNavIcons()
          disposeChatRail()
          disposeSessions()
          disposeMobile()
          disposeNotify()
          disposeOps()
          for (var j = 0; j < localeDisposers.length; j += 1) {
            var dispose = localeDisposers[j]
            if (typeof dispose === 'function') dispose()
          }
        }
      }, 'dsh-base-plugin: contributions')
    }

    exports.name = 'dsh-base-plugin'
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
