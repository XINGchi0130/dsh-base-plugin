// ══ mobile ══ 手机访问设置节 MobileSection：配对二维码、设备管理、当前地址卡。
    // ── 手机访问设置节（配对代理控制）────────────────────────────────────

    /** ISO epoch → locale short form; 0 → placeholder. */
    function mobileTime(ms, t) {
      if (typeof ms !== 'number' || ms <= 0) return '—'
      try {
        var d = new Date(ms)
        var two = function (v) { return (v < 10 ? '0' : '') + v }
        return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
          + ' ' + two(d.getHours()) + ':' + two(d.getMinutes())
      } catch (err) { return '—' }
    }

    /**
     * 手机访问设置节：启用开关 + 端口、配对二维码（每次打开都铸新
     * 码）、已配对设备列表（可逐个吊销）与轮换密钥操作。全部经宿主半
     * 的 /mobile* 控制路由。
     */
    function MobileSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle' })
      var data = dataState[0]
      var setData = dataState[1]

      var portDraftState = React.useState('')
      var portDraft = portDraftState[0]
      var setPortDraft = portDraftState[1]

      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var refresh = React.useCallback(function () {
        api('/mobile').then(function (value) {
          if (value !== null && typeof value === 'object') {
            setData({ status: 'ready', enabled: value.enabled === true, running: value.running === true, port: value.port, addresses: value.addresses, pair: value.pair, urls: value.urls, qr: value.qr, devices: value.devices })
            if (typeof value.port === 'number') setPortDraft(String(value.port))
          }
        }).catch(function (error) {
          setData({ status: 'error' })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      function onToggle(enabled) {
        if (busy) return
        setBusy(true)
        setMsg(null)
        post('/mobile/toggle', { enabled: enabled, port: Number(portDraft) })
          .then(function () { setMsg({ kind: 'ok', text: enabled ? t('mobileEnabled') : t('mobileDisabled') }) })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false); refresh() })
      }

      function onRevoke(device) {
        if (busy) return
        setBusy(true)
        post('/mobile/revoke', { deviceId: device.id })
          .then(function () { setMsg({ kind: 'ok', text: device.name + ' ×' }) })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false); refresh() })
      }

      function onRotate() {
        if (busy) return
        showConfirm(t('mobileRotateConfirm'), { okLabel: t('mobileRotate'), danger: true })
          .then(function (ok) {
            if (!ok) return
            setBusy(true)
            setMsg(null)
            post('/mobile/rotate', {})
              .then(function () { setMsg({ kind: 'ok', text: t('mobileRotate') + ' ✓' }) })
              .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
              .then(function () { setBusy(false); refresh() })
          })
      }

      if (data.status !== 'ready') {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionMobile')),
          h('p', { className: 'dhb-desc' }, data.status === 'error' ? (msg !== null ? msg.text : t('errorTitle')) : t('loading')),
        )
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionMobile')),
        h('p', { className: 'dhb-desc' }, t('mobileIntro')),
        h('p', { className: 'dhb-hint' }, t('mobileSecurityNote')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        data.enabled && !data.running ? h(Banner, { kind: 'warn', text: t('mobileNotRunning') }) : null,
        h('div', { className: 'dhb-card' },
          h('div', { className: 'dhb-row' },
            h('button', {
              className: 'dhb-btn' + (data.enabled ? ' dhb-btnPrimary' : ''),
              type: 'button', disabled: busy,
              onClick: function () { onToggle(!data.enabled) },
            }, t('mobileEnable') + ': ' + (data.enabled ? 'ON' : 'OFF')),
            h('label', { className: 'dhb-hint', style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
              t('mobilePort'),
              h('input', {
                className: 'dhb-input', type: 'number', min: 1, max: 65535,
                style: { width: 90, flex: 'none' },
                value: portDraft, disabled: busy || data.enabled,
                onChange: function (e) { setPortDraft(e.target.value) },
              }),
            ),
            data.enabled && Number(portDraft) !== data.port
              ? h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: function () { onToggle(true) } }, t('mobileApply'))
              : null,
            h('span', { className: 'dhb-badge', 'data-phase': data.running ? 'active' : 'failed' }, data.running ? 'running' : 'stopped'),
          ),
        ),
        // 当前地址卡片：局域网 IP 是会无声漂移的东西（DHCP 重分配），
        // 一漂移手机里存的全部书签就失效——无论代理状态如何都醒目展示。
        data.addresses !== undefined && data.addresses.length > 0
          ? h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('mobileCurrentAddress')),
              h('div', { className: 'dhb-list' },
                data.addresses.map(function (addr, i) {
                  var url = 'http://' + addr + ':' + data.port
                  return h('div', { className: 'dhb-row', key: addr, style: { justifyContent: 'space-between' } },
                    h('code', { style: { fontSize: 13, wordBreak: 'break-all' } }, url),
                    h('button', {
                      className: 'dhb-btn', type: 'button',
                      onClick: function () {
                        if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
                          navigator.clipboard.writeText(url)
                          setMsg({ kind: 'ok', text: url + ' → ⧉' })
                        }
                      },
                    }, '⧉'),
                  )
                }),
              ),
              h('p', { className: 'dhb-hint' }, t('mobileAddressHint')),
            )
          : h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('mobileCurrentAddress')),
              h('p', { className: 'dhb-desc' }, t('mobileNoLan')),
            ),
        data.enabled && data.running && data.pair !== null
          ? h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('mobileQrTitle'),
                h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('mobileCodeLabel') + ': ' + data.pair.code)),
              typeof data.qr === 'string' && data.qr !== ''
                ? h('div', {
                    className: 'dhb-qrBox',
                    // XSS note: data.qr is OUR OWN server's SVG for a URL
                    // built from os.networkInterfaces() IPv4 literals (charset
                    // [0-9.:] — no markup can enter). If the pairing URL ever
                    // incorporates user-controlled text, sanitize here first.
                    dangerouslySetInnerHTML: { __html: data.qr },
                  })
                : h('p', { className: 'dhb-desc' }, t('mobileNoLan')),
              h('p', { className: 'dhb-hint' }, t('mobileQrHint', { code: data.pair.code })),
              data.urls !== undefined && data.urls.length > 1
                ? h('div', { className: 'dhb-cardMeta' }, t('mobileUrls') + ': ' + data.urls.join(' · '))
                : null,
            )
          : null,
        h('div', { className: 'dhb-card' },
          h('div', { className: 'dhb-cardTitle' }, t('mobileDevices')),
          data.devices.length === 0 ? h('p', { className: 'dhb-desc' }, t('mobileNoDevices'))
          : h('div', { className: 'dhb-list' },
              data.devices.map(function (d) {
                return h('div', { className: 'dhb-row', key: d.id, style: { justifyContent: 'space-between' } },
                  h('span', null, d.name),
                  h('span', { className: 'dhb-hint' },
                    t('mobilePairedAt') + ' ' + mobileTime(d.pairedAt, t) + ' · ' + t('mobileLastSeen') + ' ' + mobileTime(d.lastSeenAt, t)),
                  h('button', { className: 'dhb-btn dhb-btnDanger', type: 'button', disabled: busy, onClick: function () { onRevoke(d) } }, t('mobileRevoke')),
                )
              }),
            ),
          data.devices.length > 0
            ? h('div', { className: 'dhb-cardActions' },
                h('button', { className: 'dhb-btn dhb-btnDanger', type: 'button', disabled: busy, onClick: onRotate }, t('mobileRotate')),
              )
            : null,
        ),
      )
    }
