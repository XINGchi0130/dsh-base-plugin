// ══ sessions ══ 会话管理设置节 SessionsSection：全部会话清单、过滤片、破坏性删除。
    // ── 会话设置节（清单 + 破坏性删除）──────────────────────────────────

    /** 过滤键按显示顺序；文案经 t('sessFilter'+键名) 取。 */
    var SESS_FILTERS = ['all', 'live', 'archived', 'ghost']

    /** 行的显示名：投影标题，否则用「未命名」文案。 */
    function sessionDisplayName(item, t) {
      if (typeof item.title === 'string' && item.title !== '') return item.title
      return t('sessUntitled')
    }

    /**
     * 会话设置节：全部持久化会话（含归档集幽灵行）、过滤片与逐行的
     * 破坏性删除。活跃行禁用删除按钮（宿主本就会拒绝——先关闭会话）；
     * 幽灵行（无日志、非活跃）的删除是纯元数据清扫。
     */
    function SessionsSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', available: true, items: [], counts: null })
      var data = dataState[0]
      var setData = dataState[1]

      var filterState = React.useState('all')
      var filter = filterState[0]
      var setFilter = filterState[1]

      var queryState = React.useState('')
      var query = queryState[0]
      var setQuery = queryState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var busyState = React.useState(null) // session id currently deleting
      var busy = busyState[0]
      var setBusy = busyState[1]

      var refresh = React.useCallback(function () {
        api('/sessions').then(function (value) {
          setData({
            status: 'ready',
            available: value !== null && typeof value === 'object' && value.available !== null && typeof value.available === 'object' && value.available.persistence === true,
            items: value !== null && typeof value === 'object' && Array.isArray(value.items) ? value.items : [],
            counts: value !== null && typeof value === 'object' && value.counts !== null && typeof value.counts === 'object' ? value.counts : null,
          })
        }).catch(function (error) {
          setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      function onDelete(item) {
        if (busy !== null) return
        showConfirm(t('confirmDeleteSession', { name: sessionDisplayName(item, t) }), { okLabel: t('sessDelete'), danger: true })
          .then(function (ok) {
            if (!ok) return
            setMsg(null)
            setBusy(item.id)
            post('/sessions/delete', { sessionId: item.id })
              .then(function () {
                setMsg({ kind: 'ok', text: t('sessDeleted', { id: item.id }) })
              })
              .catch(function (error) {
                setMsg({ kind: 'err', text: String(error.message || error) })
              })
              .then(function () {
                setBusy(null)
                refresh()
              })
          })
      }

      if (data.status === 'ready' && data.available !== true) {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionSessions')),
          h('p', { className: 'dhb-desc' }, t('sessUnavailable')),
        )
      }

      var visible = data.items
      if (filter === 'live') visible = visible.filter(function (s) { return s.live === true })
      else if (filter === 'archived') visible = visible.filter(function (s) { return s.archived === true })
      else if (filter === 'ghost') visible = visible.filter(function (s) { return s.hasLog !== true && s.live !== true })

      // 搜索在当前过滤片内收窄：对标题、id、cwd（用户可见的三字段）
      // 做不区分大小写的子串匹配。
      var needle = query.trim().toLowerCase()
      var searching = needle !== ''
      if (searching) {
        visible = visible.filter(function (s) {
          return (typeof s.title === 'string' && s.title.toLowerCase().indexOf(needle) !== -1)
            || (typeof s.id === 'string' && s.id.toLowerCase().indexOf(needle) !== -1)
            || (typeof s.cwd === 'string' && s.cwd.toLowerCase().indexOf(needle) !== -1)
        })
      }

      function filterCount(key) {
        if (data.counts === null) return ''
        if (key === 'all') return data.counts.total
        if (key === 'live') return data.counts.live
        if (key === 'archived') return data.counts.archived
        return data.counts.ghosts
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionSessions')),
        h('p', { className: 'dhb-desc' }, t('sessionsIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        h('div', { className: 'dhb-row' },
          h('input', {
            className: 'dhb-input',
            type: 'search',
            value: query,
            placeholder: t('sessSearchPlaceholder'),
            onChange: function (e) { setQuery(e.target.value) },
          }),
        ),
        h('div', { className: 'dhb-row' },
          SESS_FILTERS.map(function (key) {
            var labelKey = 'sessFilter' + key.charAt(0).toUpperCase() + key.slice(1)
            return h('button', {
              key: key,
              type: 'button',
              className: 'dhb-btn' + (filter === key ? ' dhb-btnPrimary' : ''),
              onClick: function () { setFilter(key) },
            }, t(labelKey) + ' (' + filterCount(key) + ')')
          }),
          h('button', { className: 'dhb-btn', type: 'button', onClick: refresh }, t('refresh')),
        ),
        h('div', { className: 'dhb-list' },
          data.status === 'idle' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : data.status === 'error' ? h(Banner, { kind: 'err', text: msg !== null ? msg.text : t('errorTitle') })
          : visible.length === 0 ? h('p', { className: 'dhb-desc' }, searching ? t('sessNoMatch') : t('noSessions'))
          : visible.map(function (item) {
            return h('div', { className: 'dhb-card', key: item.id },
              h('div', { className: 'dhb-cardTitle' }, sessionDisplayName(item, t)),
              h('div', { className: 'dhb-cardMeta' },
                typeof item.title !== 'string' || item.title === '' ? h('span', { className: 'dhb-badge', 'data-phase': 'pending' }, t('badgeDraft')) : null,
                item.live === true ? h('span', { className: 'dhb-badge', 'data-kind': 'ok' }, t('badgeLive')) : null,
                item.archived === true ? h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('badgeArchived')) : null,
                item.live === true && item.archived === true ? h('span', { className: 'dhb-badge', 'data-phase': 'pending' }, t('sessArchivedLiveBadge')) : null,
                item.hasLog !== true && item.live !== true ? h('span', { className: 'dhb-badge', 'data-kind': 'failed' }, t('badgeGhost')) : null,
                typeof item.cwd === 'string' && item.cwd !== '' ? h('span', null, item.cwd) : null,
                item.workspace !== null && typeof item.workspace.title === 'string' ? h('span', null, '· ' + item.workspace.title) : null,
                typeof item.createdAt === 'number' && item.createdAt > 0 ? h('span', null, new Date(item.createdAt).toLocaleString()) : null,
              ),
              (typeof item.title !== 'string' || item.title === '')
                ? h('p', { className: 'dhb-hint', style: { margin: 0 } }, t('draftHint'))
                : null,
              item.live === true && item.archived === true
                ? h('p', { className: 'dhb-hint', style: { margin: 0 } }, t('sessArchivedLiveHint'))
                : null,
              h('div', { className: 'dhb-hint', style: { wordBreak: 'break-all' } }, item.id),
              h('div', { className: 'dhb-cardActions' },
                // 导出：MD（宿主折叠的可读转写）与 Zip（官方全量端点）。
                // window.open 触发浏览器原生下载；官方端点在无会话时自答错误页。
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  title: t('sessExportMdHint'),
                  onClick: function () {
                    window.open('/dsh-base-plugin/api/export/markdown?sessionId=' + encodeURIComponent(item.id), '_blank')
                  },
                }, t('sessExportMd')),
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  title: t('sessExportZipHint'),
                  onClick: function () {
                    window.open('/api/session.export?sessionId=' + encodeURIComponent(item.id), '_blank')
                  },
                }, t('sessExportZip')),
                h('button', {
                  className: 'dhb-btn dhb-btnDanger',
                  type: 'button',
                  disabled: busy !== null || item.live === true,
                  title: item.live === true
                    ? (item.archived === true ? t('sessArchivedLiveHint') : t('sessLiveHint'))
                    : undefined,
                  onClick: function () { onDelete(item) },
                }, busy === item.id ? t('sessDeleting') : t('sessDelete')),
              ),
            )
          }),
        ),
      )
    }
