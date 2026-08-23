// ══ market ══ 插件市场标签页 MarketTab：GitHub 认证集搜索、一键安装/卸载、已安装徽章。
    // ── 插件市场标签页 ────────────────────────────────────────────────────

    function MarketTab(props) {
      var t = props.t
      useLocaleVersion()

      var queryState = React.useState('')
      var query = queryState[0]
      var setQuery = queryState[1]

      var sortState = React.useState('default')
      var sort = sortState[0]
      var setSort = sortState[1]

      var dataState = React.useState({ status: 'idle', items: [], total: 0, cached: false, plugins: [], busy: null })
      var data = dataState[0]
      var setData = dataState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var busyState = React.useState(null) // {kind:'install'|'uninstall', name}
      var busy = busyState[0]
      var setBusy = busyState[1]

      var searchGen = React.useRef(0)

      // 星标/更新时间/名称的本地排序——即使旧宿主半忽略 sort 参数、
      // 返回默认排序也以本地为准。`default` 保持宿主的生态层级序。
      function sortLocally(items, mode) {
        var copy = items.slice()
        if (mode === 'stars') copy.sort(function (a, b) { return b.stars - a.stars })
        else if (mode === 'updated') copy.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)) })
        else if (mode === 'name') copy.sort(function (a, b) { return String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()) })
        return copy
      }

      var runSearch = React.useCallback(function (q, mode) {
        var gen = searchGen.current = searchGen.current + 1
        setData(function (prev) { return Object.assign({}, prev, { status: 'loading' }) })
        api('/market?q=' + encodeURIComponent(q) + '&sort=' + encodeURIComponent(mode))
          .then(function (value) {
            if (gen !== searchGen.current) return
            setData(function (prev) {
              return Object.assign({}, prev, { status: 'ready', items: sortLocally(value.items, mode), total: value.total, cached: value.cached === true })
            })
          })
          .catch(function (error) {
            if (gen !== searchGen.current) return
            setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
      }, [])

      var refreshState = React.useCallback(function () {
        api('/state').then(function (value) {
          setData(function (prev) {
            return Object.assign({}, prev, { plugins: value.plugins ?? [], busy: value.busy === true })
          })
        }).catch(function () { /* banner already covers market errors */ })
      }, [])

      React.useEffect(function () {
        runSearch('', 'default')
        refreshState()
      }, [runSearch, refreshState])

      function onSearchClick() {
        setMsg(null)
        runSearch(query, sort)
      }

      function onSortChange(next) {
        setSort(next)
        setMsg(null)
        runSearch(query, next)
      }

      function onInstall(spec, name) {
        if (busy !== null) return
        setBusy({ kind: 'install', name: name })
        setMsg(null)
        post('/install', { spec: spec })
          .then(function (value) {
            setMsg({ kind: 'ok', text: t('installDone', { name: value.name, rows: value.rows }) })
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
          .then(function () {
            setBusy(null)
            refreshState()
          })
      }

      function onUninstall(name) {
        if (busy !== null) return
        setBusy({ kind: 'uninstall', name: name })
        setMsg(null)
        showConfirm(t('confirmUninstall', { name: name }), { okLabel: t('uninstall'), danger: true })
          .then(function (ok) {
            if (!ok) { setBusy(null); return }
            post('/uninstall', { name: name })
              .then(function () {
                setMsg({ kind: 'ok', text: t('uninstallDone', { name: name }) })
              })
              .catch(function (error) {
                setMsg({ kind: 'err', text: String(error.message || error) })
              })
              .then(function () {
                setBusy(null)
                refreshState()
              })
          })
      }

      var managedNames = {}
      data.plugins.forEach(function (p) { managedNames[p.name] = true })

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('tabMarket')),
        h('p', { className: 'dhb-desc' }, t('marketIntro')),
        h('div', { className: 'dhb-row' },
          h('input', {
            className: 'dhb-input',
            value: query,
            placeholder: t('searchPlaceholder'),
            onChange: function (e) { setQuery(e.target.value) },
            onKeyDown: function (e) { if (e.key === 'Enter' && !isComposing(e)) onSearchClick() },
          }),
          h('label', { className: 'dhb-row', style: { flex: 'none', gap: '4px' } },
            h('span', { className: 'dhb-hint' }, t('sortLabel')),
            h('select', {
              className: 'dhb-input',
              style: { flex: 'none', width: 'auto' },
              value: sort,
              onChange: function (e) { onSortChange(e.target.value) },
            },
              h('option', { value: 'default' }, t('sortDefault')),
              h('option', { value: 'stars' }, t('sortStars')),
              h('option', { value: 'updated' }, t('sortUpdated')),
              h('option', { value: 'name' }, t('sortName')),
            ),
          ),
          h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', onClick: onSearchClick }, t('search')),
          h('button', {
            className: 'dhb-btn', type: 'button',
            onClick: function () { setMsg(null); runSearch(query, sort); refreshState() },
          }, t('refresh')),
        ),
        h('p', { className: 'dhb-hint' }, t('searchHint') + (data.cached ? t('cachedHint') : '')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        data.plugins.length > 0
          ? h('div', { className: 'dhb-list' },
              h('h3', { className: 'dhb-sectTitle' }, t('managedTitle') + ' (' + data.plugins.length + ')'),
              data.plugins.map(function (p) {
                var isSelf = p.name === 'dsh-base-plugin'
                var itemBusy = busy !== null && busy.name === p.name
                return h('div', { className: 'dhb-card', key: 'managed-' + p.name },
                  h('div', { className: 'dhb-cardTitle' }, p.name),
                  h('div', { className: 'dhb-cardActions' },
                    isSelf
                      ? h('span', { className: 'dhb-hint' }, t('selfManaged'))
                      : h('button', {
                          className: 'dhb-btn dhb-btnDanger', type: 'button',
                          disabled: busy !== null,
                          onClick: function () { onUninstall(p.name) },
                        }, itemBusy && busy.kind === 'uninstall' ? t('uninstalling') : t('uninstall')),
                  ),
                )
              }),
            )
          : h('p', { className: 'dhb-hint' }, t('noManaged')),
        h('div', { className: 'dhb-list' },
          data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : data.status === 'ready' && data.items.length === 0 ? h('p', { className: 'dhb-desc' }, t('noResults'))
          : data.items.map(function (item) {
            var isInstalled = item.installed === true
            var isManaged = managedNames[item.name] === true
            var isSelf = item.name === 'dsh-base-plugin'
            var itemBusy = busy !== null && busy.name === item.name
            return h('div', { className: 'dhb-card', key: item.fullName },
              h('div', { className: 'dhb-cardTitle' },
                item.name,
                item.match === 'topic' ? h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('topicVerified')) : null,
                isInstalled ? h('span', { className: 'dhb-badge', 'data-kind': 'installed' }, t('installed')) : null,
                isManaged ? h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('managedTitle')) : null,
              ),
              item.description !== '' ? h('div', { className: 'dhb-cardDesc' }, item.description) : null,
              h('div', { className: 'dhb-cardMeta' },
                h('span', null, '★ ' + String(item.stars) + ' ' + t('stars')),
                item.updatedAt !== '' ? h('span', null, t('updated', { date: String(item.updatedAt).slice(0, 10) })) : null,
                h('a', { className: 'dhb-link', href: item.htmlUrl, target: '_blank', rel: 'noreferrer' }, t('viewOnGithub')),
              ),
              h('div', { className: 'dhb-cardActions' },
                isInstalled
                  ? (isSelf
                      ? h('span', { className: 'dhb-hint' }, t('selfManaged'))
                      : h('button', {
                          className: 'dhb-btn dhb-btnDanger', type: 'button',
                          disabled: busy !== null || !isManaged,
                          title: isManaged ? undefined : t('handAdded'),
                          onClick: function () { onUninstall(item.name) },
                        }, itemBusy && busy.kind === 'uninstall' ? t('uninstalling') : t('uninstall')))
                  : h('button', {
                      className: 'dhb-btn dhb-btnPrimary', type: 'button',
                      disabled: busy !== null,
                      onClick: function () { onInstall(item.installSpec, item.name) },
                    }, itemBusy && busy.kind === 'install' ? t('installing') : t('install')),
              ),
            )
          }),
        ),
        h('p', { className: 'dhb-hint' }, t('restartHint')),
      )
    }
