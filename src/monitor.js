// ══ monitor ══ 监控面板 MonitorView：概览（轮/步、耗时、token）+ 任务（后台作业、子代理树）两个标签页。
    // ── 监控面板（会话运行概况）──────────────────────────────────────────

    /** ms 时长 → "36m24s" / "37.3s" / "412ms"。 */
    function monDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
      if (ms < 1000) return Math.round(ms) + 'ms'
      var s = Math.round(ms / 1000) // 先取整秒再进位——119.6s 曾产出 '1m60s'
      if (s < 60) return s + 's'
      var m = Math.floor(s / 60)
      var rest = s - m * 60
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

    /** 上下文水位卡：水位条（contextPressure：provider 锚定的占比）+
     * 构成分解（contextBreakdown：系统提示词/工具/对话消息的启发式
     * 估值——官方口径明确它不等于占比分母，故作图例而非堆叠入条）。
     * 投影缺任一字段（无请求/未上报容量）时返回 null 隐藏整卡。 */
    function ctxCard(p, t) {
      if (p === null || p.context === null || typeof p.context !== 'object') return null
      var projected = p.context.projectedTokens
      var windowTokens = p.context.contextWindow
      if (typeof projected !== 'number' || typeof windowTokens !== 'number' || windowTokens <= 0) return null
      var pct = Math.min(100, Math.round(projected / windowTokens * 100))
      var color = pct >= 85 ? '#c0392b' : pct >= 70 ? '#d68910' : '#2f6fed'
      // 构成分解行（缺投影则整段隐藏）
      var b = p !== null && p.breakdown !== null && typeof p.breakdown === 'object' ? p.breakdown : null
      var breakdownRows = b === null ? null : [
        { key: 'monCtxSystem', v: b.systemTokens },
        { key: 'monCtxTools', v: b.toolsTokens },
        { key: 'monCtxMessages', v: b.messageTokens },
      ].filter(function (r) { return typeof r.v === 'number' })
      return h(MonCard, { title: t('monContextTitle') },
        // 水位条：provider 锚定的占用比例
        h('div', { style: { width: '100%', height: 8, borderRadius: 4, background: 'var(--dsw-alias-border-l2,#e3e6ec)', overflow: 'hidden' } },
          h('div', {
            style: { width: pct + '%', height: '100%', background: color, transition: 'width .3s' },
          })),
        h('span', { className: 'dhb-hint' },
          t('monContextUsed', { pct: pct })
          + ' · ' + monTokens(projected) + ' / ' + monTokens(windowTokens)
          + (pct >= 85 ? ' · ' + t('monContextHigh') : '')),
        // 构成分解：官方 contextBreakdown 的三项启发式估值
        breakdownRows !== null && breakdownRows.length > 0
          ? h('div', { style: { width: '100%', display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 } },
              breakdownRows.map(function (r) {
                return h('span', { key: r.key, className: 'dhb-hint', style: { display: 'flex', justifyContent: 'space-between' } },
                  h('span', null, t(r.key)),
                  h('span', null, '~' + monTokens(r.v)))
              }),
              h('span', { className: 'dhb-hint', style: { marginTop: 2, opacity: 0.8 } }, t('monCtxNote')),
            )
          : null,
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
        // 上下文水位（官方 contextPressure 投影；无数据时隐藏整卡）
        ctxCard(p, t),
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
      var subCard = p !== null && Array.isArray(p.subagents)
        ? h(SubagentsCard, { t: t, subagents: p.subagents })
        : null
      if (jobsCard === null && subCard === null) {
        return h('p', { className: 'dhb-desc' }, t('monTasksUnavailable'))
      }
      return h('div', { className: 'dhb-list' }, jobsCard, subCard)
    }


    /** 子代理列表卡（重构版设计）：
     * - 状态圆点为第一锚点（运行中实心呼吸/已结束空心灰），扫读先色后字
     * - 指标组右对齐固定列（N轮·M步  输出  时间）可纵向比较
     * - 运行中置顶（轮次降序），已结束按输出降序，默认折 5 条
     * - depth>1 缩进 + 连接线呈现谱系；诊断行独立成组置底
     * - 筛选片 [全部|运行中]；可续聊入口在第二行（仅 continuable）
     */
    function SubagentsCard(props) {
      var t = props.t
      var subs = props.subagents

      var filterState = React.useState('all')
      var filter = filterState[0]
      var setFilter = filterState[1]
      var expandedState = React.useState(false)
      var expanded = expandedState[0]
      var setExpanded = expandedState[1]

      var children = subs.filter(function (s) { return s.kind === 'child' })
      var diagnostics = subs.filter(function (s) { return s.kind === 'diagnostic' })
      var running = children.filter(function (s) { return s.activity === 'running' })
        .sort(function (a, b) { return (b.turns ?? 0) - (a.turns ?? 0) })
      var done = children.filter(function (s) { return s.activity !== 'running' })
        .sort(function (a, b) { return (b.output ?? 0) - (a.output ?? 0) })

      var visibleDone = expanded || filter === 'running' ? done : done.slice(0, 5)
      var hiddenCount = done.length - Math.min(done.length, expanded ? done.length : 5)
      // 筛选运行中时已结束整组隐藏
      if (filter === 'running') { visibleDone = []; hiddenCount = 0 }

      var timeOf = function (ms) {
        if (typeof ms !== 'number' || ms <= 0) return ''
        try { var d = new Date(ms); var two = function (v) { return (v < 10 ? '0' : '') + v }
          return two(d.getHours()) + ':' + two(d.getMinutes()) } catch (err) { return '' }
      }
      var elapsedOf = function (s) {
        if (typeof s.firstTime !== 'number' || s.firstTime <= 0) return null
        var end = s.activity === 'running' ? Date.now() : (typeof s.lastTime === 'number' && s.lastTime > 0 ? s.lastTime : Date.now())
        return end - s.firstTime
      }

      // 单行（结束态）：圆点 名字 | 指标 输出 时间
      var rowDone = function (s) {
        return h('div', {
          key: s.id,
          style: { display: 'flex', alignItems: 'baseline', gap: 6, padding: '2px 0', fontSize: 12, paddingLeft: (s.depth - 1) * 14 },
          title: s.id,
        },
          h('span', { style: { flex: 'none', color: 'var(--dsw-alias-border-l2,#8a919e)', fontSize: 10, lineHeight: '16px' } }, s.depth > 1 ? '└○' : '○'),
          h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 } },
            (s.label !== '' ? s.label : s.id.slice(0, 8))),
          h('span', { className: 'dhb-hint', style: { flex: 'none', whiteSpace: 'nowrap' } },
            (s.turns !== null ? s.turns + t('monTurns') + '·' + s.steps + t('monSteps') : '—')
            + '  ' + monTokens(s.output)
            + (timeOf(s.lastTime) !== '' ? '  ' + timeOf(s.lastTime) : '')),
        )
      }

      // 双行（运行态）：第一行同上但实心呼吸点；第二行 续聊入口 + 实时耗时
      var rowRunning = function (s) {
        var el = elapsedOf(s)
        return h('div', { key: s.id, style: { padding: '2px 0' }, title: s.id },
          h('div', {
            style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, paddingLeft: (s.depth - 1) * 14 },
          },
            h('span', { style: { flex: 'none', color: '#1e7e34', fontSize: 10, lineHeight: '16px', animation: 'dhbSubPulse 1.6s ease-in-out infinite' } }, '●'),
            h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 600 } },
              (s.label !== '' ? s.label : s.id.slice(0, 8))),
            h('span', { className: 'dhb-hint', style: { flex: 'none', whiteSpace: 'nowrap' } },
              (s.turns !== null ? s.turns + t('monTurns') + '·' + s.steps + t('monSteps') : '—')
              + '  ' + monTokens(s.output))),
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11, paddingLeft: (s.depth - 1) * 14 + 16 } },
            s.mode === 'continuable'
              ? h('button', {
                  className: 'dhb-btn', type: 'button',
                  style: { padding: '0 8px', fontSize: 11, height: 20 },
                  onClick: function () {
                    if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
                      void navigator.clipboard.writeText(s.id)
                    }
                  },
                  title: t('monSubResumeHint'),
                }, '▸ ' + t('monSubContinuable'))
              : null,
            el !== null
              ? h('span', { className: 'dhb-hint' }, t('monSubElapsed') + ' ' + monDuration(el))
              : null,
          ),
        )
      }

      return h(MonCard, { title: t('monSubagentsTitle') },
        // 汇总栏 + 筛选片
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, width: '100%' } },
          h('span', { className: 'dhb-hint' },
            h('span', { style: { color: running.length > 0 ? '#1e7e34' : undefined } }, '● ' + running.length),
            '  ',
            h('span', {}, '○ ' + done.length)),
          h('div', { style: { marginLeft: 'auto', display: 'flex', gap: 2 } },
            ['all', 'running'].map(function (f) {
              return h('button', {
                key: f, type: 'button',
                className: 'dhb-btn',
                style: { padding: '0 8px', fontSize: 11, height: 20, fontWeight: filter === f ? 600 : 400, opacity: filter === f ? 1 : 0.65 },
                onClick: function () { setFilter(f) },
              }, t(f === 'all' ? 'monSubFilterAll' : 'monSubFilterRunning'))
            })),
        ),
        children.length === 0 && diagnostics.length === 0
          ? h('span', { className: 'dhb-hint' }, t('monNoSubagents'))
          : null,
        // 运行组（无分割线，焦点组）
        running.map(rowRunning),
        // 已结束分组线
        visibleDone.length > 0
          ? h('div', { className: 'dhb-hint', style: { width: '100%', borderTop: '1px solid var(--dsw-alias-border-l2,#e3e6ec)', paddingTop: 4, marginTop: 4 } },
              '── ' + t('monSubDoneGroup') + '（' + done.length + '）')
          : null,
        visibleDone.map(rowDone),
        hiddenCount > 0
          ? h('div', { style: { textAlign: 'center', padding: 4 } },
              h('button', { className: 'dhb-btn', type: 'button', style: { fontSize: 11, height: 20, padding: '0 10px' }, onClick: function () { setExpanded(true) } },
                t('monSubMore', { n: hiddenCount }) + ' ▾'))
          : null,
        expanded && done.length > 5
          ? h('div', { style: { textAlign: 'center', padding: 4 } },
              h('button', { className: 'dhb-btn', type: 'button', style: { fontSize: 11, height: 20, padding: '0 10px' }, onClick: function () { setExpanded(false) } },
                t('monSubCollapse')))
          : null,
        // 诊断组（数据异常非任务——置底独立）
        diagnostics.length > 0
          ? h('div', { style: { marginTop: 4 } },
              h('div', { className: 'dhb-hint', style: { color: '#d68910' } }, '⚠ ' + t('monSubUnreadableGroup', { n: diagnostics.length })),
              diagnostics.map(function (d) {
                return h('div', { key: d.id, className: 'dhb-hint', style: { paddingLeft: 2 }, title: d.id + ' · ' + d.reason }, '⚠ ' + t('monSubUnreadable'))
              }))
          : null,
      )
    }

    /** 字节数 → "22.5G" / "531M" / "412K"。1024 进制（内存语境的惯用
     * 单位），≥1G 保留一位小数，M 级取整——25770M 这类读数从此绝迹。 */
    function monBytes(n) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '—'
      if (n < 1024) return String(Math.round(n)) + 'B'
      var units = ['K', 'M', 'G', 'T']
      var v = n
      var u = -1
      do { v /= 1024; u += 1 } while (v >= 1024 && u < units.length - 1)
      // ≥100 用整数（531M），否则一位小数（22.5G）——同一套"够看就好"缩放
      return (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)) + units[u]
    }

    /** 系统标签页：CPU（整机/本进程）、内存（系统/进程）、负载、运行时长。
     * 数据独立于会话——无会话上下文也可查看。CPU 首答 null（差分采样
     * 需两帧），5s 轮询下第二帧起有值。 */
    function MonSystemTab(props) {
      var t = props.t
      var dataState = React.useState({ status: 'idle', value: null })
      var data = dataState[0]
      var setData = dataState[1]

      React.useEffect(function () {
        var load = function () {
          api('/sysres').then(function (value) {
            setData({ status: 'ready', value: value })
          }).catch(function (error) {
            setData({ status: 'error', error: String(error.message || error) })
          })
        }
        load()
        var timer = setInterval(load, 5000)
        return function () { clearInterval(timer) }
      }, [])

      if (data.status === 'loading' || data.status === 'idle') {
        return h('p', { className: 'dhb-desc' }, t('loading'))
      }
      if (data.status === 'error') return h(Banner, { kind: 'err', text: data.error })
      var v = data.value

      // 压力口径（宿主已扣除可回收缓存页）；缺新字段（旧宿主半）时退回
      // used/total 原比例——显示语义不变差。
      var memPct = v.totalMem > 0 ? Math.round(v.usedMem / v.totalMem * 100) : null
      var bar = function (pct, danger) {
        return h('div', { style: { width: '100%', height: 8, borderRadius: 4, background: 'var(--dsw-alias-border-l2,#e3e6ec)', overflow: 'hidden', margin: '4px 0' } },
          h('div', { style: { width: Math.min(100, pct) + '%', height: '100%', background: danger ? '#c0392b' : '#2f6fed', transition: 'width .3s' } }))
      }

      return h('div', { className: 'dhb-list' },
        h(MonCard, { title: t('monSysCpu') },
          h('span', { style: { fontSize: 15 } },
            (v.cpuPct !== null ? v.cpuPct + '%' : '—') + ' ' + t('monSysCpuOf', { n: v.cpus })),
          bar(v.cpuPct ?? 0, (v.cpuPct ?? 0) >= 85),
          h('span', { className: 'dhb-hint' },
            t('monSysProcCpu') + ' ' + (v.procCpuPct !== null ? v.procCpuPct + '%' : '—')),
          // Windows 的 os.loadavg 恒 [0,0,0]（无信息量）——宿主标记
          // 不支持时整行隐藏，不留"0 / 0 / 0"的困惑。
          v.loadavgSupported !== false
            ? h('span', { className: 'dhb-hint' }, t('monSysLoad') + ' ' + v.loadavg.join(' / '))
            : null,
        ),
        h(MonCard, { title: t('monSysMem') },
          h('span', { style: { fontSize: 15 } },
            monBytes(v.usedMem) + ' / ' + monBytes(v.totalMem) + (memPct !== null ? ' · ' + memPct + '%' : '')),
          bar(memPct ?? 0, (memPct ?? 0) >= 90),
          // 可回收缓存行：解释"为什么压力 57% 而物理几乎满"——
          // macOS 的文件缓存随时让给应用，不是真实占用。
          typeof v.reclaimableMem === 'number' && v.reclaimableMem > 0
            ? h('span', { className: 'dhb-hint' }, t('monSysCached') + ' ' + monBytes(v.reclaimableMem) + ' · ' + t('monSysPressureNote'))
            : null,
          // 进程行拆两行小字：RSS 一行、heap 一行——挤压在一行时
          // "531M · heap 119M / 279M" 在窄面板会折行错位。
          h('span', { className: 'dhb-hint' }, 'dsh ' + t('monSysProcMem') + ' ' + monBytes(v.rss)),
          h('span', { className: 'dhb-hint' },
            'heap ' + monBytes(v.heapUsed) + ' / ' + monBytes(v.heapTotal)
            + (v.heapTotal > 0 ? ' · ' + Math.round(v.heapUsed / v.heapTotal * 100) + '%' : '')),
        ),
        h(MonCard, { title: t('monSysUptime') },
          h('span', { className: 'dhb-hint' },
            t('monSysOsUptime') + ' ' + monDuration(v.osUptimeSec * 1000)
            + ' · dsh ' + monDuration(v.procUptimeSec * 1000)),
        ),
        h('p', { className: 'dhb-hint' }, t('monSysNote')),
      )
    }

    /**
     * 监控面板：标签页——「概览」（整日志统计 + token）、「任务」与「系统」
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

      var loadGen = React.useRef(0)
      var load = React.useCallback(function (sid) {
        if (sid === undefined || sid === '') return
        var gen = loadGen.current = loadGen.current + 1
        setData(function (prev) { return { status: prev.payload === null ? 'loading' : 'refreshing', payload: prev.payload } })
        api('/monitor?sessionId=' + encodeURIComponent(sid))
          .then(function (value) { if (gen !== loadGen.current) return; setData({ status: 'ready', payload: value }) })
          .catch(function (error) { if (gen !== loadGen.current) return; setData({ status: 'error', payload: null, error: String(error.message || error) }) })
      }, [])

      React.useEffect(function () {
        load(sessionId)
        // 自动刷新：面板在前台时每 5s 拉一次（token 折叠走宿主增量游标）。
        if (sessionId === undefined || sessionId === '') return undefined
        var timer = setInterval(function () { load(sessionId) }, 5000)
        return function () { clearInterval(timer) }
      }, [sessionId, load])

      var noSession = sessionId === undefined || sessionId === ''
      // tab 行常驻（提前 return 曾令 system 标签不可达/被困——changes.js
      // 同款模式）；无会话时概览/任务 tab 内容显示提示文案。

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
        noSession ? null : h('div', { className: 'dhb-row', style: { justifyContent: 'space-between' } },
          h('span', { className: 'dhb-hint' },
            p !== null ? (p.live === true ? t('monLive') : t('monCold')) : ''),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { load(sessionId) } }, t('refresh')),
        ),
        h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('monPanelTitle') },
          tabItem('overview', t('monTabOverview')),
          tabItem('tasks', t('monTabTasks')),
          tabItem('system', t('monTabSystem')),
        ),
        tab === 'system'
          ? h(MonSystemTab, { t: t })
          : noSession ? h('p', { className: 'dhb-desc' }, t('monNoSession'))
          : data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : data.status === 'error' ? h(Banner, { kind: 'err', text: data.error })
          : tab === 'tasks'
            ? h(MonTasksTab, { t: t, payload: p })
            : h(MonOverviewTab, { t: t, payload: p }),
        tab === 'system' ? null : h('p', { className: 'dhb-hint' }, t('monIntro')),
      )
    }
