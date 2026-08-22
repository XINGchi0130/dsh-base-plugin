// ══ navicons ══ 设置导航图标 DOM 补丁 installSettingsNavIcons：按标签匹配替换外壳齿轮图标 + 移动端结构打标。
    // ── 设置导航图标（DOM 补丁）───────────────────────────────────────────

    /**
     * 设置外壳（ui-settings-general SettingsRoot）的导航图标来自硬编码的
     * id→图标映射，只覆盖核心节
     * (models / agent-presets / plugins); every other row — including all
     * five of this plugin's sections — falls back to the same settings
     * gear, and the section slot contract carries no icon field. This patch
     * differentiates OUR rows: a MutationObserver watches for the settings
     * dialog, matches nav buttons by their CURRENT localized label (so
     * locale switches re-resolve), and for each match inserts our 16px
     * outline glyph BEFORE the shell's gear while hiding the gear — insert +
     * hide, never remove, so React's own reconciliation of that subtree
     * stays intact (React only ever removes the gear node it created, which
     * remains in place; a re-render that recreates it is simply re-patched
     * by the observer). Core sections never match our label set and keep
     * their shell-owned icons.
     */
    var SECTION_NAV_ICONS = {
      usage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M7 20v-6"/><path d="M12 20V9"/><path d="M17 20V4"/></svg>',
      prompt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
      mcp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/><path d="M7 7h10v4a5 5 0 0 1-10 0z"/><line x1="12" y1="16" x2="12" y2="21"/></svg>',
      skills: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.2"/></svg>',
      sessions: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
      mobile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
      notify: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    }

    /** 节键 → 导航标签当前取值所用的 i18n 键。 */
    var SECTION_NAV_LABEL_KEYS = {
      usage: 'sectionUsage',
      prompt: 'sectionPrompt',
      mcp: 'sectionMcp',
      skills: 'sectionSkills',
      sessions: 'sectionSessions',
      mobile: 'sectionMobile',
      notify: 'sectionNotify',
    }

    /** 单趟扫描：为每个打开对话框里命中的导航按钮打补丁。幂等性以
     * 「扫描按钮的 svg 是否已带我们的标记」判定——绝不能用「齿轮前的
     * svg」：第一趟之后我们的图标就是第一个 svg，previousSibling 探测
     * 永远不再命中，观察器（对我们自己的插入也触发）会每帧重打补丁，
     * 每趟泄漏一个隐藏节点。 */
    function patchSettingsNavIcons(t) {
      var dialogs = document.querySelectorAll('div[role="dialog"]')
      for (var d = 0; d < dialogs.length; d += 1) {
        // 移动端适配钩子：给设置面板及其导航/选项区打结构标签，插件
        // 样式表据此在手机宽度重排——无需碰 harness 源码（类名是
        // CSS-module 哈希；这些结构属性稳定）。每趟重复打标——幂等。
        var nav = dialogs[d].querySelector('nav')
        if (nav !== null) {
          dialogs[d].setAttribute('data-dhb-settings-panel', '1')
          nav.setAttribute('data-dhb-settings-nav', '1')
          var content = nav.nextElementSibling
          // content's element children are exactly [header, options] —
          // children (not querySelectorAll) avoids matching nested leaves.
          if (content !== null) {
            // 纵向翻转修复：外壳给 .content 只设了 min-width:0（行布局
            // ——高度从不参与 flex 分配）。手机纵向布局里 min-height:auto
            // 把它钉在内容高度，溢出面板、杀死选项区滚动。
            content.setAttribute('data-dhb-settings-content', '1')
            if (content.children.length > 1) {
              content.children[content.children.length - 1].setAttribute('data-dhb-settings-options', '1')
            }
          }
        }
        var buttons = dialogs[d].querySelectorAll('button')
        for (var i = 0; i < buttons.length; i += 1) {
          var button = buttons[i]
          var span = button.querySelector('span')
          if (span === null) continue
          var label = (span.textContent || '').trim()
          var matched = null
          for (var key in SECTION_NAV_LABEL_KEYS) {
            if (label === t(SECTION_NAV_LABEL_KEYS[key])) { matched = key; break }
          }
          if (matched === null) continue
          var svgs = button.querySelectorAll('svg')
          if (svgs.length === 0) continue
          var mine = null
          for (var s = 0; s < svgs.length; s += 1) {
            var node = svgs[s]
            if (mine === null && node.getAttribute('data-dhb-nav') === matched) mine = node
            else node.style.display = 'none' // the shell's gear, or a stale duplicate
          }
          if (mine !== null) continue // already patched
          svgs[0].insertAdjacentHTML('beforebegin', SECTION_NAV_ICONS[matched])
          var inserted = svgs[0].previousSibling
          if (inserted !== null && inserted.nodeType === 1) inserted.setAttribute('data-dhb-nav', matched)
        }
      }
    }

    /** 安装设置导航图标补丁器；返回其 disposer。 */
    function installSettingsNavIcons(t) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return function () {}
      }
      var scheduled = false
      var schedule = function () {
        if (scheduled) return
        scheduled = true
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () { scheduled = false; patchSettingsNavIcons(t) })
        } else {
          setTimeout(function () { scheduled = false; patchSettingsNavIcons(t) }, 16)
        }
      }
      var observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
      schedule()
      return function () { observer.disconnect() }
    }
