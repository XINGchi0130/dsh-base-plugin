// ══ shared ══ 共享小件：post()、Banner、应用内确认对话框（直接 DOM 实现，防设置模态层叠问题）、useLocaleVersion 语言切换重渲染钩子。
    // ── 共享小件 ──────────────────────────────────────────────────────────

    function Banner(props) {
      return h('div', { className: 'dhb-banner', 'data-kind': props.kind }, props.text)
    }

    function phaseLabel(t, phase) {
      var map = {
        active: 'phaseActive',
        loading: 'phaseLoading',
        failed: 'phaseFailed',
        disabled: 'phaseDisabled',
        pending: 'phasePending',
        disposed: 'phaseDisposed',
        unloading: 'phaseUnloading',
        absent: 'phaseAbsent',
      }
      var key = map[phase]
      return key !== undefined ? t(key) : String(phase)
    }

    function post(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body === undefined ? {} : body),
      })
    }

    // ── 应用内确认对话框（不用原生 window.confirm）─────────────────────

    /**
     * 确认对话框用直接 DOM（非 React）：卡片必须挂在 document.body 层
     * 才能压过设置模态（body 层 z-index 1000），而 shell.overlay 槽位在
     * 外壳框架的层叠上下文里、什么都赢不了它。把 React 节点搬去 body
     * 会破坏 React 的卸载簿记（死处理器、幽灵节点），因此这里用一个极
     * 小的命令式覆盖层：showConfirm() 惰性构建，按钮结算挂起的 Promise
     * 并隐藏 DOM。同时只开一个对话框；Esc 与点背景取消。
     */
    var confirmDom = null
    var pendingConfirmResolve = null

    function confirmLabel2(key) {
      return (currentT !== null ? currentT : fallbackT)(key)
    }

    function ensureConfirmDom() {
      if (confirmDom !== null) return confirmDom
      var root = document.createElement('div')
      root.className = 'dhb-cfmOverlay'
      root.style.zIndex = '2000'
      root.addEventListener('click', function (e) {
        if (e.target === root) settleConfirm(false)
      })
      var card = document.createElement('div')
      card.className = 'dhb-cfmCard'
      card.setAttribute('role', 'alertdialog')
      var text = document.createElement('p')
      text.className = 'dhb-cfmText'
      var row = document.createElement('div')
      row.className = 'dhb-cfmRow'
      var cancel = document.createElement('button')
      cancel.className = 'dhb-btn'
      cancel.type = 'button'
      var ok = document.createElement('button')
      ok.type = 'button'
      cancel.addEventListener('click', function () { settleConfirm(false) })
      ok.addEventListener('click', function () { settleConfirm(true) })
      row.appendChild(cancel)
      row.appendChild(ok)
      card.appendChild(text)
      card.appendChild(row)
      root.appendChild(card)
      root.style.display = 'none'
      document.body.appendChild(root)
      confirmDom = { root: root, text: text, cancel: cancel, ok: ok, keyHandler: null }
      return confirmDom
    }

    function showConfirm(text, options) {
      var opts = options === null || typeof options !== 'object' ? {} : options
      return new Promise(function (resolve) {
        settleConfirm(false) // supersede any pending dialog
        if (typeof document === 'undefined') { resolve(false); return }
        var ui = ensureConfirmDom()
        pendingConfirmResolve = function (result) {
          ui.root.style.display = 'none'
          if (ui.keyHandler !== null) {
            document.removeEventListener('keydown', ui.keyHandler)
            ui.keyHandler = null
          }
          pendingConfirmResolve = null
          resolve(result)
        }
        ui.text.textContent = String(text)
        ui.cancel.textContent = confirmLabel2('cancel')
        ui.ok.textContent = typeof opts.okLabel === 'string' && opts.okLabel !== '' ? opts.okLabel : 'OK'
        ui.ok.className = 'dhb-btn ' + (opts.danger === true ? 'dhb-btnDanger' : 'dhb-btnPrimary')
        ui.keyHandler = function (e) { if (e.key === 'Escape') settleConfirm(false) }
        document.addEventListener('keydown', ui.keyHandler)
        ui.root.style.display = 'flex'
      })
    }

    function settleConfirm(result) {
      if (pendingConfirmResolve !== null) pendingConfirmResolve(result)
    }

    /** 插件停止时拆除 body 级对话框 DOM 与 document 监听（apply 清理调用）。
     * 打开中的对话框一并按取消结算——不悬挂任何 Promise。 */
    function disposeConfirm() {
      settleConfirm(false)
      if (confirmDom !== null) {
        if (confirmDom.keyHandler !== null) {
          document.removeEventListener('keydown', confirmDom.keyHandler)
          confirmDom.keyHandler = null
        }
        if (confirmDom.root.parentNode !== null) confirmDom.root.parentNode.removeChild(confirmDom.root)
        confirmDom = null
      }
    }

    /** 注册进 shell.overlay 以维持槽位注册契约；真正的卡片是 body 层
     * 的直接 DOM。 */
    function ConfirmDialog() {
      return null
    }

    /** apply 时捕获的绑定 locale 的翻译函数（回退：浏览器语言）。 */
    var currentT = null


    /** 让组件订阅语言变化（共享 store，引用稳定）。 */
    function useLocaleVersion() {
      if (localeStore.instance === null) {
        localeStore.instance = createStore(localeStore.initial)
      }
      return useStore(localeStore.instance)
    }
