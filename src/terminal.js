// ══ terminal ══ 终端面板 TerminalPane/TerminalView：多 PTY、回车提交、Ctrl+C 中断、流式输出轮询。
    // ── 终端面板（PTY，多实例）─────────────────────────────────────────────

    /**
     * 单个终端窗格：输出流 + 单行输入。宿主把 PTY 的发送-操作模型映射
     * 到此 UI：按回车提交该行并结算操作；输出按增量轮询，输入期间保持
     * 一个操作打开。Ctrl+C 中断前台操作。
     */
    function TerminalPane(props) {
      var t = props.t
      var term = props.term // { key, terminalId, name, output }
      var onInput = props.onInput
      var onInterrupt = props.onInterrupt

      var inputState = React.useState('')
      var input = inputState[0]
      var setInput = inputState[1]

      var outRef = React.useRef(null)
      React.useEffect(function () {
        var el = outRef.current
        if (el !== null) el.scrollTop = el.scrollHeight
      }, [term.output])

      function submit() {
        if (input === '') return
        var sent = onInput(term.key, input, true)
        // 只有 PTY 接受了该行才清空输入；被拒（如「命令仍在运行」）时
        // 保留已输入文本以便继续编辑。
        if (sent !== undefined && typeof sent.then === 'function') {
          sent.then(function () { setInput('') }, function () { /* keep input */ })
        } else {
          setInput('')
        }
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 } },
        h('pre', { className: 'dhb-tmOut', ref: outRef }, term.output === '' ? t('termPlaceholder') : term.output),
        h('div', { className: 'dhb-tmInRow' },
          h('span', { className: 'dhb-tmPrompt' }, '$'),
          h('input', {
            className: 'dhb-tmIn',
            value: input,
            placeholder: t('termPlaceholder'),
            spellCheck: false,
            autoComplete: 'off',
            onChange: function (e) { setInput(e.target.value) },
            onKeyDown: function (e) {
              if (isComposing(e)) return // IME Enter = confirm candidate, not submit
              if (e.key === 'Enter') submit()
              else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                onInterrupt(term.key)
              }
            },
          }),
          h('button', {
            className: 'dhb-tmCtrl', type: 'button',
            title: 'Ctrl+C',
            onClick: function () { onInterrupt(term.key) },
          }, '^C'),
        ),
      )
    }

    /**
     * 终端面板：会话工作区内的多个 PTY，从头部 ⋯ 菜单的右侧停靠面板
     * 打开。终端存活在宿主侧（按会话代理做属主隔离），因此本面板只恢复
     * 列表、逐终端的输出状态留在本地。
     */
    function TerminalView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      var sessionId = kit !== undefined ? kit.sessionId : undefined
      var cwd = kit !== undefined && typeof kit.useSessions === 'function'
        ? kit.useSessions(function (s) {
            var row = sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
            return row !== undefined && typeof row.cwd === 'string' ? row.cwd : ''
          })
        : ''

      // terms: [{ key, terminalId, name, output }]
      var termsState = React.useState([])
      var terms = termsState[0]
      var setTerms = termsState[1]

      var activeState = React.useState(null)
      var activeKey = activeState[0]
      var setActiveKey = activeState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      // closing: { [terminalKey]: true } — kills in flight. The host round
      // trip (agent resolve + PTY kill RPC) can take a beat; the tab shows a
      // spinner and goes inert meanwhile, so the click visibly landed.
      var closingState = React.useState({})
      var closing = closingState[0]
      var setClosing = closingState[1]

      var seq = React.useRef(0)
      var latestOp = React.useRef({}) // terminalKey → newest opKey

      function patchTerm(key, patch) {
        setTerms(function (prev) {
          return prev.map(function (tm) { return tm.key === key ? Object.assign({}, tm, patch) : tm })
        })
      }

      function appendOutput(key, delta) {
        if (typeof delta !== 'string' || delta === '') return
        setTerms(function (prev) {
          return prev.map(function (tm) {
            if (tm.key !== key) return tm
            var merged = tm.output + delta
            // host scrollback is bounded; mirror a generous local bound
            if (merged.length > 200000) merged = merged.slice(-100000)
            return Object.assign({}, tm, { output: merged })
          })
        })
      }

      /** 轮询一个操作直到结算；登记以便卸载时清理。 */
      var pollStoppers = []
      function pollLoop(key, opKey) {
        var stop = false
        var misses = 0
        var tick = function () {
          if (stop) return
          post('/terminal/read', { sessionId: sessionId, terminalId: key, opKey: opKey })
            .then(function (value) {
              misses = 0
              appendOutput(key, value.delta)
              if (value.done === true) return // op settled; loop ends
              setTimeout(tick, 700)
            })
            .catch(function () {
              // 退避；连续失败（宿主消失/插件被移除）后结束循环，
              // 不再永久轮询。
              misses += 1
              if (misses >= 20) return
              setTimeout(tick, 1500)
            })
        }
        tick()
        var stopper = function () { stop = true }
        pollStoppers.push(stopper)
        return stopper
      }

      // 标签卸载时停掉所有在途轮询（切换视图不得留下孤儿轮询器给
      // 已卸载组件发 POST）。
      React.useEffect(function () {
        return function () {
          for (var i = 0; i < pollStoppers.length; i += 1) pollStoppers[i]()
          pollStoppers.length = 0
        }
      }, [])

      /** 恢复本会话在宿主侧的终端列表（标签重新挂载时）。 */
      React.useEffect(function () {
        if (sessionId === undefined) return
        post('/terminal/list', { sessionId: sessionId })
          .then(function (value) {
            setTerms((value.terminals ?? []).map(function (snap) {
              return { key: snap.sessionId, terminalId: snap.sessionId, name: snap.name !== '' ? snap.name : snap.sessionId, output: '' }
            }))
          })
          .catch(function () { /* host terminals missing — start empty */ })
      }, [sessionId])

      function onNew() {
        if (sessionId === undefined || sessionId === '') return
        // 加时钟后缀：标签重挂载后本地计数器归零，裸 "term-1" 会与仍
        // 存活的同名宿主 PTY 冲突（注册表拒绝重名）。
        var name = 'term-' + String(++seq.current) + '-' + Date.now().toString(36).slice(-4)
        setMsg(null)
        post('/terminal/open', { sessionId: sessionId, name: name, cwd: cwd })
          .then(function (value) {
            var entry = { key: value.sessionId, terminalId: value.sessionId, name: name, output: value.motd ?? '' }
            setTerms(function (prev) { return prev.concat([entry]) })
            setActiveKey(entry.key)
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
      }

      function onCloseTerm(term) {
        if (closing[term.key] === true) return // already killing
        showConfirm(t('termCloseConfirm', { name: term.name }), { okLabel: t('termClose'), danger: true })
          .then(function (ok) {
            if (!ok) return
            setClosing(function (prev) { return markClosing(prev, term.key, true) })
            post('/terminal/kill', { sessionId: sessionId, terminalId: term.terminalId })
              .then(function () {
                setTerms(function (prev) { return prev.filter(function (tm) { return tm.key !== term.key }) })
                if (activeKey === term.key) setActiveKey(null)
              })
              .catch(function (error) {
                setClosing(function (prev) { return markClosing(prev, term.key, false) })
                setMsg({ kind: 'err', text: String(error.message || error) })
              })
          })
      }

      /** 纯拷贝：设置或清除某一个终端的关闭中标记。 */
      function markClosing(prev, key, value) {
        var next = Object.assign({}, prev)
        if (value) next[key] = true
        else delete next[key]
        return next
      }

      function onInput(key, text, submit) {
        // one op per terminal: send (opens op) then poll its output.
        // 返回 POST 的 Promise，调用方在成功时清空输入。
        var opKey = key + '::' + String(++seq.current)
        latestOp.current[key] = opKey
        return post('/terminal/send', { sessionId: sessionId, terminalId: key, opKey: opKey, text: text, submit: submit })
          .then(function () {
            pollLoop(key, opKey)
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
            throw error
          })
      }

      function onInterrupt(key) {
        var opKey = latestOp.current[key]
        if (opKey === undefined) return
        post('/terminal/interrupt', { sessionId: sessionId, opKey: opKey }).catch(function () { /* no live op */ })
      }

      var active = null
      for (var i = 0; i < terms.length; i += 1) {
        if (terms[i].key === activeKey) { active = terms[i]; break }
      }
      if (active === null && terms.length > 0) active = terms[0]

      return h('div', { className: 'dhb-tmPage' },
        h('div', { className: 'dhb-tmBar' },
          terms.map(function (term) {
            var isClosing = closing[term.key] === true
            return h('button', {
              key: term.key,
              className: 'dhb-tmTab',
              type: 'button',
              'data-active': active !== null && active.key === term.key ? '1' : undefined,
              'data-closing': isClosing ? '1' : undefined,
              onClick: function () { setActiveKey(term.key) },
            },
              h('span', null, term.name),
              isClosing
                ? h('span', { className: 'dhb-tmSpin', role: 'status', title: t('termClosing', { name: term.name }) })
                : h('span', {
                    className: 'dhb-tmX', type: 'button', role: 'button',
                    title: t('termClose'),
                    onClick: function (e) { e.stopPropagation(); onCloseTerm(term) },
                  }, '×'),
            )
          }),
          h('button', { className: 'dhb-tmNew', type: 'button', onClick: onNew }, t('termNew')),
        ),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        active !== null
          ? h(TerminalPane, {
              t: t,
              term: active,
              onInput: onInput,
              onInterrupt: onInterrupt,
            })
          : h('div', { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' } },
              h('button', { className: 'dhb-tmNew', type: 'button', onClick: onNew }, t('termNew')),
            ),
      )
    }
