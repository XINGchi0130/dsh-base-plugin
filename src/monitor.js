// ══ monitor ══ 监控面板 MonitorView：概览（轮/步、耗时、token）+ 任务（后台作业、子代理树）两个标签页。
    // ── 监控面板（会话运行概况）──────────────────────────────────────────

    /** ms 时长 → "36m24s" / "37.3s" / "412ms"。 */
    function monDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
      if (ms < 1000) return Math.round(ms) + 'ms'
      var s = ms / 1000
      if (s < 60) return (Math.round(s * 10) / 10) + 's'
      var m = Math.floor(s / 60)
      var rest = Math.round(s - m * 60)
      if (m < 60) return m + 'm' + (rest < 10 ? '0' : '') + rest + 's'
      var h = Math.floor(m / 60)
      return h + 'h' + (m - h * 60) + 'm'
    }

    /** token 大数 → "107K" / "33.7M"。 */
    function monTokens(n) {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
      var scaled = function (v) { return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10) }
      if (n < 1000) return String(Math.round(n))
      if (n < 1000000) return scaled(n / 1000) + 'K'
      return scaled(n / 1000000) + 'M'
    }

    /** 指标卡：标题 + 值行（children）。 */
    function MonCard(props) {
      return h('div', { className: 'dhb-card' },
        h('div', { className: 'dhb-cardTitle' }, props.title),
        h('div', { className: 'dhb-cardMeta', style: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 } }, props.children),
      )
    }

    /** 概览 tab：轮次与步骤 / 耗时 / token 用量（整日志统计）。 */
    function MonOverviewTab(props) {
      var t = props.t
      var p = props.payload
      var s = p !== null && p.stats !== null ? p.stats : null
      var tok = p !== null ? p.tokens : null

      // 派生速率：首 token 平均 = ttftMs/ttftSteps；解码 = decodeTokens/(decodeMs/1000)。
      var ttftAvg = s !== null && s.ttftSteps > 0 ? s.ttftMs / s.ttftSteps : null
      var tokPerSec = s !== null && s.decodeMs > 0 ? s.decodeTokens / (s.decodeMs / 1000) : null
      // 缓存命中 = cacheRead / (cacheRead + input)（不含 cacheWrite 写入侧）。
      var cacheHit = null
      if (tok !== null && (tok.cacheRead + tok.input) > 0) {
        cacheHit = Math.round(tok.cacheRead / (tok.cacheRead + tok.input) * 100)
      }

      if (p !== null && p.available !== true && p.requests === 0) {
        return h('p', { className: 'dhb-desc' }, t('monUnavailable'))
      }

      return h('div', { className: 'dhb-list' },
        // 轮次与步骤
        h(MonCard, { title: t('monRounds') },
          h('span', { style: { fontSize: 15 } },
            (s !== null ? s.turns : '—') + ' ' + t('monTurns') + ' · ' + (s !== null ? s.steps : '—') + ' ' + t('monSteps')),
          h('span', { className: 'dhb-hint' }, t('monRequests', { n: p !== null ? p.requests : 0 })),
        ),
        // 耗时
        h(MonCard, { title: t('monTimes') },
          h('span', null, t('monLlmLabel') + ' ' + monDuration(s !== null ? s.llmMs : null)
            + ' · ' + t('monToolLabel') + ' ' + monDuration(s !== null ? s.toolMs : null)),
          h('span', { className: 'dhb-hint' }, t('monTtftLabel') + ' ' + (ttftAvg !== null ? monDuration(ttftAvg) : '—')
            + (tokPerSec !== null ? ' · ' + (Math.round(tokPerSec * 10) / 10) + ' tok/s' : '')),
        ),
        // token 用量
        h(MonCard, { title: t('monTokenTitle') },
          h('span', null, t('monInput') + ' ' + (tok !== null ? monTokens(tok.input) : '—')
            + ' · ' + t('monOutput') + ' ' + (tok !== null ? monTokens(tok.output) : '—')),
          h('span', { className: 'dhb-hint' },
            t('monCacheHit') + ' ' + (cacheHit !== null ? cacheHit + '%' : '—')
            + ' · ' + t('monCacheWrite') + ' ' + (tok !== null ? monTokens(tok.cacheWrite) : '—')),
          tok !== null && tok.reasoning > 0
            ? h('span', { className: 'dhb-hint' }, t('monReasoning') + ' ' + monTokens(tok.reasoning))
            : null,
        ),
      )
    }

    /** 任务 tab：后台作业 + 子代理树（正在干活的单元）。 */
    function MonTasksTab(props) {
      var t = props.t
      var p = props.payload
      var jobsCard = p !== null && Array.isArray(p.jobs)
        ? h(MonCard, { title: t('monJobsTitle') },
            h('span', { className: 'dhb-hint' },
              t('monJobsRunning', { n: p.jobs.filter(function (j) { return j.status === 'running' || j.status === 'stopping' }).length })
              + ' · ' + t('monJobsDone', { n: p.jobs.filter(function (j) { return j.status !== 'running' && j.status !== 'stopping' }).length })),
            p.jobs.length === 0
              ? h('span', { className: 'dhb-hint' }, t('monNoJobs'))
              : p.jobs.map(function (j) {
                  var running = j.status === 'running' || j.status === 'stopping'
                  var dur = running
                    ? monDuration(Date.now() - (j.startedAt || 0))
                    : monDuration(typeof j.finishedAt === 'number' && j.startedAt ? j.finishedAt - j.startedAt : null)
                  return h('div', {
                    key: j.id,
                    className: 'dhb-row',
                    style: { justifyContent: 'space-between', alignItems: 'baseline', paddingLeft: 2 },
                    title: j.detail !== undefined ? j.detail : j.id,
                  },
                    h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } },
                      h('span', { className: 'dhb-badge' }, j.kind),
                      ' ' + (j.label !== '' ? j.label : j.id)),
                    h('span', { className: 'dhb-hint', style: { flex: 'none' } },
                      (running ? t('monJobRunning') : t('monJobStatus', { status: j.status })) + ' · ' + dur),
                  )
                }),
            p.live !== true ? h('span', { className: 'dhb-hint' }, t('monJobsColdNote')) : null,
          )
        : null
      var subCard = p !== null && p.subagents !== null
        ? h(MonCard, { title: t('monSubagentsTitle') },
            h('span', { className: 'dhb-hint' },
              t('monSubTotal', { n: p.subagents.length })
              + ' · ' + t('monSubRunning', { n: p.subagents.filter(function (s) { return s.kind === 'child' && s.activity === 'running' }).length })),
            p.subagents.length === 0
              ? h('span', { className: 'dhb-hint' }, t('monNoSubagents'))
              : p.subagents.map(function (s) {
                  if (s.kind === 'diagnostic') {
                    return h('div', { key: s.id, className: 'dhb-hint', style: { paddingLeft: (s.depth - 1) * 16 + 2 } },
                      '⚠ ' + t('monSubUnreadable'))
                  }
                  return h('div', {
                    key: s.id,
                    className: 'dhb-row',
                    style: { justifyContent: 'space-between', alignItems: 'baseline', paddingLeft: (s.depth - 1) * 16 + 2 },
                    title: s.id,
                  },
                    h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } },
                      (s.label !== '' ? s.label : s.id.slice(0, 8))
                      + ' · ' + (s.mode === 'continuable' ? t('monSubContinuable') : t('monSubOneShot'))),
                    h('span', { className: 'dhb-hint', style: { flex: 'none' } },
                      (s.activity === 'running' ? t('monSubRunning') : t('monSubInactive'))
                      + ' · ' + (s.turns !== null ? s.turns + t('monTurns') + '·' + s.steps + t('monSteps') : '—')
                      + ' · ' + t('monOutput') + ' ' + monTokens(s.output)),
                  )
                }),
          )
        : null
      if (jobsCard === null && subCard === null) {
        return h('p', { className: 'dhb-desc' }, t('monTasksUnavailable'))
      }
      return h('div', { className: 'dhb-list' }, jobsCard, subCard)
    }

    /**
     * 监控面板：两个标签页——「概览」（整日志统计 + token）与「任务」
     * （后台作业 + 子代理树）。经宿主 /monitor 单请求轮询（5s 自动刷新，
     * token 折叠走宿主增量游标）；会话切换（sessionId 变化）自动重载；
     * 切换会话不保留 tab 选择之外的任何状态。
     */
    function MonitorView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      var sessionId = kit !== undefined ? kit.sessionId : undefined

      var dataState = React.useState({ status: 'idle', payload: null })
      var data = dataState[0]
      var setData = dataState[1]

      var tabState = React.useState('overview')
      var tab = tabState[0]
      var setTab = tabState[1]

      var load = React.useCallback(function (sid) {
        if (sid === undefined || sid === '') return
        // 代计数：会话切换/快速刷新时，晚到的旧响应不得覆盖新数据。
        setData(function (prev) { return { status: prev.payload === null ? 'loading' : 'refreshing', payload: prev.payload } })
        api('/monitor?sessionId=' + encodeURIComponent(sid))
          .then(function (value) { setData({ status: 'ready', payload: value }) })
          .catch(function (error) { setData({ status: 'error', payload: null, error: String(error.message || error) }) })
      }, [])

      React.useEffect(function () {
        load(sessionId)
        // 自动刷新：面板在前台时每 5s 拉一次（token 折叠走宿主增量游标）。
        if (sessionId === undefined || sessionId === '') return undefined
        var timer = setInterval(function () { load(sessionId) }, 5000)
        return function () { clearInterval(timer) }
      }, [sessionId, load])

      if (sessionId === undefined || sessionId === '') {
        return h('div', { className: 'dhb-page' }, h('p', { className: 'dhb-desc' }, t('monNoSession')))
      }

      var p = data.payload

      // tab 导航：与面板顶部工具导航行同款按钮形态（data-active 高亮）。
      var tabItem = function (key, label) {
        return h('button', {
          className: 'dhb-toolsNavItem', type: 'button',
          'data-active': tab === key ? '1' : '0',
          onClick: function () { setTab(key) },
        }, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label))
      }

      return h('div', { className: 'dhb-page' },
        h('div', { className: 'dhb-row', style: { justifyContent: 'space-between' } },
          h('span', { className: 'dhb-hint' },
            p !== null ? (p.live === true ? t('monLive') : t('monCold')) : ''),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { load(sessionId) } }, t('refresh')),
        ),
        h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('monPanelTitle') },
          tabItem('overview', t('monTabOverview')),
          tabItem('tasks', t('monTabTasks')),
        ),
        data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
        : data.status === 'error' ? h(Banner, { kind: 'err', text: data.error })
        : tab === 'tasks'
          ? h(MonTasksTab, { t: t, payload: p })
          : h(MonOverviewTab, { t: t, payload: p }),
        h('p', { className: 'dhb-hint' }, t('monIntro')),
      )
    }
