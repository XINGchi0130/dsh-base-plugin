// ══ usage ══ 模型用量统计节：UsageDonut 环形图 + UsageSection（日期范围/每模型表/价格编辑/Top 会话）。
    // ── 模型用量设置节 ─────────────────────────────────────────────────────

    /** 每模型系列的图表配色（按模型 id 稳定映射）。 */
    var USAGE_COLORS = ['#2f6fed', '#1e7e34', '#c0392b', '#8e44ad', '#d68910', '#00838f', '#c2185b', '#5d4037']
    function usageColorOf(model, index) {
      void model // 保留参数形状（调用方传 model）；配色按序列 index 取
      return USAGE_COLORS[index % USAGE_COLORS.length]
    }

    /**
     * 极简环形图：SVG 圆 + stroke-dasharray 画弧段（零依赖）。Props：
     * slices [{ value, color, label }]，外加中心总计。
     */
    function UsageDonut(props) {
      var slices = props.slices !== undefined ? props.slices : []
      var total = 0
      for (var i = 0; i < slices.length; i += 1) total += slices[i].value
      var R = 15.9155 // radius giving circumference 100 (percent units)
      var offset = 25 // start at 12 o'clock
      var arcs = slices.map(function (slice, idx) {
        var pct = total > 0 ? slice.value / total * 100 : 0
        var dash = pct + ' ' + (100 - pct)
        var el = h('circle', {
          key: idx,
          cx: 21, cy: 21, r: R,
          fill: 'transparent',
          stroke: slice.color,
          strokeWidth: props.thickness !== undefined ? props.thickness : 6,
          strokeDasharray: dash,
          strokeDashoffset: offset,
        })
        offset -= pct
        return el
      })
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: 14, flex: 'none' } },
        (function () {
          // 自适应：内孔约占 2*(R - 描边/2) 个 viewBox 单位；数字字形宽
          // 约 0.6*字号。逐步缩小直到标签放下，低于可读下限则整块去掉。
          var thickness = props.thickness !== undefined ? props.thickness : 6
          var hole = 2 * (R - thickness / 2) - 2.4
          var top = props.centerTop !== undefined ? props.centerTop : ''
          var topSize = 7.2
          if (top !== '') {
            while (topSize > 3.4 && top.length * topSize * 0.62 > hole) topSize -= 0.4
            if (top.length * topSize * 0.62 > hole) top = ''
          }
          var sub = props.centerSub !== undefined ? props.centerSub : ''
          var subSize = 4.4
          if (sub !== '') {
            while (subSize > 3 && sub.length * subSize * 0.62 > hole) subSize -= 0.3
            if (sub.length * subSize * 0.62 > hole) sub = ''
          }
          return h('svg', { viewBox: '0 0 42 42', width: props.size !== undefined ? props.size : 96, height: props.size !== undefined ? props.size : 96 },
            h('circle', { cx: 21, cy: 21, r: R, fill: 'transparent', stroke: 'var(--dsw-alias-border-l2,#e3e6ec)', strokeWidth: thickness }),
            arcs,
            top !== '' ? h('text', { x: 21, y: 20.4, textAnchor: 'middle', fontSize: topSize, fill: 'var(--dsw-alias-label-primary,#222)', fontWeight: 600 }, top) : null,
            sub !== '' ? h('text', { x: 21, y: 26, textAnchor: 'middle', fontSize: subSize, fill: 'var(--dsw-alias-label-caption,#8a919e)' }, sub) : null,
          )
        })(),
        props.children !== undefined && props.children !== null ? h('div', null, props.children) : null,
      )
    }

    /**
     * 用量设置节（紧跟模型节）：日期范围过滤、每模型摘要卡、每模型
     * 按日堆叠图、可编辑价格的模型表、工具用量视图与 Top 会话。
     */
    function UsageSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', report: null, error: '' })
      var data = dataState[0]
      var setData = dataState[1]

      var rangeState = React.useState({ start: '', end: '' })
      var range = rangeState[0]
      var setRange = rangeState[1]

      var tabState = React.useState('models')
      var tab = tabState[0]
      var setTab = tabState[1]

      // trend metric: 'tokens' | 'calls'
      var metricState = React.useState('tokens')
      var metric = metricState[0]
      var setMetric = metricState[1]

      // priceEditor: null | { model, input, cacheRead, cacheWrite, output }
      var priceState = React.useState(null)
      var priceEditor = priceState[0]
      var setPriceEditor = priceState[1]

      var fmt = function (n) {
        if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
        return String(Math.round(n))
      }
      var fmtCost = function (n) { return typeof n === 'number' && Number.isFinite(n) ? '$' + (n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)) : '—' }
      var isoDay = function (d) {
        var two = function (v) { return (v < 10 ? '0' : '') + v }
        return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
      }

      var loadGen = React.useRef(0)
      var load = React.useCallback(function (nextRange, force) {
        var gen = loadGen.current = loadGen.current + 1
        setData(function (prev) {
          return prev.status === 'ready'
            ? { status: 'refreshing', report: prev.report, error: '' }
            : { status: 'loading', report: prev.report, error: '' }
        })
        var qs = ''
        if (nextRange.start !== '') qs += (qs === '' ? '?' : '&') + 'start=' + encodeURIComponent(nextRange.start)
        if (nextRange.end !== '') qs += (qs === '' ? '?' : '&') + 'end=' + encodeURIComponent(nextRange.end)
        if (force === true) qs += (qs === '' ? '?' : '&') + 'force=1'
        api('/usage' + qs)
          .then(function (report) { if (gen !== loadGen.current) return; setData({ status: 'ready', report: report, error: '' }) })
          .catch(function (error) { if (gen !== loadGen.current) return; setData(function (prev) { return Object.assign({}, prev, { status: 'error', error: String(error.message || error) }) }) })
      }, [])

      React.useEffect(function () { load(range, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

      /** 快捷区间：0=全部，'today'/'yesterday'/'month'，或 N=最近 N 天。 */
      function applyQuick(sel) {
        var next
        var today = new Date()
        if (sel === 0) next = { start: '', end: '' }
        else if (sel === 'today') next = { start: isoDay(today), end: isoDay(today) }
        else if (sel === 'yesterday') {
          var y = new Date(Date.now() - 86400000)
          next = { start: isoDay(y), end: isoDay(y) }
        } else if (sel === 'month') {
          next = { start: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), end: isoDay(today) }
        } else {
          next = { start: isoDay(new Date(Date.now() - (sel - 1) * 86400000)), end: isoDay(today) }
        }
        setRange(next)
        load(next, false)
      }

      /** 选定即查询（挑一个日期本身就是查询意图）。 */
      function onDateChange(field, value) {
        if (value === range[field]) return
        var next = Object.assign({}, range)
        next[field] = /^\d{4}-\d{2}-\d{2}$/.test(value) || value === '' ? value : next[field]
        setRange(next)
        load(next, false)
      }

      function onEditPrice(row) {
        var prices = data.report !== null && data.report.prices !== undefined ? data.report.prices : {}
        var current = prices[row.model] !== undefined ? prices[row.model] : { input: '', cacheRead: '', cacheWrite: '', output: '' }
        setPriceEditor({
          model: row.model,
          input: String(current.input ?? ''),
          cacheRead: String(current.cacheRead ?? ''),
          cacheWrite: String(current.cacheWrite ?? ''),
          output: String(current.output ?? ''),
        })
      }

      function onSavePrices() {
        if (priceEditor === null || data.report === null) return
        var next = {}
        var source = data.report.prices !== undefined ? data.report.prices : {}
        for (var key in source) next[key] = source[key]
        next[priceEditor.model] = {
          input: Number(priceEditor.input) || 0,
          cacheRead: Number(priceEditor.cacheRead) || 0,
          cacheWrite: Number(priceEditor.cacheWrite) || 0,
          output: Number(priceEditor.output) || 0,
        }
        post('/usage/prices', { prices: next })
          .then(function () { setPriceEditor(null); load(range, false) })
          .catch(function (error) {
            setData(function (prev) { return Object.assign({}, prev, { error: String(error.message || error) }) })
          })
      }

      var report = data.report
      var hasData = report !== null && report.byModel !== undefined && report.byModel.length > 0
      var modelIndex = {}
      if (hasData) {
        for (var mi = 0; mi < report.byModel.length; mi += 1) modelIndex[report.byModel[mi].model] = mi
      }
      var series = report !== null && report.series !== undefined ? report.series : null
      var maxDay = 0
      if (series !== null) {
        for (var di = 0; di < series.buckets.length; di += 1) {
          var v = metric === 'calls' ? series.buckets[di].calls : series.buckets[di].tokens
          if (v > maxDay) maxDay = v
        }
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionUsage')),
        h('p', { className: 'dhb-desc' }, t('usageIntro')),
        h('div', { className: 'dhb-usRange' },
          h('span', { className: 'dhb-hint' }, t('usageRangeStart')),
          h('input', { className: 'dhb-usDate', type: 'date', value: range.start, onChange: function (e) { onDateChange('start', e.target.value) } }),
          h('span', { className: 'dhb-hint' }, t('usageRangeEnd')),
          h('input', { className: 'dhb-usDate', type: 'date', value: range.end, onChange: function (e) { onDateChange('end', e.target.value) } }),
          h('button', { className: 'dhb-btn', type: 'button', title: t('refresh'), 'aria-label': t('refresh'), onClick: function () { load(range, false) } }, '↻'),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick('today') } }, t('usageRangeToday')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick('yesterday') } }, t('usageRangeYesterday')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick(7) } }, t('usageRange7d')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick(30) } }, t('usageRange30d')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick('month') } }, t('usageRangeThisMonth')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { applyQuick(0) } }, t('usageRangeAll')),
        ),
        h('div', { className: 'dhb-row' },
          h('div', { className: 'dhb-usTabs' },
            h('button', { className: 'dhb-usTab', type: 'button', 'data-on': tab === 'models' ? '1' : undefined, onClick: function () { setTab('models') } }, t('usageTabModels')),
            h('button', { className: 'dhb-usTab', type: 'button', 'data-on': tab === 'tools' ? '1' : undefined, onClick: function () { setTab('tools') } }, t('usageTabTools')),
          ),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { load(range, true) } }, t('usageRescan')),
        ),
        data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('usageScanning'))
        : data.status === 'error' ? h(Banner, { kind: 'err', text: data.error })
        : tab === 'tools' && report !== null ? h('div', { className: 'dhb-list' },
            h('p', { className: 'dhb-hint' }, t('usageToolNote')),
            h('table', { className: 'dhb-usTable' },
              h('thead', null, h('tr', null,
                h('th', null, t('usageToolCol')),
                h('th', { className: 'dhb-usNum' }, t('usageToolCalls')),
                h('th', null, t('usageToolLast')),
              )),
              h('tbody', null, report.tools.map(function (tool) {
                return h('tr', { key: tool.name },
                  h('td', null, tool.name),
                  h('td', { className: 'dhb-usNum' }, fmt(tool.calls)),
                  h('td', null, tool.lastTime > 0 ? new Date(tool.lastTime).toLocaleString() : '—'),
                )
              })),
            ),
          )
        : !hasData ? h('p', { className: 'dhb-desc' }, t('usageNoData'))
        : h(React.Fragment, null,
          h('div', { className: 'dhb-row', style: { alignItems: 'stretch' } },
            h('div', { className: 'dhb-usStat' },
              h('span', { className: 'dhb-usStatV' }, fmt(report.totals.input + report.totals.cacheRead + report.totals.cacheWrite + report.totals.output)),
              h('span', { className: 'dhb-usStatL' }, t('usageTotalTokens') + (report.range.start !== '' || report.range.end !== '' ? ' · ' + (report.range.start || '…') + ' ~ ' + (report.range.end || '…') : ''))),
            report.byModel.slice(0, 4).map(function (row) {
              return h('div', { className: 'dhb-usStat', key: row.model },
                h('span', { className: 'dhb-usStatV' }, fmt(row.input + row.cacheRead + row.cacheWrite + row.output)),
                h('span', { className: 'dhb-usStatL' },
                  h('span', { className: 'dhb-usDot', style: { background: usageColorOf(row.model, modelIndex[row.model] ?? 0) } }),
                  row.model.split('/').pop() + ' ' + t('usageCostCol').replace('(', '').replace(')', '')),
              )
            }),
          ),
          h('div', { className: 'dhb-row', style: { alignItems: 'stretch', flexWrap: 'wrap' } },
            h('div', { className: 'dhb-usStat' },
              h('span', { className: 'dhb-usStatV' }, fmt(report.totals.requests)),
              h('span', { className: 'dhb-usStatL' }, t('usageRequests') + ' (' + t('usageRequestsAllTime') + ') · ' + t('usageSessions', { n: report.sessionCount }))),
            h('div', { className: 'dhb-usStat' },
              h('span', { className: 'dhb-usStatV' }, fmt(report.totals.input) + ' / ' + fmt(report.totals.cacheRead) + ' / ' + fmt(report.totals.cacheWrite)),
              h('span', { className: 'dhb-usStatL' }, t('usageInput') + ' · ' + t('usageCacheRead') + ' · ' + t('usageCacheWrite'))),
            h('div', { className: 'dhb-usStat' },
              h('span', { className: 'dhb-usStatV' }, fmt(report.totals.output)),
              h('span', { className: 'dhb-usStatL' }, t('usageOutput') + ' ' + t('usageReasoning', { n: fmt(report.totals.reasoning) }))),
            h('div', { className: 'dhb-usStat' },
              h('span', { className: 'dhb-usStatV' }, fmtCost(report.totalsCost)),
              h('span', { className: 'dhb-usStatL' }, t('usageCost') + (report.anyUnpriced ? ' · ' + t('usageCostUnpriced') : ''))),
          ),
          h('div', { className: 'dhb-row', style: { justifyContent: 'space-between' } },
            h('h3', { className: 'dhb-sectTitle', style: { margin: 0 } },
              t('usageSeriesTitle') + ' · ' + t(series !== null && series.granularity === 'hourly' ? 'usageGranHourly' : 'usageGranDaily')),
            h('div', { className: 'dhb-usTabs' },
              h('button', { className: 'dhb-usTab', type: 'button', 'data-on': metric === 'tokens' ? '1' : undefined, onClick: function () { setMetric('tokens') } }, t('usageMetricTokens')),
              h('button', { className: 'dhb-usTab', type: 'button', 'data-on': metric === 'calls' ? '1' : undefined, onClick: function () { setMetric('calls') } }, t('usageMetricCalls')),
            ),
          ),
          series !== null && series.buckets.length > 0 ? h('div', null,
            h('div', { className: 'dhb-usChart' },
              maxDay > 0 ? h('span', { className: 'dhb-usMaxTag' }, fmt(maxDay)) : null,
              series.buckets.map(function (bucket, idx) {
                var value = metric === 'calls' ? bucket.calls : bucket.tokens
                var pctTotal = maxDay > 0 && value > 0 ? Math.max(3, Math.round(value / maxDay * 100)) : 0
                var tip = bucket.label + ' · ' + (metric === 'calls' ? String(bucket.calls) + ' ' + t('usageMetricCalls') : fmt(bucket.tokens) + ' ' + t('usageMetricTokens'))
                if (metric === 'tokens') {
                  tip += '\n' + series.models.map(function (m) {
                    var v = m.values[idx]
                    return v > 0 ? m.model.split('/').pop() + ': ' + fmt(v) : ''
                  }).filter(Boolean).join('\n')
                }
                return h('div', {
                  key: bucket.label,
                  className: 'dhb-usCol',
                  style: { height: pctTotal + '%' },
                  title: tip,
                },
                  metric === 'tokens'
                    ? series.models.map(function (m) {
                        var v = m.values[idx]
                        if (v <= 0) return null
                        var share = value > 0 ? Math.round(v / value * pctTotal) : 0
                        return h('div', {
                          key: m.model,
                          className: 'dhb-usSeg',
                          style: { height: share + '%', background: usageColorOf(m.model, modelIndex[m.model] ?? 0) },
                        })
                      })
                    : h('div', { className: 'dhb-usSeg', style: { height: '100%', background: '#2f6fed' } }),
                )
              }),
            ),
            h('div', { className: 'dhb-usAxis' },
              series.xTime.length > 1
                ? [0, Math.floor((series.xTime.length - 1) / 4), Math.floor((series.xTime.length - 1) / 2), Math.floor((series.xTime.length - 1) * 3 / 4), series.xTime.length - 1]
                    .filter(function (v, i, arr) { return arr.indexOf(v) === i })
                    .map(function (i) {
                      var label = series.xTime[i]
                      var short = label.length > 10 ? label.slice(5) : label
                      return h('span', { key: i, style: i === 0 ? { marginRight: 'auto' } : (i === series.xTime.length - 1 ? { marginLeft: 'auto' } : undefined) }, short)
                    })
                : h('span', null, series.xTime[0] !== undefined ? series.xTime[0] : ''),
            ),
          ) : null,
          h('div', { className: 'dhb-row', style: { alignItems: 'center', flexWrap: 'wrap', gap: 16 } },
            h(UsageDonut, {
              size: 128,
              thickness: 6.5,
              centerTop: fmt(report.totals.input + report.totals.cacheRead + report.totals.cacheWrite + report.totals.output),
              centerSub: t('usageLegendTotal'),
              slices: report.byModel.map(function (row) {
                return {
                  value: row.input + row.cacheRead + row.cacheWrite + row.output,
                  color: usageColorOf(row.model, modelIndex[row.model] ?? 0),
                }
              }),
            },
              h('div', { className: 'dhb-usLegend', style: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 } },
                report.byModel.map(function (row) {
                  var value = row.input + row.cacheRead + row.cacheWrite + row.output
                  var share = (report.totals.input + report.totals.cacheRead + report.totals.cacheWrite + report.totals.output) > 0
                    ? Math.round(value / (report.totals.input + report.totals.cacheRead + report.totals.cacheWrite + report.totals.output) * 100)
                    : 0
                  return h('span', { key: row.model, title: row.model },
                    h('span', { className: 'dhb-usDot', style: { background: usageColorOf(row.model, modelIndex[row.model] ?? 0) } }),
                    row.model.split('/').pop() + '  ' + fmt(value) + '  (' + share + '%)')
                }),
              ),
            ),
          ),
          h('table', { className: 'dhb-usTable' },
            h('thead', null, h('tr', null,
              h('th', null, t('usageModelCol')),
              h('th', { className: 'dhb-usNum' }, t('usageRequestsCol')),
              h('th', { className: 'dhb-usNum' }, t('usageInput')),
              h('th', { className: 'dhb-usNum' }, t('usageCacheRead')),
              h('th', { className: 'dhb-usNum' }, t('usageCacheWrite')),
              h('th', { className: 'dhb-usNum' }, t('usageOutput')),
              h('th', { className: 'dhb-usNum' }, t('usageCostCol')),
              h('th', null, t('usagePriceCol')),
            )),
            h('tbody', null, report.byModel.map(function (row) {
              return h('tr', { key: row.model },
                h('td', { title: row.model }, row.model.split('/').pop()),
                h('td', { className: 'dhb-usNum' }, fmt(row.requests)),
                h('td', { className: 'dhb-usNum' }, fmt(row.input)),
                h('td', { className: 'dhb-usNum' }, fmt(row.cacheRead)),
                h('td', { className: 'dhb-usNum' }, fmt(row.cacheWrite)),
                h('td', { className: 'dhb-usNum' }, fmt(row.output)),
                h('td', { className: 'dhb-usNum' }, fmtCost(row.cost)),
                h('td', null,
                  priceEditor !== null && priceEditor.model === row.model
                    ? h('span', { className: 'dhb-usPriceRow' },
                        h('input', { className: 'dhb-usPriceIn', placeholder: t('usagePriceInput'), value: priceEditor.input, onChange: function (e) { setPriceEditor(Object.assign({}, priceEditor, { input: e.target.value })) } }),
                        h('input', { className: 'dhb-usPriceIn', placeholder: t('usagePriceCacheRead'), value: priceEditor.cacheRead, onChange: function (e) { setPriceEditor(Object.assign({}, priceEditor, { cacheRead: e.target.value })) } }),
                        h('input', { className: 'dhb-usPriceIn', placeholder: t('usagePriceCacheWrite'), value: priceEditor.cacheWrite, onChange: function (e) { setPriceEditor(Object.assign({}, priceEditor, { cacheWrite: e.target.value })) } }),
                        h('input', { className: 'dhb-usPriceIn', placeholder: t('usagePriceOutput'), value: priceEditor.output, onChange: function (e) { setPriceEditor(Object.assign({}, priceEditor, { output: e.target.value })) } }),
                        h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', onClick: onSavePrices }, t('usagePriceSave')),
                      )
                    : h('button', { className: 'dhb-btn', type: 'button', onClick: function () { onEditPrice(row) } }, t('usagePriceEdit')),
                ),
              )
            })),
          ),
          h('p', { className: 'dhb-hint' }, t('usagePriceHint') + ' ' + t('usagePriceDefault')),
          report.topSessions.length > 0 ? h('div', null,
            h('h3', { className: 'dhb-sectTitle' }, t('usageTopSessions')),
            h('div', { className: 'dhb-list' },
              report.topSessions.map(function (session) {
                return h('div', { className: 'dhb-cardMeta', key: session.sessionId, title: session.sessionId },
                  h('span', { className: 'dhb-cardTitle', style: { fontSize: '12px' } }, session.title),
                  h('span', null, fmt(session.tokens) + ' tokens · ' + String(session.requests) + ' ' + t('usageRequests')),
                )
              })),
          ) : null,
        ),
      )
    }
