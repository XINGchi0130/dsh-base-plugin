// ══ ops ══ 「运维」设置节 OpsSection：登录 URL/二维码、上游版本、健康自检。
    // ── 运维设置节 ──────────────────────────────────────────────────

    /**
     * 客户端侧自检探针：DOM 契约（navicons/rail 依赖的产品选择器）与
     * 通知权限。返回 [{ id, ok: boolean|null, detail }]；null = 无法判定
     * （如设置对话框未打开时的导航探针——对话框关闭时不该算失败）。
     */
    function opsClientProbes() {
      var probes = []
      // rail.js 的滚动容器契约
      try {
        probes.push({
          id: 'domConversationScroll',
          ok: document.querySelector('[data-conversation-scroll]') !== null ? true : null,
          detail: '[data-conversation-scroll]',
        })
      } catch (error) {
        probes.push({ id: 'domConversationScroll', ok: null, detail: String(error) })
      }
      // navicons.js 的设置导航契约（对话框未开时跳过）
      try {
        var dialog = document.querySelector('div[role="dialog"]')
        probes.push({
          id: 'domSettingsNav',
          ok: dialog === null ? null : dialog.querySelector('nav') !== null,
          detail: 'div[role="dialog"] nav',
        })
      } catch (error) {
        probes.push({ id: 'domSettingsNav', ok: null, detail: String(error) })
      }
      // 浏览器通知权限（通知泵的前提）
      try {
        var perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
        probes.push({ id: 'notifyPermission', ok: perm === 'granted' ? true : perm === 'unsupported' ? null : false, detail: perm })
      } catch (error) {
        probes.push({ id: 'notifyPermission', ok: null, detail: String(error) })
      }
      return probes
    }

    function OpsSection(props) {
      var t = props.t
      useLocaleVersion()

      var upstreamState = React.useState({ status: 'idle', value: null, error: '' })
      var upstream = upstreamState[0]
      var setUpstream = upstreamState[1]

      var healthState = React.useState(null) // null 未跑；{ status, value, probes }
      var health = healthState[0]
      var setHealth = healthState[1]

      var refreshUpstream = React.useCallback(function () {
        setUpstream(function (prev) { return { status: 'loading', value: prev.value, error: '' } })
        api('/ops/upstream').then(function (value) {
          setUpstream({ status: 'ready', value: value, error: '' })
        }).catch(function (error) {
          setUpstream(function (prev) { return { status: 'error', value: prev.value, error: String(error.message || error) } })
        })
      }, [])

      function runHealth() {
        setHealth({ status: 'loading', value: null, probes: [] })
        api('/ops/health').then(function (value) {
          setHealth({ status: 'ready', value: value, probes: opsClientProbes() })
        }).catch(function (error) {
          setHealth({ status: 'error', value: null, probes: opsClientProbes(t), error: String(error.message || error) })
        })
      }

      var upstreamValue = upstream.value
      var healthValue = health !== null ? health.value : null

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionOps')),
        h('p', { className: 'dhb-desc' }, t('opsIntro')),

        // ── 上游版本 ────────────────────────────────────────────────────
        h('div', { className: 'dhb-card' },
          h('div', { className: 'dhb-cardTitle' }, t('opsUpstreamTitle')),
          upstream.status === 'idle' ? h('p', { className: 'dhb-hint' }, t('opsUpstreamIdle'))
          : h('div', { className: 'dhb-cardMeta' },
            upstreamValue !== null && upstreamValue.local !== undefined
              ? h('span', null, t('opsLocalVer') + ': ' + (upstreamValue.local.version !== '' ? upstreamValue.local.version : '?')
                + (upstreamValue.local.commit !== '' ? ' (' + upstreamValue.local.commit + ')' : ''))
              : null,
            upstreamValue !== null && upstreamValue.remote !== undefined && upstreamValue.remote.latestTag !== ''
              ? h('span', null, t('opsRemoteVer') + ': ' + upstreamValue.remote.latestTag)
              : null,
          ),
          upstream.status === 'ready' && upstreamValue !== null && upstreamValue.remote !== undefined
            ? h('p', { className: 'dhb-hint', style: { margin: 0 } },
                typeof upstreamValue.remote.behindBy === 'number'
                ? (upstreamValue.remote.behindBy === 0 ? t('opsUpToDate')
                  : t('opsBehind', { n: String(upstreamValue.remote.behindBy) }))
                : t('opsBehindUnknown'))
            : null,
          upstream.status === 'error' && upstream.error !== '' ? h('p', { className: 'dhb-hint', style: { margin: 0, color: '#c0392b' } }, upstream.error) : null,
          h('div', { className: 'dhb-cardActions' },
            h('button', {
              className: 'dhb-btn', type: 'button',
              disabled: upstream.status === 'loading',
              onClick: refreshUpstream,
            }, upstream.status === 'loading' ? t('loading') : t('opsCheckUpdates')),
            h('a', {
              className: 'dhb-btn',
              href: 'https://github.com/' + (upstreamValue !== null && typeof upstreamValue.repo === 'string' ? upstreamValue.repo : 'deepseek-ai/deepseek-harness') + '/releases',
              target: '_blank',
              rel: 'noreferrer',
            }, t('opsReleasesLink')),
          ),
        ),

        // ── 健康自检 ────────────────────────────────────────────────────
        h('div', { className: 'dhb-card' },
          h('div', { className: 'dhb-cardTitle' }, t('opsHealthTitle')),
          h('p', { className: 'dhb-cardDesc' }, t('opsHealthHint')),
          h('div', { className: 'dhb-cardActions' },
            h('button', {
              className: 'dhb-btn dhb-btnPrimary', type: 'button',
              disabled: health !== null && health.status === 'loading',
              onClick: runHealth,
            }, health !== null && health.status === 'loading' ? t('loading') : t('opsRunHealth')),
          ),
          health !== null && health.status === 'ready' && healthValue !== null ? h('div', { className: 'dhb-list' },
            // 服务挂载
            Object.keys(healthValue.services).map(function (key) {
              return h('div', { className: 'dhb-row', key: key, style: { gap: 6 } },
                h('span', { className: 'dhb-badge', 'data-kind': healthValue.services[key] === true ? 'ok' : 'failed' },
                  (healthValue.services[key] === true ? '✓ ' : '✗ ') + key))
            }),
            // 路由探活
            healthValue.routeProbe !== null && typeof healthValue.routeProbe === 'object'
              ? h('div', { className: 'dhb-row', key: 'routeProbe', style: { gap: 6 } },
                h('span', { className: 'dhb-badge', 'data-kind': healthValue.routeProbe.ok === true ? 'ok' : 'failed' },
                  (healthValue.routeProbe.ok === true ? '✓ ' : '✗ ') + t('opsHealthRoute')
                  + ' · ' + String(healthValue.routeProbe.status) + ' · ' + String(healthValue.routeProbe.ms) + 'ms'))
              : null,
            // 状态文件权限
            healthValue.stateFileModeOk !== null
              ? h('div', { className: 'dhb-row', key: 'statePerm', style: { gap: 6 } },
                h('span', { className: 'dhb-badge', 'data-kind': healthValue.stateFileModeOk === true ? 'ok' : 'failed' },
                  (healthValue.stateFileModeOk === true ? '✓ ' : '✗ ') + t('opsHealthStatePerm')))
              : null,
            // 客户端探针（DOM 契约 / 通知权限）
            health.probes.map(function (probe) {
              return h('div', { className: 'dhb-row', key: probe.id, style: { gap: 6 } },
                h('span', {
                  className: 'dhb-badge',
                  'data-kind': probe.ok === true ? 'ok' : probe.ok === false ? 'failed' : 'pending',
                }, (probe.ok === true ? '✓ ' : probe.ok === false ? '✗ ' : '· ') + t('opsProbe_' + probe.id)),
                h('span', { className: 'dhb-hint' }, probe.detail))
            }),
          ) : null,
          health !== null && health.status === 'error'
            ? h('p', { className: 'dhb-hint', style: { color: '#c0392b' } }, health.error) : null,
        ),
      )
    }
