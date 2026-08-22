// ══ promptopt ══ 提示词优化 PromptOptView：输入粗糙想法 → 默认模型重写为高质量提示词。
    // ── 提示词优化 tab ────────────────────────────────────────────────────

    /** 提示词优化 tab：textarea 输入 + 优化按钮 + 结果展示 + 复制。
     * 数据面走宿主 /prompt-opt（官方 llm 服务 + 用户默认模型；一次性
     * 调用，无会话/工具/落盘）。优化中禁用输入与按钮；结果含 ```text
     * 代码块时提取纯提示词部分供一键复制。 */
    function PromptOptView(props) {
      var t = props.t
      useLocaleVersion()

      var inputState = React.useState('')
      var input = inputState[0]
      var setInput = inputState[1]

      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      var resultState = React.useState(null) // { optimized, provider, model } | null
      var result = resultState[0]
      var setResult = resultState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      function onOptimize() {
        if (busy || input.trim() === '') return
        setBusy(true)
        setMsg(null)
        setResult(null) // 旧结果滞留曾让 busy/失败期间一键复制拿到上一次的提示词
        post('/prompt-opt', { input: input })
          .then(function (value) { setResult(value) })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      // 从 ```text 代码块提取纯提示词（无代码块则原样）。闭合围栏锚定
      // 行首并容忍 CRLF：惰性匹配停在正文内部第一个 ``` 上，曾把含
      // 围栏的提示词静默截断到半句。
      var purePrompt = null
      if (result !== null) {
        var m = /^```text\r?\n([\s\S]*?)\r?\n^```/m.exec(result.optimized)
        purePrompt = m !== null ? m[1].replace(/\r\n/g, '\n').trim() : result.optimized
      }

      function onCopy() {
        if (purePrompt === null) return
        copyText(purePrompt)
          .then(function () { setMsg({ kind: 'ok', text: t('poCopied') }) })
          .catch(function () { setMsg({ kind: 'err', text: t('poCopyFailed') }) })
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary,#3f4550)' } },
        h('div', { className: 'dhb-row', style: { justifyContent: 'space-between' } },
          h('span', { className: 'dhb-hint' }, t('poIntro')),
          result !== null
            ? h('span', { className: 'dhb-hint' }, result.provider + ' / ' + result.model)
            : null,
        ),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        h('textarea', {
          className: 'dhb-textarea',
          value: input,
          style: { minHeight: 110, flex: 'none' },
          spellCheck: false,
          placeholder: t('poPlaceholder'),
          disabled: busy,
          onChange: function (e) { setInput(e.target.value) },
          onKeyDown: function (e) {
            if (isComposing(e)) return
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onOptimize()
          },
        }),
        h('div', { className: 'dhb-row' },
          h('button', {
            className: 'dhb-btn dhb-btnPrimary', type: 'button',
            disabled: busy || input.trim() === '',
            title: t('poShortcut'),
            onClick: onOptimize,
          }, busy ? t('poRunning') : t('poButton')),
          busy ? h('span', { className: 'dhb-hint' }, t('poWaitHint')) : null,
        ),
        result !== null
          ? h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('poResultTitle'),
                h('button', { className: 'dhb-btn', type: 'button', style: { marginLeft: 'auto' }, onClick: onCopy }, t('poCopy'))),
              h('pre', { className: 'dhb-pre', style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, purePrompt),
            )
          : null,
      )
    }
