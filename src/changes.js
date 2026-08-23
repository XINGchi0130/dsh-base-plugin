// ══ changes ══ 文件变更面板：三 tab（工作区变更=git 基线差异 / 提交历史=本地+远程提交记录 / 编辑记录=AI write/edit 操作时间线）+ unified diff 解析器。
    // ── 文件变更面板（git，只读）──────────────────────────────────────────

    /**
     * 把 unified diff 解析为带旧行/新行行号的显示行。
     *
     * 编号遵循 unified-diff 语法：`@@ -a,b +c,d @@` 头把两个计数器重置为
     * 声明的起始值；`+` 只推进新侧，`-` 只推进旧侧，上下文行两侧都推进。
     * 文件头（`diff `、`index `、`--- `、`+++ `）与元信息行（`\ No newline`、
     * 权限/重命名/Binary 标记）不带行号。头行判断在 +/- 分支**之前**，
     * 否则 `+++ b/file` 会被误判为新增行（加行号之前的渲染器正有此 bug）。
     *
     * @returns { k, text, oldN, newN, pad } 数组——非内容行的 oldN/newN 为
     * null；pad 为两侧共用的行号槽宽（字符数）。
     */
    function buildDiffRows(diff) {
      var rows = []
      var oldN = 0
      var newN = 0
      var maxNum = 0
      var lines = String(diff).split('\n')
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i]
        if (line === '') continue
        if (line.indexOf('@@') === 0) {
          var m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
          if (m !== null) { oldN = parseInt(m[1], 10); newN = parseInt(m[2], 10) }
          rows.push({ k: '@', text: line, oldN: null, newN: null })
          continue
        }
        if (line.indexOf('diff ') === 0 || line.indexOf('index ') === 0
          || line.indexOf('--- ') === 0 || line.indexOf('+++ ') === 0
          || line.indexOf('\\') === 0
          || /^(old mode|new mode|deleted file mode|new file mode|similarity index|dissimilarity index|rename from|rename to|copy from|copy to|Binary files)/.test(line)) {
          rows.push({ k: 'h', text: line, oldN: null, newN: null })
          continue
        }
        var ch = line.charAt(0)
        if (ch === '+') {
          rows.push({ k: '+', text: line, oldN: null, newN: newN })
          newN += 1
        } else if (ch === '-') {
          rows.push({ k: '-', text: line, oldN: oldN, newN: null })
          oldN += 1
        } else {
          // 上下文行（行首空格）——两侧行号都前进。
          rows.push({ k: '', text: line, oldN: oldN, newN: newN })
          oldN += 1
          newN += 1
        }
        if (oldN > maxNum) maxNum = oldN
        if (newN > maxNum) maxNum = newN
      }
      var pad = Math.max(3, String(maxNum).length)
      for (var j = 0; j < rows.length; j++) rows[j].pad = pad
      return rows
    }

    /**
     * 「文件变更」面板（头部 ⋯ 菜单的右侧停靠覆盖层，仅当宿主报有 git
     * 二进制时出现）。经宿主 API 读会话工作区的 git 状态（首次打开未初
     * 始化时自动 init 仓库 + 打基线提交），内联展示逐文件 diff。严格只
     * 读——查看变更绝不碰工作区。只消费 `kit.sessionId` 与
     * `kit.useSessions`（cwd），因此在覆盖层的合成 kit 后同样可用。
     */
    /** 操作记录 tab：按目标分组的操作轨迹（最新在前：时间/工具/轮次/
     * ±行数/成败；数据来自宿主对会话日志的增量折叠——无 diff，纯轨迹）。
     * 与「工作区变更」互补：本 tab 是 AI 经写工具的动作历史，git tab 是
     * 磁盘当前状态对基线的差异（经 bash 的改动只出现在 git tab）。 */
    function EditHistoryView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()
      var sessionId = kit !== undefined ? kit.sessionId : undefined

      var dataState = React.useState({ status: 'idle', files: [] })
      var data = dataState[0]
      var setData = dataState[1]

      // 文件组懒渲染：默认只挂载前 15 组（20000 条实测 1500 行 DOM 一次
      // 渲染才是真瓶颈——网络载荷上一轮已摘要化封顶）；点击加载更多。
      var groupLimitState = React.useState(15)
      var groupLimit = groupLimitState[0]
      var setGroupLimit = groupLimitState[1]


      var load = React.useCallback(function (sid) {
        if (sid === undefined || sid === '') return
        api('/fileops?sessionId=' + encodeURIComponent(sid))
          .then(function (value) {
            setData({ status: 'ready', files: value.files ?? [] })
          })
          .catch(function (error) { setData({ status: 'error', error: String(error.message || error) }) })
      }, [])

      React.useEffect(function () {
        load(sessionId)
        if (sessionId === undefined || sessionId === '') return undefined
        var timer = setInterval(function () { load(sessionId) }, 15000)
        return function () { clearInterval(timer) }
      }, [sessionId, load])

      if (sessionId === undefined || sessionId === '') {
        return h('p', { className: 'dhb-desc' }, t('foNoSession'))
      }
      if (data.status === 'error') return h(Banner, { kind: 'err', text: data.error })

      var timeOf = function (ms) {
        try { var d = new Date(ms); var two = function (v) { return (v < 10 ? '0' : '') + v }
          return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) } catch (err) { return '—' }
      }

      // 外层不再用 dhb-page（那会与外层 ChangesView 的 dhb-page 嵌套出
      // 不可收缩的 flex 列——滚动失效的根因）；纯列容器让内容自然流动。
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--dsw-alias-label-secondary,#3f4550)' } },
        h('div', { className: 'dhb-row', style: { justifyContent: 'space-between' } },
          h('span', { className: 'dhb-hint' }, t('foIntro')),
          h('button', { className: 'dhb-btn', type: 'button', onClick: function () { load(sessionId) } }, t('refresh')),
        ),
        data.status !== 'ready' ? h('p', { className: 'dhb-desc' }, t('loading'))
        : data.files.length === 0 ? h('p', { className: 'dhb-desc' }, t('foEmpty'))
        : h('div', { className: 'dhb-list' },
            data.files.slice(0, groupLimit).map(function (file, fi) {
              return h('div', { className: 'dhb-card', key: file.path },
                h('div', { className: 'dhb-cardTitle', title: file.path }, file.path),
                h('div', { className: 'dhb-cardMeta' },
                  h('span', { style: { color: '#1e7e34' } }, '+' + file.totalAdded),
                  h('span', { style: { color: '#c0392b' } }, '−' + file.totalDeleted),
                  h('span', { className: 'dhb-hint' }, file.opsCount + ' ' + t('foOpsCount')
                    + (file.opsCount > file.ops.length ? ' · ' + t('foTruncated', { n: file.opsCount - file.ops.length }) : ''))),
                file.ops.map(function (op) {
                  return h('div', {
                    key: op.opId,
                    style: { display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0', fontSize: 12 },
                  },
                    h('span', { className: 'dhb-hint', style: { flex: 'none' } }, timeOf(op.time)),
                    h('span', {
                      className: 'dhb-badge',
                      style: { flex: 'none', color: op.kind === 'read' ? '#1e7e34' : op.kind === 'command' ? '#555' : op.kind === 'write' ? '#2f6fed' : undefined },
                    }, op.tool),
                    op.turn !== null ? h('span', { className: 'dhb-hint', style: { flex: 'none' } }, '#' + op.turn) : null,
                    op.kind === 'command'
                      ? h('span', { className: 'dhb-hint', style: { flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }, title: op.cwd !== undefined && op.cwd !== null ? op.cwd : '' },
                          op.cwd !== undefined && op.cwd !== null ? op.cwd.split('/').filter(Boolean).pop() : '')
                      : h('span', {
                          style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                          title: file.path,
                        }, file.path.split('/').filter(Boolean).slice(-2).join('/')),
                    op.kind === 'command'
                      ? h('span', { className: 'dhb-hint', style: { flex: 'none' } }, t('foRan'))
                      : h('span', { style: { flex: 'none', color: '#1e7e34' } }, '+' + op.added),
                    op.kind === 'command' ? null : h('span', { style: { flex: 'none', color: '#c0392b' } }, '−' + op.deleted),
                    op.failed === true ? h('span', { className: 'dhb-hint', style: { color: '#c0392b' } }, '⚠') : null,
                  )
                }),
              )
            }),
            data.files.length > groupLimit
              ? h('div', { style: { textAlign: 'center', padding: 6 } },
                  h('button', {
                    className: 'dhb-btn', type: 'button',
                    onClick: function () { setGroupLimit(groupLimit + 30) },
                  }, t('foMoreGroups', { n: data.files.length - groupLimit })),
                )
              : null,
          ),
      )
    }

    /** "2026-08-15T20:00:00+08:00" → locale-aware short form. */
    function shortTime(iso) {
      if (iso === '') return ''
      try {
        var d = new Date(iso)
        if (Number.isNaN(d.getTime())) return iso
        var two = function (v) { return (v < 10 ? '0' : '') + v }
        return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate())
          + ' ' + two(d.getHours()) + ':' + two(d.getMinutes())
      } catch (err) {
        return iso
      }
    }

    /** 行内时间：今天显示 "HH:MM"，否则 "MM-DD HH:MM"。 */
    function rowTime(iso) {
      if (typeof iso !== 'string' || iso === '') return ''
      try {
        var d = new Date(iso)
        if (Number.isNaN(d.getTime())) return ''
        var two = function (v) { return (v < 10 ? '0' : '') + v }
        var hm = two(d.getHours()) + ':' + two(d.getMinutes())
        var now = new Date()
        var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
        return sameDay ? hm : two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + hm
      } catch (err) {
        return ''
      }
    }

    /**
     * 「提交历史」tab：仓库提交记录，按 本地未推送 / 远程已推送 分段。
     * 数据来自宿主半 git log 折叠（/git/log）；点击一条提交展开其完整
     * diff（/git/commit-diff），渲染复用 buildDiffRows。与「工作区变更」
     * 互补：那边是磁盘对基线的差异，这边是已落库的提交流水。
     */
    function CommitHistoryView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      var sessionId = kit !== undefined ? kit.sessionId : undefined
      // hook 无条件调用（同 GitChangesView 的约定：条件 hook 是崩溃雷）
      var useSessionsHook = kit !== undefined && typeof kit.useSessions === 'function' ? kit.useSessions : function () { return '' }
      var row0 = useSessionsHook(function (s) {
        return sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
      })
      var cwd = row0 !== undefined && typeof row0.cwd === 'string' ? row0.cwd : ''

      var segState = React.useState('local')
      var seg = segState[0]
      var setSeg = segState[1]
      var limitState = React.useState(50)
      var limit = limitState[0]
      var setLimit = limitState[1]

      var dataState = React.useState({ status: 'idle', commits: [], total: 0, branch: '', upstream: null, hasRemote: true, error: '' })
      var data = dataState[0]
      var setData = dataState[1]

      // per-commit diff cache: { [hash]: { status, diff } }——与 GitChangesView
      // 的逐文件缓存同构（含收起/幽灵展开防护）。
      var diffState = React.useState({})
      var diffs = diffState[0]
      var setDiffs = diffState[1]

      var load = React.useCallback(function (dir, scope, lim) {
        if (dir === '') return
        setData(function (prev) { return Object.assign({}, prev, { status: 'loading', error: '' }) })
        api('/git/log?cwd=' + encodeURIComponent(dir) + '&scope=' + scope + '&limit=' + lim)
          .then(function (value) {
            // 新的一页到了——上一轮展开的 diff 全部过期，丢弃。
            setDiffs({})
            setData({
              status: 'ready',
              commits: value.commits === undefined ? [] : value.commits,
              total: typeof value.total === 'number' ? value.total : 0,
              branch: typeof value.branch === 'string' ? value.branch : '',
              upstream: typeof value.upstream === 'string' ? value.upstream : null,
              hasRemote: value.hasRemote === true,
              error: '',
            })
          })
          .catch(function (error) {
            setData(function (prev) {
              return Object.assign({}, prev, { status: 'error', error: String(error.message || error) })
            })
          })
      }, [])

      React.useEffect(function () {
        // cwd / 分段 / 页宽任一变化即重载（加载更多=增大 limit）。
        if (cwd !== '') load(cwd, seg, limit)
      }, [cwd, seg, limit, load])

      function switchSeg(next) {
        if (next === seg) return
        setDiffs({})
        // 切段重置页宽：新分段从第一页开始，不继承另一段的"加载更多"。
        if (limit !== 50) setLimit(50)
        setSeg(next)
      }

      function onToggleCommit(commit) {
        var hash = commit.hash
        var existing = diffs[hash]
        if (existing !== undefined) {
          var next = Object.assign({}, diffs)
          delete next[hash]
          setDiffs(next)
          return
        }
        if (cwd === '') return
        setDiffs(function (prev) {
          var copy = Object.assign({}, prev)
          copy[hash] = { status: 'loading', diff: '' }
          return copy
        })
        api('/git/commit-diff?cwd=' + encodeURIComponent(cwd) + '&ref=' + encodeURIComponent(hash))
          .then(function (value) {
            // 落地时校验仍是 loading 态：用户在途收起后此响应不得复活
            // 已收起的行（幽灵展开——与 GitChangesView 同一教训）。
            setDiffs(function (prev) {
              var cur = prev[hash]
              if (cur === undefined || cur.status !== 'loading') return prev
              var copy = Object.assign({}, prev)
              copy[hash] = { status: 'ready', diff: typeof value.diff === 'string' ? value.diff : '' }
              return copy
            })
          })
          .catch(function (error) {
            setDiffs(function (prev) {
              var copy = Object.assign({}, prev)
              copy[hash] = { status: 'error', diff: String(error.message || error) }
              return copy
            })
          })
      }

      var segItem = function (key, label) {
        return h('button', {
          className: 'dhb-tmTab', type: 'button',
          'data-active': seg === key ? '1' : '0',
          onClick: function () { switchSeg(key) },
        }, label)
      }

      var emptyText = seg === 'local' ? t('gcEmptyLocal') : t('gcEmptyRemote')

      return h('div', { className: 'dhb-gtPage' },
        h('div', { className: 'dhb-gtHead' },
          segItem('local', t('gcLocalSeg')),
          segItem('remote', t('gcRemoteSeg')),
          data.status === 'ready' && data.total > 0
            ? h('span', { className: 'dhb-gtMeta' }, t('gcCommitsCount', { n: data.total })) : null,
          data.branch !== '' ? h('span', { className: 'dhb-gtMeta', title: data.upstream !== null ? data.upstream : '' },
            t('gcBranchLabel', { branch: data.branch })
            + (data.upstream !== null ? ' → ' + data.upstream : '')) : null,
          h('button', { className: 'dhb-btn', type: 'button', disabled: cwd === '', onClick: function () { load(cwd, seg, limit) } }, t('refresh')),
        ),
        data.status === 'idle' && cwd === '' ? h('p', { className: 'dhb-desc' }, t('gitNoCwd'))
        : data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
        : data.status === 'error' ? h(Banner, { kind: 'err', text: data.error })
        : data.total === 0
          ? h('p', { className: 'dhb-desc' }, emptyText
              + (seg === 'remote' && data.hasRemote !== true ? ' ' + t('gcNoRemoteHint') : ''))
        : h('div', null,
            seg === 'local' && data.hasRemote !== true ? h('p', { className: 'dhb-hint', style: { margin: 0 } }, t('gcNoRemoteHint')) : null,
            h('div', { className: 'dhb-list' },
              data.commits.map(function (commit) {
                var slot = diffs[commit.hash]
                return h('div', { className: 'dhb-gtRow', key: commit.hash },
                  h('button', { className: 'dhb-gtFileBtn', type: 'button', onClick: function () { onToggleCommit(commit) } },
                    h('span', { className: 'dhb-gtHash', title: commit.hash }, commit.short),
                    h('span', { className: 'dhb-gtSubject', title: commit.subject }, commit.subject),
                    h('span', { className: 'dhb-gtAuthor', title: commit.author }, commit.author),
                    typeof commit.date === 'string' && commit.date !== ''
                      ? h('span', { className: 'dhb-gtTime', title: shortTime(commit.date) }, rowTime(commit.date))
                      : null,
                  ),
                  slot !== undefined
                    ? h('pre', { className: 'dhb-diff' },
                        slot.status === 'loading' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, t('loading'))
                        : slot.status === 'error' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, slot.diff)
                        : slot.diff === '' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, t('gitDiffEmpty'))
                        : buildDiffRows(slot.diff).map(function (row, idx) {
                            return h('span', { className: 'dhb-diffL', 'data-k': row.k, key: idx },
                              h('span', { className: 'dhb-diffN', style: { width: row.pad + 'ch' }, key: 'o' },
                                row.oldN === null ? '' : String(row.oldN)),
                              h('span', { className: 'dhb-diffN', style: { width: row.pad + 'ch' }, key: 'n' },
                                row.newN === null ? '' : String(row.newN)),
                              row.text,
                            )
                          }),
                      )
                    : null,
                )
              }),
            ),
            data.total > data.commits.length
              ? h('div', { style: { textAlign: 'center', padding: 6 } },
                  h('button', {
                    className: 'dhb-btn', type: 'button',
                    onClick: function () { setLimit(limit + 50) },
                  }, t('gcLoadMore', { n: data.total - data.commits.length })),
                )
              : null,
          ),
      )
    }

    /** 文件变更面板顶层：三 tab——「工作区变更」（git 基线差异）、「提交
     * 历史」（本地/远程提交记录）与「编辑记录」（AI 经 write/edit 工具
     * 的操作时间线）。 */
    function ChangesView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      var tabState = React.useState('git')
      var tab = tabState[0]
      var setTab = tabState[1]

      var tabItem = function (key, label) {
        return h('button', {
          className: 'dhb-toolsNavItem', type: 'button',
          'data-active': tab === key ? '1' : '0',
          onClick: function () { setTab(key) },
        }, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label))
      }

      // tab 行常驻、内容按 tab 切换——绝不能在 history 分支提前 return
      // 整个视图（那会让 tab 行消失、用户被困在编辑记录里无法返回）。
      return h('div', { className: 'dhb-page' },
        h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('foTabsLabel') },
          tabItem('git', t('foTabGit')),
          tabItem('commits', t('foTabCommits')),
          tabItem('history', t('foTabHistory')),
        ),
        tab === 'history'
          ? h(EditHistoryView, { t: t, kit: kit })
          : tab === 'commits'
            ? h(CommitHistoryView, { t: t, kit: kit })
            : h(GitChangesView, { t: t, kit: kit }),
      )
    }

    /** 原 ChangesView 的 git 视图（重命名保主体逻辑不动）。 */
    function GitChangesView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      // 经标准 sessions 钩子取会话 cwd（会话作用域槽位）。
      var sessionId = kit !== undefined ? kit.sessionId : undefined
      // hook 无条件调用（同 moremenu.js 的教训：条件 hook 是崩溃潜伏雷）
      var useSessionsHook = kit !== undefined && typeof kit.useSessions === 'function' ? kit.useSessions : function () { return '' }
      var row0 = useSessionsHook(function (s) {
        return sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
      })
      var cwd = row0 !== undefined && typeof row0.cwd === 'string' ? row0.cwd : ''

      var dataState = React.useState({ status: 'idle', entries: [], stats: null, lines: null, total: 0, lastCommitAt: '', root: '', baselineNote: false, error: '' })
      var data = dataState[0]
      var setData = dataState[1]

      // per-file diff cache: { [path]: { status, diff } }
      var diffState = React.useState({})
      var diffs = diffState[0]
      var setDiffs = diffState[1]

      // 文件过滤/排序控件（同一列表多次重载间保持状态）。
      var queryState = React.useState('')
      var query = queryState[0]
      var setQuery = queryState[1]
      // sort: { by, asc } where asc === null means "key natural default"
      // (kind/path → ascending, matching the original fixed ordering;
      // time/churn → descending: newest/biggest first). The toggle writes an
      // explicit direction that then sticks across key switches.
      var sortState = React.useState({ by: 'kind', asc: null })
      var sort = sortState[0]
      var setSort = sortState[1]

      var load = React.useCallback(function (dir) {
        if (dir === '') return
        setData(function (prev) { return Object.assign({}, prev, { status: 'loading', error: '' }) })
        api('/git/status?cwd=' + encodeURIComponent(dir))
          .then(function (value) {
            // 新的条目到了——上一轮缓存的逐文件 diff 已过期，丢弃它们，
            // 免得展开的行在刷新后还显示旧 diff。
            setDiffs({})
            setData({
              status: 'ready',
              entries: value.entries === undefined ? [] : value.entries,
              stats: value.stats === undefined ? null : value.stats,
              lines: value.lines === undefined ? null : value.lines,
              total: typeof value.total === 'number' ? value.total : 0,
              lastCommitAt: typeof value.lastCommitAt === 'string' ? value.lastCommitAt : '',
              root: typeof value.root === 'string' ? value.root : '',
              baselineNote: value.createdBaseline === true,
              error: '',
            })
          })
          .catch(function (error) {
            setData(function (prev) {
              return Object.assign({}, prev, { status: 'error', error: String(error.message || error) })
            })
          })
      }, [])

      React.useEffect(function () {
        // (Re)load whenever the session's workspace changes and is known.
        if (cwd !== '') load(cwd)
      }, [cwd, load])

      function onToggleFile(entry) {
        var existing = diffs[entry.path]
        if (existing !== undefined) {
          // collapse: drop the cached diff entry
          var next = Object.assign({}, diffs)
          delete next[entry.path]
          setDiffs(next)
          return
        }
        if (cwd === '') return
        setDiffs(function (prev) {
          var copy = Object.assign({}, prev)
          copy[entry.path] = { status: 'loading', diff: '' }
          return copy
        })
        api('/git/diff?cwd=' + encodeURIComponent(cwd) + '&file=' + encodeURIComponent(entry.path))
          .then(function (value) {
            // 落地时校验仍是 loading 态：用户在途收起（collapse 删除缓存
            // 项）后，此响应不得复活已收起的行（幽灵展开）。
            setDiffs(function (prev) {
              var cur = prev[entry.path]
              if (cur === undefined || cur.status !== 'loading') return prev // 已收起，丢弃
              var copy = Object.assign({}, prev)
              copy[entry.path] = { status: 'ready', diff: typeof value.diff === 'string' ? value.diff : '' }
              return copy
            })
          })
          .catch(function (error) {
            setDiffs(function (prev) {
              var copy = Object.assign({}, prev)
              copy[entry.path] = { status: 'error', diff: String(error.message || error) }
              return copy
            })
          })
      }

      var kindLabel = { new: 'gitKindNew', modified: 'gitKindModified', deleted: 'gitKindDeleted', renamed: 'gitKindRenamed' }
      var kindOrder = { new: 0, modified: 1, deleted: 2, renamed: 3 }

      /** 变更量 = 增行+删行（二进制 → -1：降序时排最后、永不排第一；
       * 空变更量回退按 mtime）。 */
      function entryChurn(entry) {
        if (entry.added === null || entry.deleted === null) return -1
        return (typeof entry.added === 'number' ? entry.added : 0)
          + (typeof entry.deleted === 'number' ? entry.deleted : 0)
      }

      function entryTime(entry) {
        if (typeof entry.mtime !== 'string' || entry.mtime === '') return 0
        var ms = Date.parse(entry.mtime)
        return Number.isNaN(ms) ? 0 : ms
      }

      // 过滤→排序流水线。搜索按路径子串收窄（不分大小写）；排序支持
      // 类型/路径/时间/变更量，路径与类型自然升序，时间/变更量默认降序
      // （最新/最大在前），方向按钮可手动切换。
      var needle = query.trim().toLowerCase()
      var searching = needle !== ''
      var filtered = searching
        ? data.entries.filter(function (e) { return String(e.path).toLowerCase().indexOf(needle) !== -1 })
        : data.entries
      var dir = sort.asc === null
        ? (sort.by === 'time' || sort.by === 'churn' ? -1 : 1)
        : (sort.asc ? 1 : -1)
      var sorted = filtered.slice().sort(function (a, b) {
        var r = 0
        if (sort.by === 'path') r = String(a.path).localeCompare(String(b.path))
        else if (sort.by === 'time') r = entryTime(a) - entryTime(b)
        else if (sort.by === 'churn') r = entryChurn(a) - entryChurn(b)
        else {
          var ka = kindOrder[a.kind] !== undefined ? kindOrder[a.kind] : 9
          var kb = kindOrder[b.kind] !== undefined ? kindOrder[b.kind] : 9
          r = ka !== kb ? ka - kb : String(a.path).localeCompare(String(b.path))
        }
        if (r !== 0) return r * dir
        return String(a.path).localeCompare(String(b.path))
      })

      return h('div', { className: 'dhb-gtPage' },
        h('div', { className: 'dhb-gtHead' },
          data.status === 'ready' && data.total > 0
            ? h('span', { className: 'dhb-gtMeta' },
                t('gitSummaryFiles', { n: data.total }),
                ' · ',
                data.lines !== null
                  ? t('gitSummaryLines', { add: data.lines.added, del: data.lines.deleted })
                    + (data.lines.binary > 0 ? ' · ' + t('gitSummaryBinary', { n: data.lines.binary }) : '')
                  : '',
              )
            : null,
          data.lastCommitAt !== ''
            ? h('span', { className: 'dhb-gtMeta', title: data.lastCommitAt }, t('gitLastCommit', { time: shortTime(data.lastCommitAt) }))
            : null,
          data.root !== '' ? h('span', { className: 'dhb-gtMeta', title: data.root }, t('gitRootLabel', { root: data.root })) : null,
          h('button', { className: 'dhb-btn', type: 'button', disabled: cwd === '', onClick: function () { load(cwd) } }, t('refresh')),
        ),
        data.baselineNote ? h(Banner, { kind: 'ok', text: t('gitBaselineCreated') }) : null,
        data.status === 'idle' && cwd === '' ? h('p', { className: 'dhb-desc' }, t('gitNoCwd'))
        : data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('gitInitializing'))
        : data.status === 'error' ? h(Banner, { kind: 'err', text: data.error })
        : data.entries.length === 0 ? h('p', { className: 'dhb-desc' }, t('gitNoChanges'))
        : h('div', null,
            h('div', { className: 'dhb-row', style: { marginBottom: 2 } },
              h('input', {
                className: 'dhb-input',
                type: 'search',
                style: { maxWidth: 220 },
                value: query,
                placeholder: t('gitSearchPlaceholder'),
                onChange: function (e) { setQuery(e.target.value) },
              }),
              h('label', { className: 'dhb-hint', style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
                t('gitSortLabel'),
                h('select', {
                  className: 'dhb-input',
                  style: { width: 'auto', flex: 'none', padding: '4px 8px' },
                  value: sort.by,
                  onChange: function (e) { setSort({ by: e.target.value, asc: null }) },
                },
                  h('option', { value: 'kind' }, t('gitSortKind')),
                  h('option', { value: 'path' }, t('gitSortPath')),
                  h('option', { value: 'time' }, t('gitSortTime')),
                  h('option', { value: 'churn' }, t('gitSortChanges')),
                ),
              ),
              h('button', {
                className: 'dhb-btn', type: 'button',
                title: t('gitSortAsc'),
                onClick: function () { setSort({ by: sort.by, asc: dir !== 1 }) },
              }, dir === 1 ? '↑' : '↓'),
            ),
            sorted.length === 0 ? h('p', { className: 'dhb-desc' }, t('gitNoMatch'))
            : h('div', { className: 'dhb-list' },
            sorted.map(function (entry) {
              var slot = diffs[entry.path]
              return h('div', { className: 'dhb-gtRow', key: entry.path },
                h('button', { className: 'dhb-gtFileBtn', type: 'button', onClick: function () { onToggleFile(entry) } },
                  h('span', { className: 'dhb-gtKind', 'data-kind': entry.kind }, t(kindLabel[entry.kind] !== undefined ? kindLabel[entry.kind] : 'gitKindModified')),
                  h('span', { className: 'dhb-gtPath', title: entry.path }, entry.path),
                  typeof entry.mtime === 'string' && entry.mtime !== ''
                    ? h('span', { className: 'dhb-gtTime', title: shortTime(entry.mtime) }, rowTime(entry.mtime))
                    : null,
                  entry.added === null && entry.deleted === null
                    ? h('span', { className: 'dhb-gtKind' }, t('gitBinaryFile'))
                    : h('span', { className: 'dhb-gtCounts' },
                        entry.added > 0 ? h('span', { className: 'dhb-gtAdd' }, t('gitLinesAdded', { n: entry.added })) : null,
                        entry.deleted > 0 ? h('span', { className: 'dhb-gtDel' }, t('gitLinesDeleted', { n: entry.deleted })) : null,
                      ),
                  entry.from !== null && entry.from !== undefined
                    ? h('span', { className: 'dhb-gtFrom', title: entry.from }, t('gitRenamedFrom', { from: entry.from }))
                    : null,
                ),
                slot !== undefined
                  ? h('pre', { className: 'dhb-diff' },
                      slot.status === 'loading' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, t('loading'))
                      : slot.status === 'error' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, slot.diff)
                      : slot.diff === '' ? h('span', { className: 'dhb-diffL', 'data-k': 'h' }, t('gitDiffEmpty'))
                      : buildDiffRows(slot.diff).map(function (row, idx) {
                          // 行号槽每行都渲染（缺失侧与头行留空）使文本列
                          // 对齐固定；行号是视觉导引，不可选中。
                          return h('span', { className: 'dhb-diffL', 'data-k': row.k, key: idx },
                            h('span', { className: 'dhb-diffN', style: { width: row.pad + 'ch' }, key: 'o' },
                              row.oldN === null ? '' : String(row.oldN)),
                            h('span', { className: 'dhb-diffN', style: { width: row.pad + 'ch' }, key: 'n' },
                              row.newN === null ? '' : String(row.newN)),
                            row.text,
                          )
                        }),
                    )
                  : null,
              )
            }),
            ),
          ),
      )
    }
