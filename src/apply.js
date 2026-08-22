// ══ apply ══ 插件 apply()：locale 注册、全部槽位注册与清理、能力探测。插件的组装层。
    // ── 插件 apply ────────────────────────────────────────────────────────

    var inject = ['slots']

    async function apply(ctx) {
      var slots = ctx.get('slots')
      if (slots === undefined) return

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

      // ⋯ 菜单各工具面板的可用性，从宿主半探测（git 二进制/终端服务
      // 是否挂载）。用 store 而非 apply 时常量：探测结果可能晚于菜单
      // 挂载返回。
      var capabilities = createStore({ changes: false, terminal: false })
      api('/git/available')
        .then(function (value) { capabilities.set({ changes: value.available === true, terminal: capabilities.getSnapshot().terminal }) })
        .catch(function () { /* older host half: entry stays hidden */ })
      api('/terminal/available')
        .then(function (value) { capabilities.set({ changes: capabilities.getSnapshot().changes, terminal: value.available === true }) })
        .catch(function () { /* terminals service not mounted: entry stays hidden */ })

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
      var disposeConfirm = slots.inject('shell.overlay', function () {
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

      ctx.effect(function () {
        return function () {
          if (disposeStyles !== undefined) disposeStyles()
          disposeSvcActions()
          disposeSvcOverlay()
          disposeFooterBackdrop()
          disposeConfirm()
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
