// ══ notify ══ 通知设置节 NotifySection：渠道（浏览器默认/Bark/ntfy/webhook）、事件开关、测试与静音。
    // ── 通知设置节（通知桥控制）─────────────────────────────────────────

    /** 渠道定义：值 + 标签键 + 所需字段。 */
    var NOTIFY_CHANNELS = [
      { value: 'browser', labelKey: 'ntfChannelBrowser', fields: [] },
      { value: 'bark', labelKey: 'ntfChannelBark', fields: ['url', 'barkKey'] },
      { value: 'ntfy', labelKey: 'ntfChannelNtfy', fields: ['url', 'ntfyTopic'] }, // fields=状态字段名（needs 判据），非 i18n 键
      { value: 'webhook', labelKey: 'ntfChannelWebhook', fields: ['url'] },
    ]

    /**
     * 通知设置节：启用开关 + 渠道三选一 + 按渠道显隐的字段（Bark 设备
     * key/自建 URL、ntfy topic/服务器、webhook URL）+ 三类事件开关
     * （回合结束/任务完结/审批等待）+ 测试发送与静音。全部经宿主
     * /notify* 路由；保存即生效（监听器逐事件现读配置）。
     */
    function NotifySection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle' })
      var data = dataState[0]
      var setData = dataState[1]

      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var refresh = React.useCallback(function () {
        api('/notify').then(function (value) {
          setData({ status: 'ready', cfg: value })
        }).catch(function (error) {
          setData({ status: 'error' })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      function patch(patchObj) {
        setData(function (prev) {
          return prev.status === 'ready' ? { status: 'ready', cfg: Object.assign({}, prev.cfg, patchObj) } : prev
        })
      }

      function onSave() {
        if (busy || data.status !== 'ready') return
        setBusy(true)
        setMsg(null)
        post('/notify', data.cfg)
          .then(function (value) {
            setData({ status: 'ready', cfg: value })
            setMsg({ kind: 'ok', text: t('ntfSaved') })
          })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      function onTest() {
        if (busy) return
        setBusy(true)
        setMsg(null)
        post('/notify/test', {})
          .then(function (result) {
            // 按宿主实际使用的渠道分支（表单与已保存配置可能不同——
            // 曾出现 bark 已存 + 表单 browser 的双投递）。
            if (result.channel === 'browser') {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try { new Notification(t('ntfTestTitle'), { body: t('ntfTestBrowserBody') }) } catch (err) { /* 极端环境 */ }
                setMsg({ kind: 'ok', text: t('ntfTestOkBrowser') })
              } else {
                setMsg({ kind: 'err', text: t('ntfPermNeeded') })
              }
            } else {
              setMsg({ kind: 'ok', text: t('ntfTestOk') })
            }
          })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      function onQuiet(minutes) {
        if (busy) return
        setBusy(true)
        setMsg(null)
        post('/notify/quiet', { minutes: minutes })
          .then(function (value) {
            patch({ quietUntil: value.quietUntil })
            setMsg({ kind: 'ok', text: minutes > 0 ? t('ntfQuietOn', { n: minutes }) : t('ntfQuietOff') })
          })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      if (data.status !== 'ready') {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionNotify')),
          data.status === 'error' ? h(Banner, { kind: 'err', text: msg !== null ? msg.text : t('errorTitle') })
          : h('p', { className: 'dhb-desc' }, t('loading')),
        )
      }

      var cfg = data.cfg
      var channelDef = null
      for (var i = 0; i < NOTIFY_CHANNELS.length; i += 1) {
        if (NOTIFY_CHANNELS[i].value === cfg.channel) { channelDef = NOTIFY_CHANNELS[i]; break }
      }
      var needs = function (f) { return channelDef !== null && channelDef.fields.indexOf(f) !== -1 }
      var quietActive = typeof cfg.quietUntil === 'number' && cfg.quietUntil > Date.now()

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionNotify')),
        h('p', { className: 'dhb-desc' }, t('ntfIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        quietActive ? h(Banner, { kind: 'warn', text: t('ntfQuietActive') }) : null,
        h('div', { className: 'dhb-form' },
          h('label', { className: 'dhb-row', style: { gap: 6 } },
            h('input', { type: 'checkbox', checked: cfg.enabled === true, onChange: function (e) { patch({ enabled: e.target.checked }) } }),
            h('span', null, t('ntfEnable'))),
          // 渠道选择
          h('div', { className: 'dhb-field' },
            h('span', { className: 'dhb-label' }, t('ntfChannelLabel')),
            h('div', { className: 'dhb-row' },
              NOTIFY_CHANNELS.map(function (ch) {
                return h('button', {
                  key: ch.value, type: 'button',
                  className: 'dhb-btn' + (cfg.channel === ch.value ? ' dhb-btnPrimary' : ''),
                  onClick: function () { patch({ channel: ch.value }) },
                }, t(ch.labelKey))
              }),
            ),
          ),
          // browser 渠道：浏览器通知授权（代替外部服务配置——零门槛）
          cfg.channel === 'browser'
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfPermLabel')),
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  onClick: function () {
                    if (typeof Notification === 'undefined') { setMsg({ kind: 'err', text: t('ntfPermUnsupported') }); return }
                    Notification.requestPermission().then(function (p) {
                      setMsg({ kind: p === 'granted' ? 'ok' : 'err', text: p === 'granted' ? t('ntfPermGranted') : t('ntfPermDenied') })
                    })
                  },
                }, typeof Notification !== 'undefined' && Notification.permission === 'granted' ? t('ntfPermGrantedBtn') : (typeof Notification !== 'undefined' && Notification.permission === 'denied' ? t('ntfPermDeniedState') : t('ntfPermBtn'))),
                h('span', { className: 'dhb-hint' }, t('ntfPermHint')),
              )
            : null,
          // 按渠道显隐的字段
          needs('url')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfUrlLabel')),
                h('input', { className: 'dhb-input', value: cfg.url ?? '', placeholder: t('ntfUrlPlaceholder'), spellCheck: false, onChange: function (e) { patch({ url: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfUrlHint')),
              )
            : null,
          needs('barkKey')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfBarkKeyLabel')),
                h('input', { className: 'dhb-input', value: cfg.barkKey ?? '', placeholder: 'xxxxxxxx', spellCheck: false, onChange: function (e) { patch({ barkKey: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfBarkKeyHint')),
              )
            : null,
          needs('ntfyTopic')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfTopicLabel')),
                h('input', { className: 'dhb-input', value: cfg.ntfyTopic ?? '', placeholder: 'my-dsh', spellCheck: false, onChange: function (e) { patch({ ntfyTopic: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfTopicHint')),
              )
            : null,
          // 事件开关
          h('div', { className: 'dhb-field' },
            h('span', { className: 'dhb-label' }, t('ntfEventsLabel')),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.turnEnd === true, onChange: function (e) { patch({ turnEnd: e.target.checked }) } }),
              h('span', null, t('ntfEventTurnEnd'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.jobs === true, onChange: function (e) { patch({ jobs: e.target.checked }) } }),
              h('span', null, t('ntfEventJobs'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.approvals === true, onChange: function (e) { patch({ approvals: e.target.checked }) } }),
              h('span', null, t('ntfEventApprovals'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.context === true, onChange: function (e) { patch({ context: e.target.checked }) } }),
              h('span', null, t('ntfEventContext'))),
          ),
          h('div', { className: 'dhb-row' },
            h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', disabled: busy, onClick: onSave }, busy ? t('saving') : t('save')),
            h('button', {
              className: 'dhb-btn', type: 'button', disabled: busy,
              title: t('ntfTestHint'),
              onClick: onTest,
            }, t('ntfTestBtn')),
            quietActive
              ? h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: function () { onQuiet(0) } }, t('ntfQuietCancel'))
              : h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: function () { onQuiet(60) } }, t('ntfQuietBtn')),
          ),
        ),
        h('p', { className: 'dhb-hint' }, t('ntfSecurityNote')),
      )
    }
