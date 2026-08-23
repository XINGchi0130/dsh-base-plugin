// ══ mcp ══ MCP 设置节 McpSection：服务器 YAML 直接编辑、实时状态。
    // ── MCP 设置节 ────────────────────────────────────────────────────────

    function McpSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', servers: [], mcpYaml: null })
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

      // 健康面板：每服务器 调用/失败率/平均延迟/最近使用 + 工具明细
      var healthState = React.useState({ status: 'idle', servers: [] })
      var health = healthState[0]
      var setHealth = healthState[1]

      var refresh = React.useCallback(function () {
        api('/mcp/health')
          .then(function (value) { setHealth({ status: 'ready', servers: value.servers ?? [] }) })
          .catch(function () { setHealth({ status: 'error', servers: [] }) })
        api('/state').then(function (value) {
          var yamlText = typeof value.mcpYaml === 'string' ? value.mcpYaml : null
          setData(function (prev) { return { status: 'ready', servers: value.mcpServers ?? [], mcpYaml: yamlText } })
          if (yamlText !== null) {
            setEditor(function (prev) { return prev.dirty ? prev : { text: yamlText, dirty: false } })
          }
        }).catch(function (error) {
          setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      var canEdit = data.mcpYaml !== null

      function onSave() {
        if (saving) return
        setSaving(true)
        setMsg(null)
        post('/mcp/save', { yaml: editor.text })
          .then(function (value) {
            setMsg({ kind: 'ok', text: t('mcpSaved', { n: value.count }) })
            setEditor(function (prev) { return { text: prev.text, dirty: false } })
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
          .then(function () {
            setSaving(false)
            refresh()
          })
      }

      function onRevert() {
        setEditor({ text: data.mcpYaml, dirty: false })
        setMsg(null)
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionMcp')),
        h('p', { className: 'dhb-desc' }, t('mcpIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        canEdit ? null : h(Banner, { kind: 'warn', text: t('needRestart') }),
        h('div', { className: 'dhb-list' },
          data.status === 'idle' || data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : data.servers.length === 0 ? h('p', { className: 'dhb-desc' }, t('noServers'))
          : data.servers.map(function (server) {
            return h('div', { className: 'dhb-card', key: server.serverName },
              h('div', { className: 'dhb-cardTitle' },
                server.serverName,
                h('span', { className: 'dhb-badge', 'data-phase': server.phase }, phaseLabel(t, server.phase)),
                server.managed ? h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('managedBadge')) : null,
              ),
              h('div', { className: 'dhb-cardMeta' },
                h('span', null, server.transport),
                server.command !== undefined ? h('span', null, t('targetLabel') + ': ' + server.command + (server.args ? ' ' + server.args.join(' ') : '')) : null,
                server.url !== undefined ? h('span', null, t('targetLabel') + ': ' + server.url) : null,
                h('span', null, t('toolsCount', { n: server.tools })),
                server.managed !== true ? h('span', { className: 'dhb-hint' }, t('handAdded')) : null,
              ),
            )
          }),
        ),
        // 健康面板：全部会话日志按服务器聚合的用量/失败/延迟
        h('div', { className: 'dhb-list' },
          h('h3', { className: 'dhb-sectTitle' }, t('mcpHealthTitle')),
          health.status === 'error' ? h(Banner, { kind: 'warn', text: t('mcpHealthUnavailable') }) : null,
          health.status === 'ready' && health.servers.length === 0
            ? h('p', { className: 'dhb-hint' }, t('mcpHealthEmpty'))
            : health.servers.map(function (row) {
                var failColor = row.errorRate >= 30 ? '#c0392b' : row.errorRate >= 10 ? '#d68910' : null
                return h('div', { className: 'dhb-card', key: row.server },
                  h('div', { className: 'dhb-cardTitle' }, row.server,
                    h('span', { className: 'dhb-badge', 'data-kind': 'managed' }, t('mcpCalls', { n: row.calls }))),
                  h('div', { className: 'dhb-cardMeta' },
                    h('span', null, t('mcpErrorRate') + ' ',
                      h('span', { style: failColor !== null ? { color: failColor, fontWeight: 600 } : undefined }, row.errorRate + '%')),
                    h('span', null, t('mcpAvgLatency') + ' ' + (row.avgLatencyMs !== null ? row.avgLatencyMs + 'ms' : '—')),
                    row.lastUsedAt > 0 ? h('span', null, t('mcpLastUsed') + ' ' + new Date(row.lastUsedAt).toLocaleString()) : null),
                  Array.isArray(row.tools) && row.tools.length > 0
                    ? h('p', { className: 'dhb-hint', style: { margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                        row.tools.map(function (tool) { return tool.tool + '×' + tool.calls }).join(' · '))
                    : null,
                )
              }),
          h('p', { className: 'dhb-hint' }, t('mcpHealthNote')),
        ),
        canEdit
          ? h('div', { className: 'dhb-form' },
              h('div', { className: 'dhb-formTitle' }, t('mcpEditorTitle') + (editor.dirty ? ' · ' + t('unsaved') : '')),
              h('span', { className: 'dhb-hint' }, t('editorHint')),
              h('textarea', {
                className: 'dhb-textarea',
                value: editor.text,
                style: { minHeight: '180px' },
                spellCheck: false,
                onChange: function (e) { setEditor({ text: e.target.value, dirty: true }) },
              }),
              h('div', { className: 'dhb-row' },
                h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', disabled: saving, onClick: onSave },
                  saving ? t('saving') : t('save')),
                h('button', { className: 'dhb-btn', type: 'button', disabled: !editor.dirty || saving, onClick: onRevert }, t('revert')),
                h('button', { className: 'dhb-btn', type: 'button', onClick: refresh }, t('refresh')),
              ),
            )
          : null,
      )
    }
