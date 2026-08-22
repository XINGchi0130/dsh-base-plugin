// ══ rail ══ 会话消息刻度轨道 installChatRail：滚动条旁用户/AI 消息刻度、点击跳转、悬停摘要（结构性排除 chrome）。
    // ── 会话滚动条消息刻度轨道 ────────────────────────────────────────────

    /**
     * 会话消息刻度轨道：当前会话列（`[data-conversation-scroll]`）原生
     * （harness 主题化）滚动条旁的细固定条。每条用户/打断/AI 消息行
     * （`[data-chat-flow-kind]`）一枚刻度，按行的流内偏移等比例定位；
     * 蓝 = 用户、绿 = AI。点击刻度滚动到该消息；悬停显示内容摘要；滚动
     * 时最接近视口中心的刻度保持高亮。轨道自身不画轨道底、不画视口
     * 胶囊——旁边原生滚动条已表达位置，再画一个会被看成第二根滚动条。
     *
     * 挂载跟踪用 body 级 MutationObserver（会话列随路由装卸）；内容跟踪
     * 用滚动容器内的观察器、约 250ms 防抖（全量重排是 O(行数)，流式输出
     * 不停改动子树）；几何还在滚动容器尺寸变化（工具坞挤压框架）与窗口
     * 缩放时重同步。一切以 position:fixed 挂在 document.body——不碰任何
     * React 子树，disposer 移除全部节点与观察器。
     */
    function installChatRail(t) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return function () {}
      }

      // 'assistant-step' is the assistant row's CHAT kind (register-node-
      // renderers); 'assistant' kept for forward compatibility.
      var RAIL_KINDS = { user: 'user', steering: 'user', assistant: 'assistant', 'assistant-step': 'assistant' }
      var RAIL_RIGHT = 22 // native scrollbar (~8px) + gap, rail sits beside it
      var TICK_MIN_GAP = 5
      var HOVER_HIDE_MS = 200

      var scrollport = null
      var rail = null
      var tip = null
      var ticks = [] // { el, row, role, flowTop }
      var bodyObserver = null
      var contentObserver = null
      var resizeObserver = null
      var refreshTimer = 0
      var scrollRaf = 0
      var tipTimer = 0

      /** 行相对滚动容器内容原点的流内偏移。 */
      function flowTopOf(row) {
        return row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top + scrollport.scrollTop
      }

      /** 几何同步：按滚动容器矩形摆放固定轨道。 */
      function place() {
        var rect = scrollport.getBoundingClientRect()
        rail.style.left = Math.round(rect.right - 12 - RAIL_RIGHT) + 'px'
        rail.style.top = Math.round(rect.top + 6) + 'px'
        rail.style.height = Math.round(rect.height - 12) + 'px'
      }

      /** 活跃刻度高亮（开销小；由滚动驱动）。轨道自身不画视口指示器
       *  ——旁边的原生滚动条已经承担。 */
      function syncView() {
        scrollRaf = 0
        if (scrollport === null || rail === null) return
        var span = scrollport.scrollHeight - scrollport.clientHeight
        rail.setAttribute('data-on', span > 4 ? '1' : '0')
        if (span <= 4) return
        // 活跃刻度：最后一个行顶已越过视口上三分点的行。
        var mark = scrollport.scrollTop + scrollport.clientHeight / 3
        var active = null
        for (var i = 0; i < ticks.length; i += 1) {
          if (ticks[i].flowTop <= mark) active = ticks[i]
          else break
        }
        for (var j = 0; j < ticks.length; j += 1) {
          ticks[j].el.setAttribute('data-active', ticks[j] === active ? '1' : '0')
        }
      }

      function scheduleSyncView() {
        if (scrollRaf !== 0) return
        scrollRaf = requestAnimationFrame(syncView)
      }

      /** 全量重排：从实时消息行重建刻度。 */
      function refresh() {
        refreshTimer = 0
        if (scrollport === null || rail === null) return
        for (var i = 0; i < ticks.length; i += 1) {
          if (ticks[i].el.parentNode !== null) ticks[i].el.parentNode.removeChild(ticks[i].el)
        }
        ticks = []
        var rows = scrollport.querySelectorAll('[data-chat-flow-kind]')
        var height = 0
        var span = scrollport.scrollHeight
        var rect = scrollport.getBoundingClientRect()
        var placed = []
        for (var r = 0; r < rows.length; r += 1) {
          var row = rows[r]
          var role = RAIL_KINDS[row.getAttribute('data-chat-flow-kind')]
          if (role === undefined) continue
          var flowTop = row.getBoundingClientRect().top - rect.top + scrollport.scrollTop
          placed.push({ row: row, role: role, flowTop: flowTop })
        }
        if (placed.length === 0 || span <= 0) { syncView(); return }
        // 显示阶段：等比例定位 + 最小间距，密集区不塌缩成一条像素棒。
        // 比例先于挂载计算（轨道高度只有 append 后才可读）。
        for (var p = 0; p < placed.length; p += 1) {
          placed[p].ratio = placed[p].flowTop / span
        }
        height = rail.clientHeight
        var lastTop = -Infinity
        for (var q = 0; q < placed.length; q += 1) {
          var entry = placed[q]
          var px = Math.round(entry.ratio * height)
          if (px - lastTop < TICK_MIN_GAP) px = lastTop + TICK_MIN_GAP
          if (px > height - 4) px = height - 4
          lastTop = px
          ticks.push(makeTick(entry, px))
        }
        syncView()
      }

      function makeTick(entry, px) {
        var el = document.createElement('div')
        el.className = 'dhb-railTick'
        el.setAttribute('data-role', entry.role)
        el.style.top = px + 'px'
        el.addEventListener('click', function (event) {
          event.stopPropagation()
          scrollport.scrollTo({ top: Math.max(0, entry.flowTop - 8), behavior: 'smooth' })
        })
        el.addEventListener('mouseenter', function () { showTip(el, entry) })
        el.addEventListener('mouseleave', hideTipSoon)
        rail.appendChild(el)
        return { el: el, row: entry.row, role: entry.role, flowTop: entry.flowTop }
      }

      /**
       * 消息行的结构性摘录：其文本节点减去操作栏 chrome（时钟、
       * "Ran for"、tok/s、复制/分支按钮文字）。
       *
       * chrome 判定（读自 harness 标记）：沿祖先上溯到行根，文本节点若
       * 位于 BUTTON/SVG 内（复制/分支按钮、图标——标签永不入摘录），或
       * 其 SPAN 祖先拥有 BUTTON 兄弟（时钟 span 就在操作行里、紧挨
       * Tooltip 按钮；正文 span 永无按钮兄弟——代码块的复制按钮是
       * <code> 的兄弟而非文本 span 的，气泡又是纯 div），即为 chrome。
       * 此判定抗 CSS-module 类名哈希，对用户行（MessageItem）与 AI 回合
       * 尾（TurnTailNodeView）同样成立。
       */
      function hasButtonSibling(span) {
        var parent = span.parentNode
        for (var s = parent.firstChild; s !== null; s = s.nextSibling) {
          if (s !== span && s.nodeType === 1
            && (s.tagName === 'BUTTON' || (s.querySelector('button') !== null && s.querySelector('button') !== undefined))) {
            return true
          }
        }
        return false
      }
      function isChromeText(node, row) {
        for (var el = node.parentNode; el !== null && el !== row; el = el.parentNode) {
          var tag = el.tagName
          if (tag === 'BUTTON' || tag === 'SVG') return true
          if (tag === 'SPAN' && hasButtonSibling(el)) return true
        }
        return false
      }
      function excerptOf(row) {
        var parts = []
        function visit(el) {
          for (var node = el.firstChild; node !== null; node = node.nextSibling) {
            if (node.nodeType === 3) {
              if (node.textContent.trim() !== '' && !isChromeText(node, row)) parts.push(node.textContent)
            } else if (node.nodeType === 1) {
              visit(node)
            }
          }
        }
        visit(row)
        return parts.join(' ').replace(/\s+/g, ' ').trim()
      }

      function showTip(el, entry) {
        if (tipTimer !== 0) { clearTimeout(tipTimer); tipTimer = 0 }
        // 只显示内容——刻度颜色已表达角色；摘录跳过操作栏 chrome，
        // 时间/统计后缀不会漏进来。
        var text = excerptOf(entry.row)
        if (text.length > 120) text = text.slice(0, 120) + '…'
        tip.textContent = text === '' ? '…' : text
        tip.style.display = 'block'
        var rect = el.getBoundingClientRect()
        tip.style.top = Math.round(rect.top - 8) + 'px'
        tip.style.left = Math.round(rect.left - tip.offsetWidth - 10) + 'px'
      }

      function hideTipSoon() {
        if (tipTimer !== 0) clearTimeout(tipTimer)
        tipTimer = setTimeout(function () { tip.style.display = 'none'; tipTimer = 0 }, HOVER_HIDE_MS)
      }

      function scheduleRefresh() {
        if (refreshTimer !== 0) return
        refreshTimer = setTimeout(refresh, 250)
      }

      /** 从当前滚动容器解绑（幂等）。 */
      function detach() {
        if (scrollport !== null) scrollport.removeEventListener('scroll', scheduleSyncView)
        if (contentObserver !== null) { contentObserver.disconnect(); contentObserver = null }
        if (resizeObserver !== null) { resizeObserver.disconnect(); resizeObserver = null }
        if (rail !== null && rail.parentNode !== null) rail.parentNode.removeChild(rail)
        if (tip !== null && tip.parentNode !== null) tip.parentNode.removeChild(tip)
        rail = null
        tip = null
        ticks = []
        scrollport = null
      }

      /** 扫描会话列，变化时（重新）绑定。 */
      /**
       * 菜单层级：我们的 ⋯ 下拉（dhb-smMenu）绝对定位在会话列的层叠
       * 上下文之内——压不过 body 级固定元素，菜单打开时轨道会盖住菜单
       * 项。（harness 自有的门户菜单纯 z-index 1100，本就在轨道的 500
       * 之上——只有我们的菜单需要处理。）body 观察器对菜单装卸都会
       * 触发，scan() 每趟复查，存在任意 dhb-smMenu 即隐藏轨道。
       */
      function syncMenuLayer() {
        if (rail === null) return
        var menuOpen = document.querySelector('.dhb-smMenu') !== null
        rail.setAttribute('data-menu-open', menuOpen ? '1' : '0')
        if (menuOpen) tip.style.display = 'none'
      }

      function scan() {
        syncMenuLayer()
        var found = document.querySelector('[data-conversation-scroll]')
        if (found === scrollport) return
        detach()
        if (found === null) return
        scrollport = found
        rail = document.createElement('div')
        rail.className = 'dhb-rail'
        tip = document.createElement('div')
        tip.className = 'dhb-railTip'
        tip.style.display = 'none'
        document.body.appendChild(rail)
        document.body.appendChild(tip)
        place()
        // 内容变化（流式输出、新消息、压缩换页）。
        contentObserver = new MutationObserver(scheduleRefresh)
        contentObserver.observe(scrollport, { childList: true, subtree: true })
        // 框架被挤压（工具坞）、列宽变化。
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(function () { place(); scheduleRefresh() })
          resizeObserver.observe(scrollport)
        }
        scrollport.addEventListener('scroll', scheduleSyncView, { passive: true })
        refresh()
        syncMenuLayer()
      }

      var scanScheduled = false
      function scheduleScan() {
        if (scanScheduled) return
        scanScheduled = true
        requestAnimationFrame(function () { scanScheduled = false; scan() })
      }

      bodyObserver = new MutationObserver(scheduleScan)
      bodyObserver.observe(document.body, { childList: true, subtree: true })
      window.addEventListener('resize', scheduleScan)
      scan()

      return function () {
        bodyObserver.disconnect()
        detach()
        window.removeEventListener('resize', scheduleScan)
        if (refreshTimer !== 0) clearTimeout(refreshTimer)
        if (scrollRaf !== 0) cancelAnimationFrame(scrollRaf)
        if (tipTimer !== 0) clearTimeout(tipTimer)
      }
    }
