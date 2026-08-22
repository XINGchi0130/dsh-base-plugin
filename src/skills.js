// ══ skills ══ 技能设置节 SkillsSection：列表、内容查看、~/.dsh/skills 下技能的新建/编辑/删除。
    // ── 技能设置节 ────────────────────────────────────────────────────────

    function SkillsSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', available: true, skills: [], hiddenCount: 0, canCreate: false })
      var data = dataState[0]
      var setData = dataState[1]

      var detailState = React.useState(null) // { name, status, detail }
      var detail = detailState[0]
      var setDetail = detailState[1]

      // editor: null when closed; { mode, name, description, content, saving }
      var editorState = React.useState(null)
      var editor = editorState[0]
      var setEditor = editorState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var refresh = React.useCallback(function () {
        api('/skills').then(function (value) {
          setData({
            status: 'ready',
            available: value.available === true,
            skills: value.skills,
            hiddenCount: typeof value.hiddenCount === 'number' ? value.hiddenCount : 0,
            canCreate: value.canCreate === true,
          })
        }).catch(function (error) {
          setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      function patchEditor(patch) {
        setEditor(function (prev) { return prev === null ? prev : Object.assign({}, prev, patch) })
      }

      function onOpenCreate() {
        setDetail(null)
        setMsg(null)
        setEditor({ mode: 'create', name: '', description: '', content: '', saving: false })
      }

      function onOpenEdit(skill) {
        setDetail(null)
        setMsg(null)
        setEditor({ mode: 'edit', name: skill.name, description: skill.description, content: '', saving: true })
        api('/skills/detail?name=' + encodeURIComponent(skill.name))
          .then(function (value) {
            if (value === null || value === undefined) throw new Error(t('notFoundFull', { name: skill.name }))
            setEditor({ mode: 'edit', name: skill.name, description: value.description, content: value.content, saving: false })
          })
          .catch(function (error) {
            setEditor(null)
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
      }

      function onSaveSkill() {
        if (editor === null || editor.saving) return
        patchEditor({ saving: true })
        setMsg(null)
        post('/skills/save', {
          name: editor.name,
          description: editor.description,
          content: editor.content,
          existing: editor.mode === 'edit',
        })
          .then(function (value) {
            setMsg({ kind: 'ok', text: value.created === true ? t('skillCreated', { name: value.name }) : t('skillUpdated', { name: value.name }) })
            setEditor(null)
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
          .then(function () {
            if (editor !== null) patchEditor({ saving: false })
            refresh()
          })
      }

      function onDeleteSkill(skill) {
        showConfirm(t('confirmDeleteSkill', { name: skill.name }), { okLabel: t('deleteSkill'), danger: true })
          .then(function (ok) {
            if (!ok) return
            setMsg(null)
            post('/skills/delete', { name: skill.name })
              .then(function () {
                setMsg({ kind: 'ok', text: t('skillDeleted', { name: skill.name }) })
                if (detail !== null && detail.name === skill.name) setDetail(null)
              })
              .catch(function (error) {
                setMsg({ kind: 'err', text: String(error.message || error) })
              })
              .then(function () { refresh() })
          })
      }

      function onOpen(skill) {
        setDetail({ name: skill.name, status: 'loading', detail: null })
        api('/skills/detail?name=' + encodeURIComponent(skill.name))
          .then(function (value) {
            if (value === null || value === undefined) {
              setDetail({ name: skill.name, status: 'missing', detail: null })
              return
            }
            setDetail({ name: skill.name, status: 'ready', detail: value })
          })
          .catch(function (error) {
            setDetail({ name: skill.name, status: 'error', error: String(error.message || error) })
          })
      }

      if (data.status === 'ready' && data.available !== true) {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionSkills')),
          h('p', { className: 'dhb-desc' }, t('skillUnavailable')),
        )
      }

      if (detail !== null && detail.name !== null) {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionSkills')),
          h('div', { className: 'dhb-row' },
            h('button', { className: 'dhb-btn', type: 'button', onClick: function () { setDetail(null) } }, t('back')),
            h('span', { className: 'dhb-skillName' }, detail.name),
          ),
          detail.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : detail.status === 'missing' ? h(Banner, { kind: 'warn', text: t('notFoundFull', { name: detail.name }) })
          : detail.status === 'error' ? h(Banner, { kind: 'err', text: detail.error })
          : h('div', { className: 'dhb-field' },
              h('span', { className: 'dhb-label' }, t('contentLabel')),
              h('pre', { className: 'dhb-pre' }, detail.detail.content),
              detail.detail.path.indexOf('/skills/') !== -1 && data.skills.some(function (s) { return s.name === detail.name && s.writable })
                ? h('div', { className: 'dhb-row' },
                    h('button', { className: 'dhb-btn', type: 'button', onClick: function () {
                      onOpenEdit({ name: detail.name, description: detail.detail.description })
                    } }, t('editSkill')),
                  )
                : null,
            ),
        )
      }

      if (editor !== null) {
        var editing = editor.mode === 'edit'
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionSkills')),
          h('div', { className: 'dhb-form' },
            h('div', { className: 'dhb-formTitle' }, t(editing ? 'editSkill' : 'createSkill')),
            h('div', { className: 'dhb-field' },
              h('span', { className: 'dhb-label' }, t('skillNameLabel')),
              h('input', {
                className: 'dhb-input',
                value: editor.name,
                disabled: editing,
                placeholder: 'my-deploy-flow',
                onChange: function (e) { patchEditor({ name: e.target.value }) },
              }),
              h('span', { className: 'dhb-hint' }, t('skillNameHint')),
            ),
            h('div', { className: 'dhb-field' },
              h('span', { className: 'dhb-label' }, t('skillDescLabel')),
              h('input', {
                className: 'dhb-input',
                value: editor.description,
                onChange: function (e) { patchEditor({ description: e.target.value }) },
              }),
              h('span', { className: 'dhb-hint' }, t('skillDescHint')),
            ),
            h('div', { className: 'dhb-field' },
              h('span', { className: 'dhb-label' }, t('skillContentLabel')),
              h('textarea', {
                className: 'dhb-textarea',
                value: editor.content,
                disabled: editor.saving && editing,
                style: { minHeight: '220px' },
                spellCheck: false,
                onChange: function (e) { patchEditor({ content: e.target.value }) },
              }),
            ),
            h('div', { className: 'dhb-row' },
              h('button', {
                className: 'dhb-btn dhb-btnPrimary', type: 'button',
                disabled: editor.saving, onClick: onSaveSkill,
              }, editor.saving ? t('loading') : t('save')),
              h('button', { className: 'dhb-btn', type: 'button', onClick: function () { setEditor(null) } }, t('cancel')),
            ),
          ),
          msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        )
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionSkills')),
        h('p', { className: 'dhb-desc' }, t('skillsIntro')),
        data.status === 'ready' && data.hiddenCount > 0
          ? h('p', { className: 'dhb-hint' }, t('builtinHidden', { n: data.hiddenCount }))
          : null,
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        data.status === 'ready' && data.canCreate !== true
          ? h(Banner, { kind: 'warn', text: t('skillsNeedRestart') })
          : null,
        h('div', { className: 'dhb-row' },
          data.canCreate
            ? h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', onClick: onOpenCreate }, t('createSkill'))
            : null,
          h('button', { className: 'dhb-btn', type: 'button', onClick: refresh }, t('refresh')),
        ),
        h('div', { className: 'dhb-list' },
          data.status === 'idle' || data.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
          : data.status === 'error' ? h(Banner, { kind: 'err', text: msg !== null ? msg.text : t('errorTitle') })
          : data.skills.length === 0 ? h('p', { className: 'dhb-desc' }, t('noSkills'))
          : data.skills.map(function (skill) {
            return h('div', { className: 'dhb-card', key: skill.name },
              h('button', {
                className: 'dhb-skillRow', type: 'button',
                style: { border: 'none', background: 'transparent', padding: '0' },
                onClick: function () { onOpen(skill) },
              },
                h('span', { className: 'dhb-skillName' }, skill.name),
                h('span', { className: 'dhb-hint', style: { display: 'block' } }, skill.description),
                h('span', { className: 'dhb-hint', style: { display: 'block' } }, t('providerLabel') + ': ' + skill.provider),
              ),
              skill.writable === true
                ? h('div', { className: 'dhb-cardActions' },
                    h('button', { className: 'dhb-btn', type: 'button', onClick: function () { onOpenEdit(skill) } }, t('editSkill')),
                    h('button', { className: 'dhb-btn dhb-btnDanger', type: 'button', onClick: function () { onDeleteSkill(skill) } }, t('deleteSkill')),
                  )
                : null,
            )
          }),
        ),
      )
    }
