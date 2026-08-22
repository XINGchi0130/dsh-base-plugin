// ══ prompt ══ 系统提示词设置节 PromptSection：全局 persona 覆盖，保存热加载。
    // ── 系统提示词设置节 ───────────────────────────────────────────────────

    function PromptSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', persona: null, effective: null })
      var data = dataState[0]
      var setData = dataState[1]

      var editorState = React.useState({ text: '', dirty: false })
      var editor = editorState[0]
      var setEditor = editorState[1]

      var savingState = React.useState(false)
      var saving = savingState[0]
      var setSaving = savingState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      // 重读状态并重新填充编辑器（绝不覆盖未保存的编辑）。
      // 编辑器只以自定义 persona 填充——默认态就是空。
      var refresh = React.useCallback(function (forceEditor) {
        api('/state').then(function (value) {
          var persona = typeof value.persona === 'string' ? value.persona : ''
          var effective = typeof value.effectivePersona === 'string' ? value.effectivePersona : ''
          setData({ status: 'ready', persona: persona, effective: effective })
          if (forceEditor === true) {
            setEditor({ text: persona, dirty: false })
          }
        }).catch(function (error) {
          setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh(true) }, [refresh])

      var available = data.effective !== null // old host: field missing entirely

      function onSave() {
        if (saving) return
        setSaving(true)
        setMsg(null)
        post('/prompt', { persona: editor.text })
          .then(function (value) {
            setMsg({ kind: 'ok', text: value.active === true ? t('promptSaved') : t('promptReset') })
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
          .then(function () {
            setSaving(false)
            refresh(true)
          })
      }

      function onReset() {
        showConfirm(t('confirmResetPrompt'), { okLabel: t('promptResetBtn') })
          .then(function (ok) {
            if (!ok) return
            setEditor({ text: '', dirty: true })
            setMsg(null)
            if (!saving) {
              setSaving(true)
              post('/prompt', { persona: '' })
                .then(function () { setMsg({ kind: 'ok', text: t('promptReset') }) })
                .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
                .then(function () { setSaving(false); refresh(true) })
            }
          })
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionPrompt')),
        h('p', { className: 'dhb-desc' }, t('promptIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        available ? null : h(Banner, { kind: 'warn', text: t('promptNeedRestart') }),
        data.status === 'loading' || data.status === 'idle' ? h('p', { className: 'dhb-desc' }, t('loading')) : null,
        data.status === 'ready'
          ? h('div', { className: 'dhb-form' },
              h('div', { className: 'dhb-formTitle' }, data.persona !== ''
                ? t('promptActive')
                : t('promptDefault')),
              h('span', { className: 'dhb-hint' }, t('promptHint')),
              h('textarea', {
                className: 'dhb-textarea',
                value: editor.text,
                style: { minHeight: '160px' },
                spellCheck: false,
                placeholder: t('promptPlaceholder'),
                onChange: function (e) { setEditor({ text: e.target.value, dirty: true }) },
              }),
              h('div', { className: 'dhb-row' },
                h('button', {
                  className: 'dhb-btn dhb-btnPrimary', type: 'button',
                  disabled: saving || !available, onClick: onSave,
                }, saving ? t('saving') : t('save')),
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  disabled: saving || !available || data.persona === '', onClick: onReset,
                }, t('promptResetBtn')),
              ),
            )
          : null,
      )
    }
