/**
 * dsh-base-plugin — browser bundle.
 *
 * Hand-written in the web boot protocol format (no build step): registers a
 * factory with window.__ModuleLoader__ whose module exports are a cordis
 * plugin. React resolves through the loader module table.
 *
 * Contributions (all text ZH/EN through the DSH locale service — the
 * language follows the setting in Settings):
 *
 * 1. `settings.plugins.tab` entry id `market` — the Plugin Market tab
 *    inside the Plugins settings section (GitHub search + one-click
 *    install/uninstall through the host half's HTTP API).
 * 2. `settings.section` entry id `dsh-base-plugin-mcp` — the MCP settings page
 *    (live status + direct YAML config editing; saves hot-load).
 * 3. `settings.section` entry id `dsh-base-plugin-skills` — the Skills page
 *    (list + content viewer; `~/.dsh/skills` entries editable/creatable).
 * 4. `settings.section` entry id `dsh-base-plugin-prompt` — the global System
 *    Prompt page (persona override; saves hot-load, empty restores default).
 * 5. `sidebar.footer.action` entry id `dsh-base-plugin-service` — Stop /
 *    Restart buttons beside Settings (host exits gracefully; restart
 *    re-execs the same invocation and this page reloads itself once back,
 *    with a `shell.overlay` status card while in flight).
 * 6. `conversation.session.header.utilities` entry id
 *    `dsh-base-plugin-session-more` + `shell.overlay` entry id
 *    `dsh-base-plugin-tools` — the header ⋯ menu hosts the File Changes
 *    (read-only git view; auto-initializes the workspace repo with a
 *    baseline commit on first open) and Terminal (multiple PTYs per session
 *    through the official `terminals` service) panels as right-docked
 *    overlays instead of conversation tabs; each menu entry appears only
 *    when its host capability probe passes (git binary / mounted terminals
 *    service), and the whole button hides while neither is available. The
 *    tool surface is a TRUE right dock: while open, the shell frame is
 *    squeezed by the panel width (inline margin on the frame element found
 *    via the stable `[data-shell-overlay]` anchor), so the chat column
 *    genuinely narrows instead of being covered — the fixed-position panel
 *    occupies the freed strip. A drag handle on its left edge, an inner
 *    sidebar — breadcrumb (session title › active panel) over the tool nav
 *    list — and switching panels in place.
 *
 * Single file BY PROTOCOL CONSTRAINT, not by choice: the web boot loader
 * materializes exactly one factory per package (no bundler, no relative
 * imports — `require` reaches only the platform module table), so this file
 * is organized with section banners instead of modules. Section order:
 * i18n dictionaries → store/api/styles helpers → MarketTab → McpSection →
 * SkillsSection → plugin apply.
 */
window.__ModuleLoader__.load({
  id: 'dsh-base-plugin',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    // ── i18n dictionaries ─────────────────────────────────────────────────

    var ZH = {
      tabMarket: '插件市场',
      sectionMcp: 'MCP',
      sectionSkills: '技能',
      sectionPrompt: '系统提示词',
      loading: '加载中…',
      refresh: '刷新',
      errorTitle: '出错',
      searchPlaceholder: '搜索 GitHub 上的 dsh 插件（关键词）',
      search: '搜索',
      sortLabel: '排序',
      sortDefault: '综合（dsh 优先）',
      sortStars: '星标最多',
      sortUpdated: '最近更新',
      sortName: '名称',
      searchHint: '数据来自 GitHub Search API（名称含 dsh 的仓库）。限流时可设置 GITHUB_TOKEN 环境变量并重启 dsh。',
      cachedHint: '（5 分钟缓存）',
      stars: '星',
      updated: '更新于 {date}',
      install: '安装',
      installing: '安装中…',
      installed: '已安装',
      uninstall: '卸载',
      uninstalling: '卸载中…',
      confirmUninstall: '确定卸载 {name}？将移除其组合行并从 profile 移除依赖。',
      opRunning: '有操作正在进行：{op}',
      installDone: '已安装 {name}（{rows} 个组合行）。通过 home 补丁热加载；界面未变化时请刷新页面或重启 dsh。',
      uninstallDone: '已卸载 {name}。若界面仍显示，请刷新页面。',
      warning: '警告',
      noResults: '没有找到匹配的仓库。',
      managedTitle: '通过 dsh-base-plugin 安装',
      noManaged: '还没有通过 dsh-base-plugin 安装插件；在市场安装后会出现在这里。',
      selfManaged: 'dsh-base-plugin 本体请手动卸载（编辑 ~/.dsh/cordis.patch.yml 并在 profile 执行 pnpm remove dsh-base-plugin）。',
      restartHint: '安装/卸载即时写入 ~/.dsh/cordis.patch.yml 并热加载；未生效时刷新页面或重启 dsh。',
      viewOnGithub: 'GitHub',
      marketIntro: '搜索并一键安装 GitHub 上的 DeepSeek Harness（dsh）插件。',

      mcpIntro: '直接编辑 MCP 服务器配置（YAML）：保存即写入 ~/.dsh/cordis.patch.yml 受管区块并热加载（官方 @deepseek-ai/dsh-mcp-client），无需重启。上方为实时状态；手动添加的行只读展示。',
      mcpEditorTitle: 'MCP 配置（YAML）',
      editorHint: '每个条目：serverName（字母数字 _ -，≤32）、transport（stdio 或 streamable-http）；stdio 用 command/args/env，http 用 url/headers。工具以 mcp__名称__工具 暴露给模型。',
      save: '保存',
      saving: '保存中…',
      revert: '放弃更改',
      unsaved: '有未保存的更改',
      mcpSaved: '已保存 {n} 个服务器，热加载生效中。',
      needRestart: '宿主半边为旧版本：重启 dsh 一次后即可直接编辑 MCP 配置。',
      toolsCount: '{n} 个工具',
      noServers: '暂无 MCP 服务器。',
      handAdded: '手动添加（不受 dsh-base-plugin 管理）',
      managedBadge: 'dsh-base-plugin 管理',
      targetLabel: '目标',
      phaseActive: '已连接',
      phaseLoading: '连接中',
      phaseFailed: '失败',
      phaseDisabled: '已禁用',
      phasePending: '等待中',
      phaseDisposed: '已卸载',
      phaseUnloading: '卸载中',
      phaseAbsent: '未挂载',

      skillsIntro: '当前主机已注册的技能。~/.dsh/skills 下的技能可新建/编辑/删除（保存即热加载）；其余来源只读。',
      builtinHidden: '已隐藏 {n} 个内置技能（随部署发布，不可修改）。',
      createSkill: '新建技能',
      editSkill: '编辑',
      deleteSkill: '删除',
      skillNameLabel: '名称',
      skillNameHint: '小写字母、数字与连字符（kebab-case），如 my-deploy-flow',
      skillDescLabel: '描述（必填）',
      skillDescHint: '模型根据描述判断何时加载此技能',
      skillContentLabel: '内容（Markdown）',
      cancel: '取消',
      confirmDeleteSkill: '确定删除技能 {name}？将删除 ~/.dsh/skills/{name}/ 目录。',
      skillCreated: '已创建技能 {name}，已热加载生效。',
      skillUpdated: '已保存技能 {name}，已热加载生效。',
      skillDeleted: '已删除技能 {name}。',
      skillsNeedRestart: '宿主半边为旧版本：重启 dsh 一次后即可新建/编辑技能。',
      promptIntro: '全局系统提示词（人设）：默认为空（已覆盖部署默认人设），填写后对所有会话生效。保存在 ~/.dsh/cordis.patch.yml 受管区块并热加载，无需重启。',
      promptHint: '支持 {{model}}、{{cwd}} 等变量；未知变量（如 {{xxx}}）会导致组装失败，请勿随意使用。',
      promptActive: '当前：自定义人设已启用',
      promptDefault: '当前：未设置（人设为空）',
      promptPlaceholder: '例如：你是一个严谨的代码助手……',
      promptSaved: '系统提示词已保存，热加载生效（下一次模型请求即用新的人设）。',
      promptReset: '已清空人设。',
      promptResetBtn: '清空',
      confirmResetPrompt: '确定清空自定义人设？',
      promptNeedRestart: '宿主半边为旧版本：重启 dsh 一次后即可设置系统提示词。',
      serviceStop: '关闭服务',
      serviceRestart: '重启服务',
      serviceStopTitle: '关闭 dsh 服务（优雅退出，会话先落盘）',
      serviceRestartTitle: '重启 dsh 服务（页面将在恢复后自动刷新）',
      confirmStopSvc: '确定关闭 dsh 服务？所有会话连接将断开。',
      confirmRestartSvc: '确定重启 dsh 服务？约 5–15 秒，页面将在恢复后自动刷新。',
      svcStopping: '正在停止服务…',
      svcStopped: '服务已停止。重新启动 dsh 后刷新本页即可继续使用。',
      svcRestarting: '正在重启服务…',
      svcRestartWait: '正在重启（{sec} 秒）…恢复后页面自动刷新。',
      svcRestartFailed: '等待超时：请手动启动 dsh（{cmd}），然后刷新本页。',
      svcUnavailable: '宿主半边为旧版本：重启 dsh 一次后这两个按钮可用。',
      tabChanges: '文件变更',
      gitNoChanges: '工作区没有文件变更。',
      gitSearchPlaceholder: '搜索文件路径…',
      gitNoMatch: '没有匹配的文件。',
      gitSortLabel: '排序',
      gitSortKind: '按类型',
      gitSortPath: '按路径',
      gitSortTime: '按时间',
      gitSortChanges: '按变更量',
      gitSortAsc: '升序',
      gitInitializing: '正在检查 git 仓库（首次可能需要初始化并创建基线提交）…',
      gitBaselineCreated: '已自动初始化 git 仓库并创建基线提交，之后的文件变更会显示在这里。',
      gitKindNew: '新增',
      gitKindModified: '修改',
      gitKindDeleted: '删除',
      gitKindRenamed: '重命名',
      gitRenamedFrom: '原路径：{from}',
      gitDiffEmpty: '（无差异）',
      gitRootLabel: '仓库：{root}',
      gitSummaryFiles: '{n} 个文件',
      gitSummaryLines: '+{add} 行 · −{del} 行',
      gitSummaryBinary: '{n} 个二进制',
      gitLastCommit: '基准提交：{time}',
      gitLinesAdded: '+{n}',
      gitLinesDeleted: '−{n}',
      gitBinaryFile: '二进制',
      sectionUsage: '用量统计',
      usageIntro: '基于全部会话日志的模型用量统计（增量扫描，token 计数来自适配器上报，完全准确）。',
      usageRequests: '模型调用',
      usageInput: '输入',
      usageCacheRead: '缓存读',
      usageCacheWrite: '缓存写',
      usageOutput: '输出',
      usageReasoning: '（含推理 {n}）',
      usageCost: '费用估算',
      usageCostUnpriced: '有模型未定价，总费用为已定价部分',
      usageScanning: '正在扫描会话日志…（首次较慢，之后增量）',
      usageModelCol: '模型',
      usageRequestsCol: '次数',
      usageTotalTokens: '总 Token',
      usageCostCol: '费用($)',
      usagePriceCol: '单价($/百万)',
      usagePriceEdit: '编辑单价',
      usagePriceInput: '输入',
      usagePriceCacheRead: '缓存读',
      usagePriceCacheWrite: '缓存写',
      usagePriceOutput: '输出',
      usagePriceSave: '保存单价',
      usagePriceHint: '单位：美元/百万 token。修改后所有费用立即按新单价重算。',
      usagePriceDefault: '内置 DeepSeek 参考价，可自行修改。',
      usageTrend: '近 31 天用量（token/天）',
      usageTopSessions: '消耗最多的会话',
      usageNoData: '还没有用量数据（无会话或模型未上报用量）。',
      usageSessions: '{n} 个会话',
      usageRescan: '重扫全部',
      usageRangeStart: '开始日期',
      usageRangeEnd: '结束日期',
      usageRangeAll: '全部',
      usageRange7d: '近7天',
      usageRange30d: '近30天',
      usageRangeToday: '今天',
      usageRangeYesterday: '昨天',
      usageRangeThisMonth: '本月',
      usageTabModels: '模型用量',
      usageTabTools: '工具用量',
      usageToolCol: '工具',
      usageToolCalls: '调用次数',
      usageToolLast: '最近使用',
      usageToolNote: '工具维度统计调用次数（全时段），不含 token。',
      usageSeriesTitle: '用量趋势',
      usageGranDaily: '按天',
      usageGranHourly: '按小时',
      usageMetricTokens: 'Token',
      usageMetricCalls: '调用量',
      usageLegendTotal: '总量',
      usageRequestsAllTime: '调用次数为全时段统计',
      gitNoCwd: '此会话没有工作目录。',
      tabTerminal: '终端',
      sessionMore: '更多',
      toolsClose: '关闭',
      toolsResize: '拖拽调整宽度',
      termNew: '＋ 新建终端',
      termClose: '关闭此终端',
      termClosing: '正在关闭 {name}…',
      termCloseConfirm: '确定关闭终端 {name}？其中的运行进程将被终止。',
      termUnavailable: '主机未挂载终端服务（需要 @deepseek-ai/dsh-terminal 与终端后端组合行）。',
      termConnecting: '正在创建终端…',
      termPlaceholder: '输入命令，Enter 执行',
      noSkills: '暂无技能。',
      providerLabel: '提供者',
      whenToUseLabel: '适用场景',
      back: '← 返回列表',
      skillUnavailable: '此主机没有 skills 服务。',
      notFound: '未找到该技能。',
      notFoundFull: '未找到技能：{name}',
      contentLabel: '内容',
      sectionSessions: '会话管理',
      sectionMobile: '手机访问',
      mobileIntro: '在局域网内用手机访问本机 DSH：扫码配对一次，之后直接打开。默认关闭；开启后本插件在独立端口启动一个带鉴权的反向代理，DSH 主服务仍只监听本机。',
      mobileSecurityNote: '安全须知：传输为局域网 HTTP（配对码一次性、10 分钟有效；Cookie 签名绑定设备）。出门在外请配合 Tailscale 等加密组网使用，避免在不可信 Wi-Fi 下开启。',
      mobileEnable: '启用手机访问',
      mobilePort: '端口',
      mobileNotRunning: '服务未运行（检查端口占用或重启 dsh）',
      mobileQrTitle: '配对二维码',
      mobileQrHint: '手机扫码打开 → 输入配对码 {code}。每次打开本页面都会生成新配对码（旧码立即失效，10 分钟未用自动过期）。',
      mobileCodeLabel: '配对码',
      mobileUrls: '地址',
      mobileNoLan: '未检测到局域网 IP（可在手机浏览器手动输入地址）',
      mobileDevices: '已配对设备',
      mobileNoDevices: '暂无已配对设备。',
      mobileRevoke: '移除',
      mobileRotate: '轮换密钥（断开所有设备）',
      mobileRotateConfirm: '轮换签名密钥？所有已配对手机将立即失联，需要重新扫码配对。',
      mobileLastSeen: '最近活跃',
      mobilePairedAt: '配对时间',
      mobileApply: '应用',
      sessionsIntro: '查看并永久删除本机持久化的会话（含已归档）。删除会销毁完整对话日志，不可恢复；正在运行的会话需先关闭。',
      sessUnavailable: '此主机没有会话持久化服务。',
      noSessions: '暂无会话。',
      sessFilterAll: '全部',
      sessFilterLive: '活跃',
      sessFilterArchived: '已归档',
      sessFilterGhost: '残留',
      badgeLive: '活跃',
      badgeArchived: '已归档',
      badgeGhost: '仅残留数据',
      badgeDraft: '新会话草稿',
      draftHint: '「新建会话」会为工作区预创建一个占位会话以便秒开；此会话从未对话。未被使用时会被自动回收（活跃状态随之消失），之后可删除。',
      sessDelete: '删除',
      sessDeleting: '删除中…',
      sessSearchPlaceholder: '搜索会话（标题 / ID / 项目路径）',
      sessNoMatch: '没有匹配的会话。',
      sessLiveHint: '会话正在运行，先关闭再删除',
      sessArchivedLiveHint: '已归档但仍在运行；关闭其对话页后即可删除',
      sessArchivedLiveBadge: '归档仍在运行',
      confirmDeleteSession: '永久删除会话「{name}」？其完整对话日志与历史将被销毁，不可恢复。',
      sessDeleted: '已删除会话：{id}',
      sessUntitled: '（未命名会话）',
    }

    var EN = {
      tabMarket: 'Plugin Market',
      sectionMcp: 'MCP',
      sectionSkills: 'Skills',
      sectionPrompt: 'System Prompt',
      loading: 'Loading…',
      refresh: 'Refresh',
      errorTitle: 'Error',
      searchPlaceholder: 'Search dsh plugins on GitHub (keywords)',
      search: 'Search',
      sortLabel: 'Sort',
      sortDefault: 'Relevance (dsh first)',
      sortStars: 'Most stars',
      sortUpdated: 'Recently updated',
      sortName: 'Name',
      searchHint: 'Data from the GitHub Search API (repos with dsh in the name). Set GITHUB_TOKEN and restart dsh if rate-limited.',
      cachedHint: ' (5-min cache)',
      stars: 'stars',
      updated: 'updated {date}',
      install: 'Install',
      installing: 'Installing…',
      installed: 'Installed',
      uninstall: 'Uninstall',
      uninstalling: 'Uninstalling…',
      confirmUninstall: 'Uninstall {name}? Its composition rows and profile dependency will be removed.',
      opRunning: 'An operation is running: {op}',
      installDone: 'Installed {name} ({rows} composition rows). Hot-loads through the home patch; refresh or restart dsh if the UI does not update.',
      uninstallDone: 'Uninstalled {name}. Refresh the page if it still appears.',
      warning: 'Warning',
      noResults: 'No matching repositories.',
      managedTitle: 'Installed via dsh-base-plugin',
      noManaged: 'Nothing installed via dsh-base-plugin yet; plugins installed from the market appear here.',
      selfManaged: 'dsh-base-plugin itself — uninstall manually (edit ~/.dsh/cordis.patch.yml and run pnpm remove dsh-base-plugin in the profile).',
      restartHint: 'Installs/uninstalls write to ~/.dsh/cordis.patch.yml and hot-load; refresh the page or restart dsh if not effective.',
      viewOnGithub: 'GitHub',
      marketIntro: 'Search and one-click install DeepSeek Harness (dsh) plugins from GitHub.',

      mcpIntro: 'Edit the MCP server configuration (YAML) directly: saving writes the managed block of ~/.dsh/cordis.patch.yml and hot-loads it (official @deepseek-ai/dsh-mcp-client) — no restart needed. Live status above; hand-added rows are read-only.',
      mcpEditorTitle: 'MCP configuration (YAML)',
      editorHint: 'Each entry: serverName (letters/digits/_-, ≤32), transport (stdio or streamable-http); stdio takes command/args/env, http takes url/headers. Tools are exposed to the model as mcp__name__tool.',
      save: 'Save',
      saving: 'Saving…',
      revert: 'Revert edits',
      unsaved: 'Unsaved edits',
      mcpSaved: 'Saved {n} servers; hot-loading.',
      needRestart: 'Host half is an older version: restart dsh once to enable direct MCP config editing.',
      toolsCount: '{n} tools',
      noServers: 'No MCP servers yet.',
      handAdded: 'hand-added (not managed by dsh-base-plugin)',
      managedBadge: 'managed by dsh-base-plugin',
      targetLabel: 'target',
      phaseActive: 'connected',
      phaseLoading: 'connecting',
      phaseFailed: 'failed',
      phaseDisabled: 'disabled',
      phasePending: 'pending',
      phaseDisposed: 'disposed',
      phaseUnloading: 'unloading',
      phaseAbsent: 'not mounted',

      skillsIntro: 'Skills registered on this host. Skills under ~/.dsh/skills can be created/edited/deleted here (saves hot-load); other sources are read-only.',
      builtinHidden: '{n} built-in skills hidden (shipped with the deployment, not editable).',
      createSkill: 'New skill',
      editSkill: 'Edit',
      deleteSkill: 'Delete',
      skillNameLabel: 'Name',
      skillNameHint: 'lowercase letters, digits and hyphens (kebab-case), e.g. my-deploy-flow',
      skillDescLabel: 'Description (required)',
      skillDescHint: 'the model uses the description to decide when to load this skill',
      skillContentLabel: 'Content (Markdown)',
      cancel: 'Cancel',
      confirmDeleteSkill: 'Delete skill {name}? This removes the ~/.dsh/skills/{name}/ directory.',
      skillCreated: 'Created skill {name}; hot-loaded.',
      skillUpdated: 'Saved skill {name}; hot-loaded.',
      skillDeleted: 'Deleted skill {name}.',
      skillsNeedRestart: 'Host half is an older version: restart dsh once to enable creating/editing skills.',
      promptIntro: 'Global system prompt (persona): empty by default (the deployment default persona is overridden); any text applies to every session. Saved into the managed block of ~/.dsh/cordis.patch.yml and hot-loaded — no restart.',
      promptHint: 'Variables like {{model}} and {{cwd}} work; an unknown variable (e.g. {{xxx}}) breaks assembly — use with care.',
      promptActive: 'Current: custom persona active',
      promptDefault: 'Current: not set (empty persona)',
      promptPlaceholder: 'e.g. You are a meticulous coding assistant…',
      promptSaved: 'System prompt saved; hot-loaded (the next model request uses the new persona).',
      promptReset: 'Persona cleared.',
      promptResetBtn: 'Clear',
      confirmResetPrompt: 'Clear the custom persona?',
      promptNeedRestart: 'Host half is an older version: restart dsh once to set the system prompt.',
      serviceStop: 'Stop',
      serviceRestart: 'Restart',
      serviceStopTitle: 'Stop the dsh service (graceful; sessions flush first)',
      serviceRestartTitle: 'Restart the dsh service (the page reloads itself once back)',
      confirmStopSvc: 'Stop the dsh service? Every session connection drops.',
      confirmRestartSvc: 'Restart the dsh service? ~5-15s; the page reloads itself once back.',
      svcStopping: 'Stopping the service…',
      svcStopped: 'Service stopped. Start dsh again and refresh this page to continue.',
      svcRestarting: 'Restarting the service…',
      svcRestartWait: 'Restarting ({sec}s)… the page reloads itself once back.',
      svcRestartFailed: 'Timed out: start dsh manually ({cmd}), then refresh this page.',
      svcUnavailable: 'Host half is an older version: restart dsh once to enable these buttons.',
      tabChanges: 'File Changes',
      gitNoChanges: 'No file changes in the workspace.',
      gitSearchPlaceholder: 'Search file paths…',
      gitNoMatch: 'No matching files.',
      gitSortLabel: 'Sort',
      gitSortKind: 'By kind',
      gitSortPath: 'By path',
      gitSortTime: 'By time',
      gitSortChanges: 'By churn',
      gitSortAsc: 'Ascending',
      gitInitializing: 'Checking the git repo (the first open may initialize one and create a baseline commit)…',
      gitBaselineCreated: 'Initialized a git repo with a baseline commit; file changes from now on appear here.',
      gitKindNew: 'new',
      gitKindModified: 'modified',
      gitKindDeleted: 'deleted',
      gitKindRenamed: 'renamed',
      gitRenamedFrom: 'from: {from}',
      gitDiffEmpty: '(no diff)',
      gitRootLabel: 'repo: {root}',
      gitSummaryFiles: '{n} files',
      gitSummaryLines: '+{add} / −{del} lines',
      gitSummaryBinary: '{n} binary',
      gitLastCommit: 'baseline: {time}',
      gitLinesAdded: '+{n}',
      gitLinesDeleted: '−{n}',
      gitBinaryFile: 'binary',
      sectionUsage: 'Usage',
      usageIntro: 'Model usage aggregated over every session log (incremental scan; token counts come straight from adapter-reported usage).',
      usageRequests: 'model calls',
      usageInput: 'input',
      usageCacheRead: 'cache read',
      usageCacheWrite: 'cache write',
      usageOutput: 'output',
      usageReasoning: '(incl. {n} reasoning)',
      usageCost: 'estimated cost',
      usageCostUnpriced: 'some models are unpriced; the total covers priced ones only',
      usageScanning: 'Scanning session logs… (slow on the first run, incremental after)',
      usageModelCol: 'Model',
      usageRequestsCol: 'Calls',
      usageTotalTokens: 'Total tokens',
      usageCostCol: 'Cost ($)',
      usagePriceCol: 'Price ($/M)',
      usagePriceEdit: 'Edit prices',
      usagePriceInput: 'input',
      usagePriceCacheRead: 'cache read',
      usagePriceCacheWrite: 'cache write',
      usagePriceOutput: 'output',
      usagePriceSave: 'Save prices',
      usagePriceHint: 'USD per 1M tokens. Saving reprices every cost immediately.',
      usagePriceDefault: 'DeepSeek reference prices built in; edit freely.',
      usageTrend: 'Last 31 days (tokens/day)',
      usageTopSessions: 'Top sessions by usage',
      usageNoData: 'No usage data yet (no sessions, or the adapter reported none).',
      usageSessions: '{n} sessions',
      usageRescan: 'Rescan all',
      usageRangeStart: 'Start date',
      usageRangeEnd: 'End date',
      usageRangeAll: 'All',
      usageRange7d: '7d',
      usageRange30d: '30d',
      usageRangeToday: 'Today',
      usageRangeYesterday: 'Yesterday',
      usageRangeThisMonth: 'This month',
      usageTabModels: 'Model usage',
      usageTabTools: 'Tool usage',
      usageToolCol: 'Tool',
      usageToolCalls: 'calls',
      usageToolLast: 'last used',
      usageToolNote: 'The tool view counts invocations (all time); no tokens.',
      usageSeriesTitle: 'Usage trend',
      usageGranDaily: 'daily',
      usageGranHourly: 'hourly',
      usageMetricTokens: 'Tokens',
      usageMetricCalls: 'Calls',
      usageLegendTotal: 'total',
      usageRequestsAllTime: 'request counts are all-time',
      gitNoCwd: 'This session has no working directory.',
      tabTerminal: 'Terminal',
      sessionMore: 'More',
      toolsClose: 'Close',
      toolsResize: 'Drag to resize',
      termNew: '+ New Terminal',
      termClose: 'Close this terminal',
      termClosing: 'Closing {name}…',
      termCloseConfirm: 'Close terminal {name}? Running processes in it will be terminated.',
      termUnavailable: 'The terminals service is not mounted on this host (compose @deepseek-ai/dsh-terminal with a backend row).',
      termConnecting: 'Creating terminal…',
      termPlaceholder: 'Type a command and press Enter',
      noSkills: 'No skills yet.',
      providerLabel: 'provider',
      whenToUseLabel: 'when to use',
      back: '← Back to list',
      skillUnavailable: 'The skills service is unavailable on this host.',
      notFound: 'Skill not found.',
      notFoundFull: 'Skill not found: {name}',
      contentLabel: 'content',
      sectionSessions: 'Sessions',
      sectionMobile: 'Mobile Access',
      mobileIntro: 'Use DSH from your phone on the LAN: pair once by scanning, then just open it. Off by default; enabling starts an authenticated reverse proxy on its own port — the main dsh server keeps listening on loopback only.',
      mobileSecurityNote: 'Security note: transport is plain HTTP on the LAN (one-time pairing code valid 10 minutes; cookies are device-bound HMAC-signed). For remote use, pair over an encrypted overlay like Tailscale; avoid enabling on untrusted Wi-Fi.',
      mobileEnable: 'Enable mobile access',
      mobilePort: 'Port',
      mobileNotRunning: 'Service not running (check port conflicts or restart dsh)',
      mobileQrTitle: 'Pairing QR',
      mobileQrHint: 'Scan with the phone → enter code {code}. Opening this page mints a fresh code (previous ones die instantly; unused codes expire in 10 minutes).',
      mobileCodeLabel: 'Code',
      mobileUrls: 'Addresses',
      mobileNoLan: 'No LAN IP detected (type the address manually on the phone)',
      mobileDevices: 'Paired devices',
      mobileNoDevices: 'No paired devices yet.',
      mobileRevoke: 'Remove',
      mobileRotate: 'Rotate key (disconnect all devices)',
      mobileRotateConfirm: 'Rotate the signing key? Every paired phone is disconnected instantly and must re-pair.',
      mobileLastSeen: 'Last seen',
      mobilePairedAt: 'Paired',
      mobileApply: 'Apply',
      sessionsIntro: 'Inspect and permanently delete persisted sessions (archived included). Deletion destroys the full conversation log and cannot be undone; close a running session before deleting it.',
      sessUnavailable: 'The session persistence service is unavailable on this host.',
      noSessions: 'No sessions yet.',
      sessFilterAll: 'All',
      sessFilterLive: 'Live',
      sessFilterArchived: 'Archived',
      sessFilterGhost: 'Ghosts',
      badgeLive: 'live',
      badgeArchived: 'archived',
      badgeGhost: 'metadata only',
      badgeDraft: 'new-chat draft',
      draftHint: '"New Session" keeps a placeholder session per workspace for instant open; this one has never been conversed. Unused ones are reclaimed automatically (the live flag drops soon after), and can be deleted then.',
      sessDelete: 'Delete',
      sessDeleting: 'Deleting…',
      sessSearchPlaceholder: 'Search sessions (title / id / project path)',
      sessNoMatch: 'No matching sessions.',
      sessLiveHint: 'Session is running — close it first',
      sessArchivedLiveHint: 'Archived but still running; close its conversation tab to enable deletion',
      sessArchivedLiveBadge: 'archived, still running',
      confirmDeleteSession: 'Permanently delete session "{name}"? Its full conversation log and history will be destroyed and cannot be recovered.',
      sessDeleted: 'Deleted session: {id}',
      sessUntitled: '(untitled session)',
    }

    /** Locale-service-free fallback: pick by browser language, replace {x}. */
    function fallbackT(key, params) {
      var lang = 'en'
      try {
        if (typeof navigator !== 'undefined' && String(navigator.language || '').indexOf('zh') === 0) lang = 'zh'
      } catch (err) { /* keep en */ }
      var dict = lang === 'zh' ? ZH : EN
      var text = dict[key] !== undefined ? dict[key] : (EN[key] !== undefined ? EN[key] : key)
      if (params !== undefined && params !== null) {
        Object.keys(params).forEach(function (k) {
          text = text.split('{' + k + '}').join(String(params[k]))
        })
      }
      return text
    }

    /**
     * Locale change re-render trigger. One SHARED store for every mounted
     * component (per-render inline store objects made useSyncExternalStore
     * resubscribe on every render).
     */
    var localeStore = { initial: 0, instance: null }
    function bumpLocale() {
      if (localeStore.instance !== null) localeStore.instance.set(localeStore.instance.getSnapshot() + 1)
    }

    // ── tiny store ────────────────────────────────────────────────────────

    function createStore(initial) {
      var snapshot = initial
      var subs = new Set()
      return {
        getSnapshot: function () { return snapshot },
        set: function (next) {
          snapshot = next
          subs.forEach(function (fn) { fn() })
        },
        subscribe: function (fn) {
          subs.add(fn)
          return function () { subs.delete(fn) }
        },
      }
    }

    function useStore(store) {
      if (React.useSyncExternalStore !== undefined) {
        return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      }
      var state = React.useState(store.getSnapshot())
      React.useEffect(function () {
        return store.subscribe(function () { state[1](store.getSnapshot()) })
      }, [store])
      return state[0]
    }

    // ── api helper ────────────────────────────────────────────────────────

    function api(path, init) {
      var fetcher = typeof globalThis !== 'undefined' ? globalThis.fetch : undefined
      if (typeof fetcher !== 'function') {
        return Promise.reject(new Error('fetch is unavailable in this browser'))
      }
      return fetcher('/dsh-base-plugin/api' + path, init).then(function (res) {
        return res.json().then(function (payload) {
          if (payload === null || typeof payload !== 'object' || payload.ok !== true) {
            throw new Error(payload !== null && typeof payload === 'object' && typeof payload.error === 'string'
              ? payload.error
              : 'HTTP ' + res.status)
          }
          return payload.value
        }, function () {
          // Non-JSON body (proxy error page, truncated response): a bare
          // "Unexpected token" helps nobody.
          throw new Error('bad response from the dsh-base-plugin API (HTTP ' + res.status + ') — is dsh restarting?')
        })
      })
    }

    // ── styles ────────────────────────────────────────────────────────────

    var CSS = [
      '.dhb-page{display:flex;flex-direction:column;gap:12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-desc{margin:0;font-size:12px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dhb-input{flex:1;min-width:160px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:13px;outline:none}',
      '.dhb-input:focus{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-size:12px;line-height:1.4}',
      '.dhb-btn:hover:not(:disabled){border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.dhb-btnPrimary{border-color:transparent;background:#2f6fed;color:#fff}',
      '.dhb-btnPrimary:hover:not(:disabled){background:#2459c4;border-color:transparent}',
      '.dhb-btnDanger{color:#c0392b;border-color:#e5c4c0}',
      '.dhb-btnDanger:hover:not(:disabled){border-color:#c0392b}',
      '.dhb-card{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff)}',
      '.dhb-cardTitle{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222);display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dhb-cardMeta{font-size:12px;color:var(--dsw-alias-label-caption,#8a919e);display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.dhb-cardDesc{font-size:12px;color:var(--dsw-alias-label-secondary,#3f4550);word-break:break-word}',
      '.dhb-cardActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}',
      '.dhb-qrBox{display:flex;justify-content:center;padding:10px;border-radius:10px;background:#fff;width:fit-content;margin:0 auto}',
      '.dhb-qrBox svg{display:block}',
      '.dhb-badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);color:var(--dsw-alias-label-caption,#8a919e);background:transparent;white-space:nowrap}',
      '.dhb-badge[data-phase="active"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-phase="loading"],.dhb-badge[data-phase="pending"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-badge[data-phase="failed"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-badge[data-kind="ok"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-kind="installed"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-badge[data-kind="managed"]{color:#2f6fed;border-color:#c4d6f7;background:rgba(47,111,237,.07)}',
      '.dhb-banner{padding:8px 12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word;border:1px solid}',
      '.dhb-banner[data-kind="ok"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-banner[data-kind="err"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-banner[data-kind="warn"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-list{display:flex;flex-direction:column;gap:8px}',
      '.dhb-form{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px dashed var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px}',
      '.dhb-formTitle{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-field{display:flex;flex-direction:column;gap:3px}',
      '.dhb-label{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-hint{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-textarea{padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-height:56px;resize:vertical;outline:none}',
      '.dhb-link{color:#2f6fed;text-decoration:none;font-size:12px}',
      '.dhb-link:hover{text-decoration:underline}',
      '.dhb-skillRow{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);cursor:pointer;text-align:left;width:100%}',
      '.dhb-skillRow:hover{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-skillName{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-pre{margin:0;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.08));font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-sectTitle{margin:4px 0 0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,#3f4550)}',
      /* Contained hover row: NO negative margins (the official trigger's
         -4px bleed above it made the two hit areas overlap; the compositor
         repainting that overlap band read as a grey flicker in light
         theme). Our row stays strictly inside its own box. */
      /* Opaque shelf matching the sidebar background: the ancestor scroller
         repaints its bottom edge whenever ANY footer hover state changes
         (harness layout behavior — layers/isolation cannot stop it). An
         opaque shelf makes that repaint pixel-identical, so nothing is
         visible: the "flickering lines" were the scroller's rounded clip
         edge alternating between two subpixel positions over TRANSPARENT
         gaps; over a solid shelf the two positions paint the same color. */
      '.dhb-svcWrap{flex:none;display:flex;width:100%;margin:4px 0;box-sizing:border-box;padding:2px 4px;border-radius:10px;background:var(--dsw-alias-bg-base,#fff)}',
      /* Static-geometry opaque sheet: up past the scroller's bottom clip
         edge, down past the settings row. footerActions is position:static,
         so this absolute child anchors to the nearest positioned ancestor —
         the sidebar column — which is exactly the strip we want to cover. */
      '.dhb-svcBackdrop{position:absolute;left:0;right:0;top:-10px;bottom:-92px;pointer-events:none;z-index:-1;background:var(--dsw-alias-bg-base,#fff)}',
      /* No transitions on hover: an animated background on a flex row in the
         sidebar foot caused visible flicker on pointer-enter (the paint of
         the transition's first frames raced the flex relayout). Hover is an
         instant state swap now, matching the settings trigger below. */
      /* Integer-pixel geometry, no overflow clipping (rounded hover paints
         its own mask; overflow:hidden forced a clip layer whose 1px edges
         sat on subpixel boundaries and shimmered on Retina). */
      '.dhb-svcBtn{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:6px 10px;box-sizing:border-box;border:none;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-family:inherit;font-size:13px;line-height:22px;white-space:nowrap}',
      '.dhb-svcBtn:first-child{border-radius:12px 0 0 12px}',
      '.dhb-svcBtn:last-child{border-radius:0 12px 12px 0}',
      '.dhb-svcBtn:only-child{border-radius:12px}',
      /* Hover background via INSET BOX-SHADOW, not background+radius: a
         rounded background forces an antialiased clip whose top/bottom
         edges resample on every compositor promotion (the "two flickering
         lines" on Retina). An inset shadow with the same radius paints the
         identical pill with no clip layer at all. */
      '.dhb-svcBtn:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcBtn:disabled{opacity:.4;cursor:not-allowed}',
      '.dhb-svcBtn svg{flex:none;display:block}',
      '.dhb-svcStop:hover:not(:disabled){box-shadow:inset 0 0 0 9999px rgba(192,57,43,.08);color:#c0392b}',
      '.dhb-svcRailWrap{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;margin:4px 0}',
      '.dhb-svcRail{width:36px;height:36px;flex:none;display:flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer}',
      '.dhb-svcRail:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcRail:disabled{opacity:.4;cursor:not-allowed}',
      /* Above the settings modal (its mask sits at z-index 1000): the confirm
         card is a global answer to a destructive action and must never be
         covered by the surface that asked for it. */
      '.dhb-cfmOverlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}',
      '.dhb-cfmCard{display:flex;flex-direction:column;gap:14px;width:min(360px,calc(100vw - 48px));padding:18px 20px 16px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-cfmText{margin:0;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-cfmRow{display:flex;justify-content:flex-end;gap:8px}',
      /* Pinned onto the header's bottom rule — the same line as the view
         tabs (the tabs row is the header's last row; its text sits ~11px
         above the border). bottom:2px puts the 28px button's vertical
         center on the tab text's line; right:0 hugs the header's right
         padding edge like a trailing tab. */
      '.dhb-smWrap{position:absolute;bottom:2px;right:0;z-index:2;flex:none}',
      '.dhb-smBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer}',
      '.dhb-smBtn:hover{box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-smMenu{position:absolute;top:calc(100% + 4px);right:12px;z-index:60;padding:4px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);font-size:13px;white-space:nowrap}',
      '.dhb-smItem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 14px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;text-align:left;font-family:inherit;font-size:12.5px}',
      '.dhb-smItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-gtPage{display:flex;flex-direction:column;gap:10px;height:100%;padding:16px 20px;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);overflow-y:auto}',
      '.dhb-gtHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none}',
      '.dhb-gtTitle{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-gtMeta{font-size:12px;color:var(--dsw-alias-label-caption,#8a919e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dhb-gtRow{display:flex;flex-direction:column;gap:4px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);overflow:hidden}',
      '.dhb-gtFileBtn{display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:transparent;cursor:pointer;text-align:left;font-size:12px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-gtFileBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}',
      '.dhb-gtPath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;direction:ltr}',
      '.dhb-gtFrom{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dhb-gtKind{flex:none;display:inline-flex;padding:1px 8px;border-radius:999px;font-size:11px;line-height:1.6;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-gtKind[data-kind="new"]{color:#1e7e34;border-color:#b7dfc0;background:rgba(30,126,52,.07)}',
      '.dhb-gtKind[data-kind="modified"]{color:#8a6d1a;border-color:#eadfa8;background:rgba(138,109,26,.07)}',
      '.dhb-gtKind[data-kind="deleted"]{color:#c0392b;border-color:#e5c4c0;background:rgba(192,57,43,.07)}',
      '.dhb-gtKind[data-kind="renamed"]{color:#2f6fed;border-color:#c4d6f7;background:rgba(47,111,237,.07)}',
      '.dhb-gtCounts{flex:none;display:inline-flex;gap:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}',
      '.dhb-gtTime{flex:none;font-size:11px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-gtAdd{color:#1e7e34}',
      '.dhb-gtDel{color:#c0392b}',
      '.dhb-diff{margin:0;padding:8px 0;border-top:1px dashed var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.05));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.55;overflow-x:auto;direction:ltr}',
      '.dhb-diffL{display:block;padding:0 12px;white-space:pre;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-diffL[data-k="+"]{color:#1e7e34;background:rgba(30,126,52,.07)}',
      '.dhb-diffL[data-k="-"]{color:#c0392b;background:rgba(192,57,43,.06)}',
      '.dhb-diffL[data-k="@"]{color:#2f6fed}',
      '.dhb-diffL[data-k="h"]{color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-tmPage{display:flex;flex-direction:column;height:100%;padding:12px 16px;box-sizing:border-box;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-tmBar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:none}',
      '.dhb-tmTab{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:none;border-radius:9px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmTab[data-active="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-tmTab[data-closing="1"]{opacity:.55;pointer-events:none}',
      '.dhb-tmSpin{display:inline-flex;flex:none;width:13px;height:13px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,#e3e6ec);border-top-color:#2f6fed;animation:dhbSpin .9s linear infinite}',
      '.dhb-tmTab:hover:not([data-active="1"]){color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-tmX{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border:none;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-size:11px;line-height:1;padding:0}',
      '.dhb-tmX:hover{background:rgba(192,57,43,.12);color:#c0392b}',
      '.dhb-tmNew{display:inline-flex;align-items:center;padding:4px 10px;border:none;border-radius:9px;background:transparent;color:#2f6fed;cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmNew:hover{background:rgba(47,111,237,.08)}',
      '.dhb-tmOut{flex:1;min-height:0;margin:0;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.06));font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;overflow-y:auto;direction:ltr}',
      '.dhb-tmInRow{display:flex;gap:8px;flex:none;align-items:center}',
      '.dhb-tmPrompt{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#1e7e34}',
      '.dhb-tmIn{flex:1;padding:7px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;outline:none}',
      '.dhb-tmIn:focus{border-color:var(--dsw-alias-label-caption,#aab2bf)}',
      '.dhb-tmCtrl{flex:none;padding:5px 10px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-tmCtrl:hover{color:#c0392b}',
      '.dhb-usStat{display:flex;flex-direction:column;gap:2px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2,#e3e6ec);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);min-width:110px;flex:1}',
      '.dhb-usStatV{font-size:17px;font-weight:600;color:var(--dsw-alias-label-primary,#222);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dhb-usStatL{font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-usTable{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}',
      '.dhb-usTable th{text-align:left;font-weight:500;color:var(--dsw-alias-label-caption,#8a919e);padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);white-space:nowrap}',
      '.dhb-usTable td{padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);white-space:nowrap}',
      '.dhb-usTable td.dhb-usNum{text-align:right}',
      '.dhb-usBars{display:flex;align-items:flex-end;gap:3px;height:64px;padding:8px 0 2px}',
      '.dhb-usBar{flex:1;min-width:4px;background:#2f6fed;opacity:.75;border-radius:2px 2px 0 0}',
      '.dhb-usBar:hover{opacity:1}',
      '.dhb-usPriceRow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;padding:8px;border:1px dashed var(--dsw-alias-border-l2,#e3e6ec);border-radius:8px;margin-top:6px}',
      '.dhb-usTabs{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:var(--dsw-alias-markdown-code-block,rgba(127,127,127,.08))}',
      '.dhb-usTab{padding:4px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer;font-size:12px;font-family:inherit}',
      '.dhb-usTab[data-on="1"]{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 1px 3px rgba(0,0,0,.1)}',
      '.dhb-usChart{display:flex;align-items:flex-end;gap:2px;height:120px;padding:6px 0 0;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);position:relative}',
      '.dhb-usCol{flex:1;min-width:3px;display:flex;flex-direction:column;justify-content:flex-end;border-radius:2px 2px 0 0;overflow:hidden}',
      '.dhb-usCol:hover{filter:brightness(1.15)}',
      '.dhb-usSeg{min-height:1px}',
      '.dhb-usAxis{display:flex;justify-content:space-between;padding:3px 2px 0;font-size:10px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-usMaxTag{position:absolute;top:0;left:2px;font-size:10px;color:var(--dsw-alias-label-caption,#8a919e);font-variant-numeric:tabular-nums}',
      '.dhb-usLegend{display:flex;gap:12px;flex-wrap:wrap;padding:4px 2px;font-size:11px;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-usDot{display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:4px;vertical-align:middle}',
      '.dhb-usRange{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.dhb-usDate{padding:4px 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px;font-family:inherit}',
      '.dhb-usPriceIn{width:90px;padding:4px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-secondary,#3f4550);font-size:12px}',
      '.dhb-svcOverlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.32);backdrop-filter:blur(1px)}',
      '.dhb-toolsDock{position:fixed;top:0;right:0;bottom:0;z-index:1500;display:flex;max-width:calc(100vw - 56px);background:var(--dsw-alias-bg-base,#fff);border-left:1px solid var(--dsw-alias-border-l2,#e3e6ec);box-shadow:-6px 0 18px rgba(0,0,0,.10)}',
      '.dhb-toolsResize{flex:none;width:5px;cursor:col-resize;background:transparent;transition:background .15s}',
      '.dhb-toolsResize:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}',
      '.dhb-toolsCrumb{flex:1;min-width:0;display:flex;align-items:center;gap:5px;overflow:hidden;font-size:12px;line-height:1.4}',
      '.dhb-toolsCrumbSess{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8a919e);direction:rtl;text-align:left}',
      '.dhb-toolsCrumbSess:hover{direction:ltr}',
      '.dhb-toolsCrumbSep{flex:none;color:var(--dsw-alias-label-caption,#8a919e)}',
      '.dhb-toolsCrumbCur{flex:none;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#222);font-weight:600}',
      '.dhb-toolsNav{flex:none;display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);overflow-x:auto;scrollbar-width:thin}',
      '.dhb-toolsNavItem{display:inline-flex;align-items:center;gap:7px;flex:none;padding:6px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-size:12.5px;font-family:inherit;line-height:1.4;white-space:nowrap}',
      '.dhb-toolsNavItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-toolsNavItem[data-active="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#222);font-weight:600}',
      '.dhb-toolsMain{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.dhb-toolsHead{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec)}',
      '.dhb-toolsBody{flex:1;min-height:0}',
      '.dhb-svcCard{display:flex;flex-direction:column;gap:8px;align-items:center;padding:22px 30px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);max-width:420px;text-align:center}',
      '.dhb-svcSpin{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--dsw-alias-border-l2,#e3e6ec);border-top-color:#2f6fed;animation:dhbSpin 0.9s linear infinite}',
      '@keyframes dhbSpin{to{transform:rotate(360deg)}}',
      /* ── Mobile adaptation (phones reach these pages through the mobile
         proxy; the DSH shell itself auto-collapses below 1024px, these
         rules adapt THIS plugin's own surfaces). Touch-friendly targets,
         scrollable wide tables, full-width tool dock, scaled QR. ──────── */
      '@media (max-width: 760px){',
      /* Touch targets: buttons grow, small icon buttons reach 32px. */
      '.dhb-btn{padding:8px 14px;font-size:13px}',
      '.dhb-smBtn{width:32px;height:32px}',
      '.dhb-tmX{width:20px;height:20px}',
      '.dhb-skillRow{padding:12px}',
      /* Inputs share rows with labels: let them shrink instead of forcing
         160px minimum inside a wrapping flex row. */
      '.dhb-input{min-width:0}',
      '.dhb-textarea{min-height:72px;font-size:13px}',
      /* Wide nowrap tables (usage stats, price editor) become their own
         horizontal scrollers — the classic display:block trick. */
      '.dhb-usTable{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      /* Stat cards and charts give up their floor width so the row wraps
         into fewer per line instead of overflowing. */
      '.dhb-usStat{min-width:0}',
      '.dhb-usPriceIn{width:74px}',
      /* Code blocks and diffs: keep more of the viewport for content. */
      '.dhb-pre{max-height:56vh}',
      '.dhb-diff{font-size:11px}',
      /* QR pairing card scales with the viewport. */
      '.dhb-qrBox svg{width:min(240px,68vw);height:auto}',
      /* The tool dock (file changes / terminal) is a desktop side column;
         on a phone it becomes a full-width overlay. Inline width comes from
         the JS drag state — left:0/right:0 pin it regardless. The resize
         strip is meaningless on touch: hide it. */
      '.dhb-toolsDock{left:0;right:0;width:100vw !important;max-width:100vw;border-left:none}',
      '.dhb-toolsResize{display:none}',
      '.dhb-toolsCrumbCur{max-width:38vw}',
      '.dhb-gtPage{padding:10px 10px}',
      '.dhb-tmOut{font-size:11.5px}',
      /* Service status overlay card breathes on small screens. */
      '.dhb-svcCard{max-width:88vw;padding:18px 16px}',
      /* ── Host settings panel (tagged by the DOM patch above; hashed
         module class names can't be targeted). Desktop: 800px modal,
         188px left nav rail. Phone: full-screen sheet with a top
         horizontally-scrolling nav — the rail otherwise eats half the
         viewport. !important overrides the inline/module geometry. ── */
      '[data-dhb-settings-panel]{width:100vw !important;max-width:100vw !important;height:100vh !important;height:100dvh !important;border-radius:0 !important;flex-direction:column !important}',
      '[data-dhb-settings-nav]{width:100% !important;flex:none !important;flex-direction:row !important;align-items:center;gap:2px !important;padding:6px 8px 0 !important;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1,#e3e6ec)}',
      /* Title row ("设置") collapses to zero — the header already names the
         active section; keeps the strip a single control row. */
      '[data-dhb-settings-nav] > div:first-child{display:none !important}',
      '[data-dhb-settings-nav] > div:last-child{flex-direction:row !important;gap:2px !important;overflow-x:auto;min-width:0;flex:1;-webkit-overflow-scrolling:touch}',
      '[data-dhb-settings-nav] button{flex:none !important;height:38px !important;padding:7px 12px !important;white-space:nowrap}',
      /* THE critical fix: in the desktop row layout .content was never
         height-flexed so min-width:0 sufficed; flipped to a column its
         main axis is height and min-height:auto floors it at full content
         height — the options area then overflows the panel (clipped by
         overflow:hidden) while scrollHeight==clientHeight, so nothing
         scrolls. min-height:0 lets flex actually shrink it. */
      '[data-dhb-settings-content]{min-height:0 !important}',
      '[data-dhb-settings-options]{padding:14px 12px !important}',
      '}',
    ]

    /** Insert the stylesheet once; returns a disposer removing it on stop. */
    function injectStyles() {
      if (typeof document === 'undefined') return undefined
      if (document.getElementById('dsh-base-plugin/styles') !== null) return undefined
      var tag = document.createElement('style')
      tag.id = 'dsh-base-plugin/styles'
      tag.textContent = CSS.join('\n')
      document.head.appendChild(tag)
      return function () {
        if (tag.parentNode !== null) tag.parentNode.removeChild(tag)
      }
    }

    // ── shared bits ───────────────────────────────────────────────────────

    function Banner(props) {
      return h('div', { className: 'dhb-banner', 'data-kind': props.kind }, props.text)
    }

    function phaseLabel(t, phase) {
      var map = {
        active: 'phaseActive',
        loading: 'phaseLoading',
        failed: 'phaseFailed',
        disabled: 'phaseDisabled',
        pending: 'phasePending',
        disposed: 'phaseDisposed',
        unloading: 'phaseUnloading',
        absent: 'phaseAbsent',
      }
      var key = map[phase]
      return key !== undefined ? t(key) : String(phase)
    }

    function post(path, body) {
      return api(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body === undefined ? {} : body),
      })
    }

    // ── in-app confirm dialog (no native window.confirm) ─────────────────

    /**
     * Confirm dialog in DIRECT DOM (not React): the card must sit at
     * document.body level to top the settings modal (body-level z-index
     * 1000), while the shell.overlay slot lives inside the frame's stacking
     * context where nothing can beat it. Moving a React-owned node to body
     * breaks React's unmount bookkeeping (dead handlers, ghost nodes), so
     * this drives a tiny imperative overlay instead: showConfirm() builds it
     * lazily, buttons settle the pending promise and hide the DOM. One open
     * dialog at a time; Esc and backdrop-click cancel.
     */
    var confirmDom = null
    var pendingConfirmResolve = null

    function confirmLabel2(key) {
      return (currentT !== null ? currentT : fallbackT)(key)
    }

    function ensureConfirmDom() {
      if (confirmDom !== null) return confirmDom
      var root = document.createElement('div')
      root.className = 'dhb-cfmOverlay'
      root.style.zIndex = '2000'
      root.addEventListener('click', function (e) {
        if (e.target === root) settleConfirm(false)
      })
      var card = document.createElement('div')
      card.className = 'dhb-cfmCard'
      card.setAttribute('role', 'alertdialog')
      var text = document.createElement('p')
      text.className = 'dhb-cfmText'
      var row = document.createElement('div')
      row.className = 'dhb-cfmRow'
      var cancel = document.createElement('button')
      cancel.className = 'dhb-btn'
      cancel.type = 'button'
      var ok = document.createElement('button')
      ok.type = 'button'
      cancel.addEventListener('click', function () { settleConfirm(false) })
      ok.addEventListener('click', function () { settleConfirm(true) })
      row.appendChild(cancel)
      row.appendChild(ok)
      card.appendChild(text)
      card.appendChild(row)
      root.appendChild(card)
      root.style.display = 'none'
      document.body.appendChild(root)
      confirmDom = { root: root, text: text, cancel: cancel, ok: ok, keyHandler: null }
      return confirmDom
    }

    function showConfirm(text, options) {
      var opts = options === null || typeof options !== 'object' ? {} : options
      return new Promise(function (resolve) {
        settleConfirm(false) // supersede any pending dialog
        if (typeof document === 'undefined') { resolve(false); return }
        var ui = ensureConfirmDom()
        pendingConfirmResolve = function (result) {
          ui.root.style.display = 'none'
          if (ui.keyHandler !== null) {
            document.removeEventListener('keydown', ui.keyHandler)
            ui.keyHandler = null
          }
          pendingConfirmResolve = null
          resolve(result)
        }
        ui.text.textContent = String(text)
        ui.cancel.textContent = confirmLabel2('cancel')
        ui.ok.textContent = typeof opts.okLabel === 'string' && opts.okLabel !== '' ? opts.okLabel : 'OK'
        ui.ok.className = 'dhb-btn ' + (opts.danger === true ? 'dhb-btnDanger' : 'dhb-btnPrimary')
        ui.keyHandler = function (e) { if (e.key === 'Escape') settleConfirm(false) }
        document.addEventListener('keydown', ui.keyHandler)
        ui.root.style.display = 'flex'
      })
    }

    function settleConfirm(result) {
      if (pendingConfirmResolve !== null) pendingConfirmResolve(result)
    }

    /** Registered into shell.overlay to keep the slot registration contract;
     * the real card is direct DOM at body level. */
    function ConfirmDialog() {
      return null
    }

    /** The locale-bound translate fn captured at apply time (fallback: navigator language). */
    var currentT = null


    /** Subscribe the component to locale changes (shared store, stable identity). */
    function useLocaleVersion() {
      if (localeStore.instance === null) {
        localeStore.instance = createStore(localeStore.initial)
      }
      return useStore(localeStore.instance)
    }

    // ── market tab ────────────────────────────────────────────────────────

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

      // Local ordering for stars/updated/name — the final word even against
      // an older host half (which ignores the sort param and returns its
      // default ranking). `default` keeps the host's ecosystem tier order.
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
            return Object.assign({}, prev, { plugins: value.plugins, busy: value.busy })
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

    // ── mcp section ───────────────────────────────────────────────────────

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

      var refresh = React.useCallback(function () {
        api('/state').then(function (value) {
          var yamlText = typeof value.mcpYaml === 'string' ? value.mcpYaml : null
          setData(function (prev) { return { status: 'ready', servers: value.mcpServers, mcpYaml: yamlText } })
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

    // ── system prompt section ─────────────────────────────────────────────

    function PromptSection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle', persona: null, effective: null })
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

      // Re-read state and re-seed the editor (never clobbers unsaved edits).
      // The editor seeds with the custom persona only — the default is empty.
      var refresh = React.useCallback(function (forceEditor) {
        api('/state').then(function (value) {
          var persona = typeof value.persona === 'string' ? value.persona : ''
          var effective = typeof value.effectivePersona === 'string' ? value.effectivePersona : ''
          setData({ status: 'ready', persona: persona, effective: effective })
          if (forceEditor === true) {
            setEditor({ text: persona, dirty: false })
          }
        }).catch(function (error) {
          setData(function (prev) { return Object.assign({}, prev, { status: 'error' }) })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh(true) }, [refresh])

      var available = data.effective !== null // old host: field missing entirely

      function onSave() {
        if (saving) return
        setSaving(true)
        setMsg(null)
        post('/prompt', { persona: editor.text })
          .then(function (value) {
            setMsg({ kind: 'ok', text: value.active === true ? t('promptSaved') : t('promptReset') })
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
          .then(function () {
            setSaving(false)
            refresh(true)
          })
      }

      function onReset() {
        showConfirm(t('confirmResetPrompt'), { okLabel: t('promptResetBtn') })
          .then(function (ok) {
            if (!ok) return
            setEditor({ text: '', dirty: true })
            setMsg(null)
            if (!saving) {
              setSaving(true)
              post('/prompt', { persona: '' })
                .then(function () { setMsg({ kind: 'ok', text: t('promptReset') }) })
                .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
                .then(function () { setSaving(false); refresh(true) })
            }
          })
      }

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionPrompt')),
        h('p', { className: 'dhb-desc' }, t('promptIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        available ? null : h(Banner, { kind: 'warn', text: t('promptNeedRestart') }),
        data.status === 'loading' || data.status === 'idle' ? h('p', { className: 'dhb-desc' }, t('loading')) : null,
        data.status === 'ready'
          ? h('div', { className: 'dhb-form' },
              h('div', { className: 'dhb-formTitle' }, data.persona !== ''
                ? t('promptActive')
                : t('promptDefault')),
              h('span', { className: 'dhb-hint' }, t('promptHint')),
              h('textarea', {
                className: 'dhb-textarea',
                value: editor.text,
                style: { minHeight: '160px' },
                spellCheck: false,
                placeholder: t('promptPlaceholder'),
                onChange: function (e) { setEditor({ text: e.target.value, dirty: true }) },
              }),
              h('div', { className: 'dhb-row' },
                h('button', {
                  className: 'dhb-btn dhb-btnPrimary', type: 'button',
                  disabled: saving || !available, onClick: onSave,
                }, saving ? t('saving') : t('save')),
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  disabled: saving || !available || data.persona === '', onClick: onReset,
                }, t('promptResetBtn')),
              ),
            )
          : null,
      )
    }

    // ── skills section ────────────────────────────────────────────────────

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

    // ── sessions section (inventory + destructive delete) ────────────────

    /** Filter keys in display order; labels via t('sessFilter'+Key). */
    var SESS_FILTERS = ['all', 'live', 'archived', 'ghost']

    /** A row's display name: the projected title, else the untitled label. */
    function sessionDisplayName(item, t) {
      if (typeof item.title === 'string' && item.title !== '') return item.title
      return t('sessUntitled')
    }

    /**
     * The Sessions settings section: every persisted session (plus archive-set
     * ghosts) with filter chips and a per-row destructive Delete. Live rows
     * disable the button (the host refuses them anyway — close first); ghost
     * rows (no log, not live) delete as a pure metadata sweep.
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

      // Search narrows within the active filter chip: case-insensitive
      // substring over title, id, and cwd (the fields a user can see).
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

    // ── mobile access section (pairing proxy control) ────────────────────

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
     * The Mobile Access settings section: enable toggle + port, pairing QR
     * (each open mints a fresh code), paired-device list with per-device
     * revoke, and the rotate-key action. All through the host half's
     * /mobile* control routes.
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

    // ── File Changes panel (git, read-only) ───────────────────────────────

    /**
     * The "File Changes" panel (opened from the header ⋯ menu's right-docked
     * overlay, only when the host reports a git binary). Reads the session
     * workspace's git status through the host API (which auto-inits a repo +
     * baseline commit on first open when needed) and shows per-file diffs
     * inline. Strictly read-only — viewing changes never touches the work
     * tree. Consumes only `kit.sessionId` and `kit.useSessions` (cwd), so it
     * runs equally well behind the overlay's synthetic kit.
     */
    function ChangesView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      // Session cwd via the standard sessions hook (session-scoped slot).
      var sessionId = kit !== undefined ? kit.sessionId : undefined
      var cwd = kit !== undefined && typeof kit.useSessions === 'function'
        ? kit.useSessions(function (s) {
            var row = sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
            return row !== undefined && typeof row.cwd === 'string' ? row.cwd : ''
          })
        : ''

      var dataState = React.useState({ status: 'idle', entries: [], stats: null, lines: null, total: 0, lastCommitAt: '', root: '', baselineNote: false, error: '' })
      var data = dataState[0]
      var setData = dataState[1]

      // expanded: { [path]: { status, diff } }
      var diffState = React.useState({})
      var diffs = diffState[0]
      var setDiffs = diffState[1]

      // File filter/sort controls (persist across reloads of the same list).
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
            setDiffs(function (prev) {
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

      /** Churn = added+deleted lines (binary → -1 so it sorts last in
       * descending churn but never first; mtime fallback for null churn). */
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

      // Filter → sort pipeline. Search narrows by path substring
      // (case-insensitive); sort supports kind/path/time/churn, path and kind
      // ascending by nature, time/churn default to descending (newest /
      // biggest first) with a manual direction toggle.
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

      /** Per-row time: "HH:MM" today, "MM-DD HH:MM" otherwise. */
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

      return h('div', { className: 'dhb-gtPage' },
        h('div', { className: 'dhb-gtHead' },
          h('h2', { className: 'dhb-gtTitle' }, t('tabChanges')),
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
                      : slot.diff.split('\n').map(function (line, idx) {
                          var k = line.indexOf('+') === 0 ? '+' : line.indexOf('-') === 0 ? '-' : line.indexOf('@@') === 0 ? '@' : line.indexOf('diff ') === 0 || line.indexOf('index ') === 0 || line.indexOf('--- ') === 0 || line.indexOf('+++ ') === 0 ? 'h' : ''
                          return h('span', { className: 'dhb-diffL', 'data-k': k, key: idx }, line)
                        }),
                    )
                  : null,
              )
            }),
            ),
          ),
      )
    }

    // ── Terminal panel (PTY, multi) ────────────────────────────────────────

    /**
     * One terminal pane: output stream + single-line input. The host maps
     * the PTY send-operation model onto this UI: pressing Enter submits the
     * line and settles the op; output is polled (read delta) while typing
     * keeps one op open. Ctrl+C interrupts the foreground op.
     */
    function TerminalPane(props) {
      var t = props.t
      var term = props.term // { key, terminalId, name, output }
      var onInput = props.onInput
      var onInterrupt = props.onInterrupt

      var inputState = React.useState('')
      var input = inputState[0]
      var setInput = inputState[1]

      var outRef = React.useRef(null)
      React.useEffect(function () {
        var el = outRef.current
        if (el !== null) el.scrollTop = el.scrollHeight
      }, [term.output])

      function submit() {
        if (input === '') return
        var sent = onInput(term.key, input, true)
        // Clear the line only once the PTY accepted it; a rejection (e.g.
        // "a command is still running") keeps the typed text for editing.
        if (sent !== undefined && typeof sent.then === 'function') {
          sent.then(function () { setInput('') }, function () { /* keep input */ })
        } else {
          setInput('')
        }
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 8 } },
        h('pre', { className: 'dhb-tmOut', ref: outRef }, term.output === '' ? t('termPlaceholder') : term.output),
        h('div', { className: 'dhb-tmInRow' },
          h('span', { className: 'dhb-tmPrompt' }, '$'),
          h('input', {
            className: 'dhb-tmIn',
            value: input,
            placeholder: t('termPlaceholder'),
            spellCheck: false,
            autoComplete: 'off',
            onChange: function (e) { setInput(e.target.value) },
            onKeyDown: function (e) {
              if (isComposing(e)) return // IME Enter = confirm candidate, not submit
              if (e.key === 'Enter') submit()
              else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                onInterrupt(term.key)
              }
            },
          }),
          h('button', {
            className: 'dhb-tmCtrl', type: 'button',
            title: 'Ctrl+C',
            onClick: function () { onInterrupt(term.key) },
          }, '^C'),
        ),
      )
    }

    /**
     * The Terminal panel: multiple PTYs in the session workspace, opened from
     * the header ⋯ menu's right-docked panel. Terminals live host-side
     * (owner-scoped to the session's agent), so the panel only restores the
     * list and keeps per-terminal output state locally.
     */
    function TerminalView(props) {
      var t = props.t
      var kit = props.kit
      useLocaleVersion()

      var sessionId = kit !== undefined ? kit.sessionId : undefined
      var cwd = kit !== undefined && typeof kit.useSessions === 'function'
        ? kit.useSessions(function (s) {
            var row = sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
            return row !== undefined && typeof row.cwd === 'string' ? row.cwd : ''
          })
        : ''

      // terms: [{ key, terminalId, name, output }]
      var termsState = React.useState([])
      var terms = termsState[0]
      var setTerms = termsState[1]

      var activeState = React.useState(null)
      var activeKey = activeState[0]
      var setActiveKey = activeState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      // closing: { [terminalKey]: true } — kills in flight. The host round
      // trip (agent resolve + PTY kill RPC) can take a beat; the tab shows a
      // spinner and goes inert meanwhile, so the click visibly landed.
      var closingState = React.useState({})
      var closing = closingState[0]
      var setClosing = closingState[1]

      var seq = React.useRef(0)
      var latestOp = React.useRef({}) // terminalKey → newest opKey

      function patchTerm(key, patch) {
        setTerms(function (prev) {
          return prev.map(function (tm) { return tm.key === key ? Object.assign({}, tm, patch) : tm })
        })
      }

      function appendOutput(key, delta) {
        if (typeof delta !== 'string' || delta === '') return
        setTerms(function (prev) {
          return prev.map(function (tm) {
            if (tm.key !== key) return tm
            var merged = tm.output + delta
            // host scrollback is bounded; mirror a generous local bound
            if (merged.length > 200000) merged = merged.slice(-100000)
            return Object.assign({}, tm, { output: merged })
          })
        })
      }

      /** Poll one op until it settles; registered for unmount cleanup. */
      var pollStoppers = []
      function pollLoop(key, opKey) {
        var stop = false
        var misses = 0
        var tick = function () {
          if (stop) return
          post('/terminal/read', { sessionId: sessionId, terminalId: key, opKey: opKey })
            .then(function (value) {
              misses = 0
              appendOutput(key, value.delta)
              if (value.done === true) return // op settled; loop ends
              setTimeout(tick, 700)
            })
            .catch(function () {
              // Back off; after sustained misses (host gone / plugin removed)
              // the loop ends instead of polling forever.
              misses += 1
              if (misses >= 20) return
              setTimeout(tick, 1500)
            })
        }
        tick()
        var stopper = function () { stop = true }
        pollStoppers.push(stopper)
        return stopper
      }

      // Stop every live poll when the tab unmounts (switching views must not
      // leave orphan pollers POSTing for a dead component).
      React.useEffect(function () {
        return function () {
          for (var i = 0; i < pollStoppers.length; i += 1) pollStoppers[i]()
          pollStoppers.length = 0
        }
      }, [])

      /** Restore host-side terminals for this session (tab remount). */
      React.useEffect(function () {
        if (sessionId === undefined) return
        post('/terminal/list', { sessionId: sessionId })
          .then(function (value) {
            setTerms((value.terminals ?? []).map(function (snap) {
              return { key: snap.sessionId, terminalId: snap.sessionId, name: snap.name !== '' ? snap.name : snap.sessionId, output: '' }
            }))
          })
          .catch(function () { /* host terminals missing — start empty */ })
      }, [sessionId])

      function onNew() {
        if (sessionId === undefined || sessionId === '') return
        // Suffix with a clock token: after a tab remount the local counter
        // resets, and a bare "term-1" would collide with a still-open host
        // PTY of the same name (the registry rejects duplicate names).
        var name = 'term-' + String(++seq.current) + '-' + Date.now().toString(36).slice(-4)
        setMsg(null)
        post('/terminal/open', { sessionId: sessionId, name: name, cwd: cwd })
          .then(function (value) {
            var entry = { key: value.sessionId, terminalId: value.sessionId, name: name, output: value.motd ?? '' }
            setTerms(function (prev) { return prev.concat([entry]) })
            setActiveKey(entry.key)
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
          })
      }

      function onCloseTerm(term) {
        if (closing[term.key] === true) return // already killing
        showConfirm(t('termCloseConfirm', { name: term.name }), { okLabel: t('termClose'), danger: true })
          .then(function (ok) {
            if (!ok) return
            setClosing(function (prev) { return markClosing(prev, term.key, true) })
            post('/terminal/kill', { sessionId: sessionId, terminalId: term.terminalId })
              .then(function () {
                setTerms(function (prev) { return prev.filter(function (tm) { return tm.key !== term.key }) })
                if (activeKey === term.key) setActiveKey(null)
              })
              .catch(function (error) {
                setClosing(function (prev) { return markClosing(prev, term.key, false) })
                setMsg({ kind: 'err', text: String(error.message || error) })
              })
          })
      }

      /** Pure copy with one terminal's closing flag set or cleared. */
      function markClosing(prev, key, value) {
        var next = Object.assign({}, prev)
        if (value) next[key] = true
        else delete next[key]
        return next
      }

      function onInput(key, text, submit) {
        // one op per terminal: send (opens op) then poll its output.
        // Returns the POST promise so the caller can clear input on success.
        var opKey = key + '::' + String(++seq.current)
        latestOp.current[key] = opKey
        return post('/terminal/send', { sessionId: sessionId, terminalId: key, opKey: opKey, text: text, submit: submit })
          .then(function () {
            pollLoop(key, opKey)
          })
          .catch(function (error) {
            setMsg({ kind: 'err', text: String(error.message || error) })
            throw error
          })
      }

      function onInterrupt(key) {
        var opKey = latestOp.current[key]
        if (opKey === undefined) return
        post('/terminal/interrupt', { sessionId: sessionId, opKey: opKey }).catch(function () { /* no live op */ })
      }

      var active = null
      for (var i = 0; i < terms.length; i += 1) {
        if (terms[i].key === activeKey) { active = terms[i]; break }
      }
      if (active === null && terms.length > 0) active = terms[0]

      return h('div', { className: 'dhb-tmPage' },
        h('div', { className: 'dhb-tmBar' },
          terms.map(function (term) {
            var isClosing = closing[term.key] === true
            return h('button', {
              key: term.key,
              className: 'dhb-tmTab',
              type: 'button',
              'data-active': active !== null && active.key === term.key ? '1' : undefined,
              'data-closing': isClosing ? '1' : undefined,
              onClick: function () { setActiveKey(term.key) },
            },
              h('span', null, term.name),
              isClosing
                ? h('span', { className: 'dhb-tmSpin', role: 'status', title: t('termClosing', { name: term.name }) })
                : h('span', {
                    className: 'dhb-tmX', type: 'button', role: 'button',
                    title: t('termClose'),
                    onClick: function (e) { e.stopPropagation(); onCloseTerm(term) },
                  }, '×'),
            )
          }),
          h('button', { className: 'dhb-tmNew', type: 'button', onClick: onNew }, t('termNew')),
        ),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        active !== null
          ? h(TerminalPane, {
              t: t,
              term: active,
              onInput: onInput,
              onInterrupt: onInterrupt,
            })
          : h('div', { style: { display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' } },
              h('button', { className: 'dhb-tmNew', type: 'button', onClick: onNew }, t('termNew')),
            ),
      )
    }

    // ── model usage section ────────────────────────────────────────────────

    /** Chart palette for per-model series (stable per model id). */
    var USAGE_COLORS = ['#2f6fed', '#1e7e34', '#c0392b', '#8e44ad', '#d68910', '#00838f', '#c2185b', '#5d4037']
    function usageColorOf(model, index) {
      var hash = 0
      for (var i = 0; i < model.length; i += 1) hash = (hash * 31 + model.charCodeAt(i)) & 0xffff
      return USAGE_COLORS[index % USAGE_COLORS.length]
    }

    /**
     * Minimal donut chart: SVG conic segments via stroke-dasharray on a
     * circle (no dependencies). Props: slices [{ value, color, label }],
     * plus center totals.
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
          // Auto-fit: the inner hole spans ~2*(R - stroke/2) viewBox units;
          // digit glyphs run ~0.6*fontSize wide. Shrink until the label fits,
          // and drop the label entirely below a readable floor.
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
     * The Usage settings section (right after Models): a date-range filter,
     * per-model summary cards, a per-model stacked daily chart, the model
     * table with editable prices, a tool-usage view, and top sessions.
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

      var load = React.useCallback(function (nextRange, force) {
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
          .then(function (report) { setData({ status: 'ready', report: report, error: '' }) })
          .catch(function (error) { setData(function (prev) { return Object.assign({}, prev, { status: 'error', error: String(error.message || error) }) }) })
      }, [])

      React.useEffect(function () { load(range, false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

      /** Quick presets: 0=all, 'today', 'yesterday', 'month', or N days. */
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

      /** Set one boundary and query immediately (a picked date IS the query). */
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
          h('button', { className: 'dhb-btn', type: 'button', title: t('refresh'), onClick: function () { load(range, false) } }, '↻'),
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

    // ── session header More menu (tool panels) ─────────────────────────────

    /**
     * The ⋯ button at the end of the session header's action row: a small
     * dropdown hosting the File Changes / Terminal panels (right-docked
     * overlays, availability-gated). Hidden entirely while neither host
     * capability has resolved, so hosts without git or the terminals service
     * see no orphan button.
     */
    function SessionHeaderMore(props) {
      var t = props.t
      var kit = props.kit
      var caps = useStore(props.caps)
      useLocaleVersion()

      var openState = React.useState(false)
      var open = openState[0]
      var setOpen = openState[1]

      React.useEffect(function () {
        if (!open) return undefined
        var onDoc = function (e) {
          var el = e.target
          while (el !== null && el instanceof Element) {
            if (typeof el.className === 'string' && el.className.indexOf('dhb-smWrap') !== -1) return
            el = el.parentElement
          }
          setOpen(false)
        }
        if (typeof document !== 'undefined') {
          document.addEventListener('mousedown', onDoc)
          return function () { document.removeEventListener('mousedown', onDoc) }
        }
        return undefined
      }, [open])

      var sessionId = kit !== undefined ? kit.sessionId : undefined
      // The tools overlay is root-scoped, so the session context is captured
      // HERE (session scope, real kit) and handed over at open time: cwd for
      // the views, title for the sidebar breadcrumb. Two separate selectors
      // (string returns only) — an object return would mint a fresh snapshot
      // identity per getSnapshot call and loop useSyncExternalStore.
      var pickRow = function (pick) {
        if (kit === undefined || typeof kit.useSessions !== 'function') return ''
        return kit.useSessions(function (s) {
          var row = sessionId !== undefined && s.byId !== undefined ? s.byId[sessionId] : undefined
          return pick(row)
        })
      }
      var cwd = pickRow(function (row) { return row !== undefined && typeof row.cwd === 'string' ? row.cwd : '' })
      var title = pickRow(function (row) {
        return row !== undefined && typeof row.title === 'string' && row.title !== ''
          ? row.title
          : (sessionId !== undefined ? sessionId.slice(0, 8) : '')
      })

      function onOpenTool(panel) {
        setOpen(false)
        if (props.tools !== undefined) props.tools.open(panel, sessionId, title, cwd)
      }

      // No panel available (no git binary, no terminals service): the ⋯
      // button would open an empty menu — render nothing instead.
      if (caps.changes !== true && caps.terminal !== true) return null

      return h('div', { className: 'dhb-smWrap' },
        h('button', {
          className: 'dhb-smBtn', type: 'button',
          title: t('sessionMore'),
          'aria-label': t('sessionMore'),
          'aria-haspopup': 'menu',
          'aria-expanded': open ? 'true' : 'false',
          onClick: function (e) { e.stopPropagation(); setOpen(function (v) { return !v }) },
        },
          h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' },
            h('circle', { cx: 5, cy: 12, r: 1.6 }),
            h('circle', { cx: 12, cy: 12, r: 1.6 }),
            h('circle', { cx: 19, cy: 12, r: 1.6 }))),
        open ? h('div', { className: 'dhb-smMenu', role: 'menu' },
          caps.changes === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('changes') },
          }, h(FileDiffIcon, { size: 14 }), h('span', null, t('tabChanges'))) : null,
          caps.terminal === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('terminal') },
          }, h(TerminalIcon, { size: 14 }), h('span', null, t('tabTerminal'))) : null,
        ) : null,
      )
    }

    // ── service lifecycle (stop / restart) ────────────────────────────────

    /**
     * Controller for the dsh process stop/restart actions. The host half's
     * endpoints dispose the process after replying, so POST failures after a
     * successful confirm are EXPECTED (connection dropped) and ignored.
     * Restart polls until a new process answers, then reloads the shell.
     */
    function createServiceController() {
      var store = createStore({ phase: 'idle', available: undefined, sec: 0, cmd: '' })

      function checkAvailable() {
        api('/service/info')
          .then(function (value) {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle' || snap.phase === 'failed') {
              store.set({ phase: 'idle', available: true, sec: 0, cmd: value.command })
            }
          })
          .catch(function () {
            var snap = store.getSnapshot()
            if (snap.phase === 'idle') {
              store.set({ phase: 'idle', available: false, sec: 0, cmd: '' })
            }
          })
      }

      function stop() {
        store.set({ phase: 'stopping', available: false, sec: 0, cmd: '' })
        post('/service/stop', {}).catch(function () { /* dropped = expected */ })
        // No revival to wait for: after a grace window, show the stopped note.
        setTimeout(function () {
          var snap = store.getSnapshot()
          if (snap.phase === 'stopping') {
            store.set({ phase: 'stopped', available: false, sec: 0, cmd: '' })
          }
        }, 5000)
      }

      function restart() {
        var cmd = store.getSnapshot().cmd
        store.set({ phase: 'restarting', available: false, sec: 0, cmd: cmd })
        post('/service/restart', {}).catch(function () { /* dropped = expected */ })
        var start = Date.now()
        var tick = function () {
          var snap = store.getSnapshot()
          if (snap.phase !== 'restarting') return
          var sec = Math.round((Date.now() - start) / 1000)
          if (sec > 90) {
            store.set({ phase: 'failed', available: false, sec: sec, cmd: cmd })
            return
          }
          api('/service/info')
            .then(function () {
              // A process answered again — re-bootstrap the whole shell.
              try { window.location.reload() } catch (err) { /* manual refresh */ }
            })
            .catch(function () {
              store.set({ phase: 'restarting', available: false, sec: sec, cmd: cmd })
              setTimeout(tick, 1500)
            })
        }
        setTimeout(tick, 1500)
      }

      return { store: store, checkAvailable: checkAvailable, stop: stop, restart: restart }
    }

    /**
     * Whether a keydown happened during IME composition (Chinese/Japanese
     * input). Pressing Enter to CONFIRM a candidate fires an Enter keydown
     * with isComposing=true — treating it as submit would run a half-typed
     * command. keyCode 229 covers older engines that don't set isComposing.
     */
    function isComposing(e) {
      var native = e.nativeEvent !== undefined ? e.nativeEvent : e
      return native.isComposing === true || native.keyCode === 229
    }

    /** Line-icon glyphs matching the sidebar's 16/18px outline rhythm. */
    function PowerIcon(props) {
      return h('svg', {
        width: props.size, height: props.size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M12 3v9' }),
        h('path', { d: 'M18.4 6.6a9 9 0 1 1-12.8 0' }))
    }

    function RestartIcon(props) {
      return h('svg', {
        width: props.size, height: props.size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
        h('path', { d: 'M21 3v6h-6' }))
    }

    /** File glyph with diff markers (+ over −): the Changes panel is a
     * read-only git diff view, so the file body carries add/remove markers —
     * NOT a "new file" plus. */
    function FileDiffIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        h('polyline', { points: '14 2 14 8 20 8' }),
        h('line', { x1: 12, y1: 10, x2: 12, y2: 14 }),
        h('line', { x1: 10, y1: 12, x2: 14, y2: 12 }),
        h('line', { x1: 9, y1: 17, x2: 15, y2: 17 }))
    }

    /** Classic terminal glyph (>_). */
    function TerminalIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('polyline', { points: '4 17 10 11 4 5' }),
        h('line', { x1: 12, y1: 19, x2: 20, y2: 19 }))
    }

    /**
     * Opaque backdrop painted INSIDE footerActions: an absolutely-positioned
     * sheet with fixed generous insets (down through the official settings
     * row, up over the scroller's bottom edge). No measurement loop — pure
     * CSS geometry relative to our own container. Every ancestor repaint
     * over the footer becomes pixel-identical (solid color both sides of
     * the subpixel edge), so the flickering lines cannot appear.
     */
    function FooterBackdrop() {
      var colorState = React.useState(null)
      var color = colorState[0]
      var setColor = colorState[1]
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var read = function () {
          // The sidebar column's OWN background color — whatever theme/token
          // it resolves to — read once from the live DOM so the sheet is
          // pixel-identical to what paints around it.
          var wrap = document.querySelector('.dhb-svcWrap')
          if (wrap === null) return
          var col = wrap
          while (col !== null && col.parentElement !== null) {
            const cs = getComputedStyle(col)
            if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') break
            col = col.parentElement
          }
          if (col === null) return
          var bg = getComputedStyle(col).backgroundColor
          setColor(function (prev) { return prev === bg ? prev : bg })
        }
        read()
        var t = setInterval(read, 2000)
        return function () { clearInterval(t) }
      }, [])
      if (color === null) return null
      return h('div', { style: { position: 'relative', height: 0, width: '100%' } },
        h('div', { className: 'dhb-svcBackdrop', style: { background: color } }))
    }

    /**
     * Stop/restart controls beside Settings (sidebar.footer.action). Two
     * shapes follow the sidebar's own rhythm: wide column = two 34px rows
     * sharing the settings trigger's 12px radius + hover wash; 56px rail =
     * stacked 36px circles like the rail settings trigger.
     */
    function ServiceFooterActions(props) {
      var t = props.t
      var controller = props.controller
      var wide = props.wide !== false
      var snap = useStore(controller.store)

      React.useEffect(function () { controller.checkAvailable() }, [controller])

      var avail = snap.available === true
      var busyPhase = snap.phase !== 'idle' && snap.phase !== 'failed'

      function onAction(kind) {
        var isStop = kind === 'stop'
        showConfirm(
          t(isStop ? 'confirmStopSvc' : 'confirmRestartSvc'),
          { okLabel: t(isStop ? 'serviceStop' : 'serviceRestart'), danger: isStop },
        )
          .then(function (ok) {
            if (!ok) return
            if (isStop) controller.stop()
            else controller.restart()
          })
      }

      var stopBtn = h('button', {
        className: (wide ? 'dhb-svcBtn dhb-svcStop' : 'dhb-svcRail dhb-svcStop'),
        type: 'button',
        disabled: !avail || busyPhase,
        title: avail ? t('serviceStopTitle') : t('svcUnavailable'),
        'aria-label': t('serviceStop'),
        onClick: function () { onAction('stop') },
      },
        h(PowerIcon, { size: wide ? 15 : 18 }),
        wide ? h('span', null, t('serviceStop')) : null)

      var restartBtn = h('button', {
        className: wide ? 'dhb-svcBtn' : 'dhb-svcRail',
        type: 'button',
        disabled: !avail || busyPhase,
        title: avail ? t('serviceRestartTitle') : t('svcUnavailable'),
        'aria-label': t('serviceRestart'),
        onClick: function () { onAction('restart') },
      },
        h(RestartIcon, { size: wide ? 15 : 18 }),
        wide ? h('span', null, t('serviceRestart')) : null)

      return wide
        ? h('div', { className: 'dhb-svcWrap' }, stopBtn, restartBtn)
        : h('div', { className: 'dhb-svcRailWrap' }, stopBtn, restartBtn)
    }

    /** Full-screen status card while a stop/restart is in flight. */
    function ServiceOverlay(props) {
      var t = props.t
      var snap = useStore(props.controller.store)
      if (snap.phase === 'idle') return null
      var text
      var spinning = false
      if (snap.phase === 'stopping') { text = t('svcStopping'); spinning = true }
      else if (snap.phase === 'stopped') { text = t('svcStopped') }
      else if (snap.phase === 'restarting') {
        spinning = true
        text = snap.sec > 0 ? t('svcRestartWait', { sec: snap.sec }) : t('svcRestarting')
      } else { // failed
        text = t('svcRestartFailed', { cmd: snap.cmd !== '' ? snap.cmd : 'pnpm dsh web' })
      }
      return h('div', { className: 'dhb-svcOverlay' },
        h('div', { className: 'dhb-svcCard' },
          spinning ? h('div', { className: 'dhb-svcSpin' }) : null,
          h('div', null, text)))
    }

    // ── tools overlay (File Changes / Terminal panels) ────────────────────

    /**
     * Controller for the ⋯ menu's tool panels. The overlay lives at ROOT
     * scope (shell.overlay) where no session kit exists, so the opening menu
     * captures {sessionId, sessionTitle, cwd} at click time and the overlay
     * feeds the embedded view a synthetic kit — both views only consume
     * sessionId and useSessions(selector → row.cwd). The sessionTitle feeds
     * the sidebar breadcrumb; switch() keeps the captured context while
     * changing panels.
     */
    function createToolsController() {
      var store = createStore({ panel: null, sessionId: undefined, sessionTitle: '', cwd: '' })
      return {
        store: store,
        open: function (panel, sessionId, sessionTitle, cwd) {
          store.set({
            panel: panel,
            sessionId: sessionId,
            sessionTitle: typeof sessionTitle === 'string' ? sessionTitle : '',
            cwd: typeof cwd === 'string' ? cwd : '',
          })
        },
        switch: function (panel) {
          var snap = store.getSnapshot()
          if (snap.panel === panel) return
          store.set({ panel: panel, sessionId: snap.sessionId, sessionTitle: snap.sessionTitle, cwd: snap.cwd })
        },
        close: function () {
          store.set({ panel: null, sessionId: undefined, sessionTitle: '', cwd: '' })
        },
      }
    }

    /**
     * Right-docked non-modal panel hosting File Changes or Terminal, opened
     * from the session header ⋯ menu instead of the conversation tab ring
     * (the tab bar stays free of plugin entries). TRUE DOCK, not a floating
     * sheet: while open, the app frame (the shell's three-column grid) is
     * squeezed by the panel width through an inline margin, so the chat
     * column genuinely narrows and the fixed-position panel occupies the
     * freed strip at the viewport's right edge — nothing overlaps. The
     * frame is located through the shell's stable `[data-shell-overlay]`
     * marker (its parent); if that anchor ever disappears the margin step
     * is skipped and the panel merely floats again (graceful fallback).
     * Layout: a drag handle on the dock's left edge (width 360–760px, the
     * frame margin follows the drag), a TOP bar — breadcrumb (session
     * title › current panel) with the close button — over a horizontal tool
     * nav row (File Changes / Terminal, switching panels in place) — and
     * the main area with the active view. Esc closes; unmounting stops the
     * terminal pollers through the view's own cleanup. z-index 1500: above
     * the service card (1000), below the confirm dialog (2000) so in-panel
     * confirms stay visible.
     */
    function ToolsOverlay(props) {
      var t = props.t
      var caps = useStore(props.caps)
      useLocaleVersion()
      var snap = useStore(props.controller.store)

      var widthState = React.useState(520)
      var width = widthState[0]
      var setWidth = widthState[1]

      React.useEffect(function () {
        if (snap.panel === null) return undefined
        var onKey = function (e) { if (e.key === 'Escape') props.controller.close() }
        if (typeof document !== 'undefined') {
          document.addEventListener('keydown', onKey)
          return function () { document.removeEventListener('keydown', onKey) }
        }
        return undefined
      }, [snap.panel, props.controller])

      // Dock squeeze: narrow the shell frame by the panel width so the chat
      // reflows instead of being covered. The frame's own ResizeObserver
      // re-solves its grid columns for the reduced width. Re-runs on every
      // width change (drag); cleanup restores the previous inline margin.
      // The margin mirrors the CSS max-width clamp (tiny viewports) so the
      // freed strip always matches the rendered panel exactly.
      React.useEffect(function () {
        if (snap.panel === null) return undefined
        if (typeof document === 'undefined') return undefined
        var layer = document.querySelector('[data-shell-overlay]')
        var frame = layer !== null ? layer.parentElement : null
        if (frame === null || frame === undefined) return undefined
        var vw = typeof window !== 'undefined' ? window.innerWidth : 0
        var effective = vw > 0 && width > vw - 56 ? vw - 56 : width
        var prev = frame.style.marginRight
        frame.style.marginRight = effective + 'px'
        return function () { frame.style.marginRight = prev }
      }, [snap.panel, width])

      if (snap.panel === null) return null

      // A panel whose capability vanished (probe raced negative, service
      // went away) falls back to the other one; neither → close.
      var panel = snap.panel
      if (panel === 'changes' && caps.changes !== true) panel = caps.terminal === true ? 'terminal' : null
      else if (panel === 'terminal' && caps.terminal !== true) panel = caps.changes === true ? 'changes' : null
      if (panel === null) return null

      var sessionLabel = snap.sessionTitle !== ''
        ? snap.sessionTitle
        : (snap.sessionId !== undefined ? snap.sessionId.slice(0, 8) : '—')

      var changesIcon = h(FileDiffIcon, { size: 15 })
      var terminalIcon = h(TerminalIcon, { size: 15 })

      var navItem = function (key, label, icon) {
        return h('button', {
          className: 'dhb-toolsNavItem', type: 'button',
          'data-active': panel === key ? '1' : '0',
          onClick: function () { props.controller.switch(key) },
        }, icon, h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, label))
      }

      var fakeKit = {
        sessionId: snap.sessionId,
        useSessions: function (selector) {
          var byId = {}
          if (snap.sessionId !== undefined) byId[snap.sessionId] = { cwd: snap.cwd }
          return selector({ byId: byId })
        },
      }

      var panelLabel = t(panel === 'terminal' ? 'tabTerminal' : 'tabChanges')

      // Left-edge drag resize: pointer x → dock width (clamped 360–760).
      // Listeners live on document for the drag's lifetime only.
      function startResize(e) {
        if (typeof document === 'undefined') return
        e.preventDefault()
        var onMove = function (ev) {
          var w = window.innerWidth - ev.clientX
          if (w < 360) w = 360
          if (w > 760) w = 760
          setWidth(w)
        }
        var onUp = function () {
          document.removeEventListener('mousemove', onMove)
          document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
      }

      return h('div', { className: 'dhb-toolsDock', style: { width: width + 'px' } },
        h('div', {
          className: 'dhb-toolsResize', role: 'separator', 'aria-orientation': 'vertical',
          title: t('toolsResize'),
          onMouseDown: startResize,
        }),
        h('div', { className: 'dhb-toolsMain' },
          h('div', { className: 'dhb-toolsHead' },
            h('div', { className: 'dhb-toolsCrumb', title: sessionLabel + ' / ' + panelLabel },
              h('span', { className: 'dhb-toolsCrumbSess' }, sessionLabel),
              h('span', { className: 'dhb-toolsCrumbSep' }, '/'),
              h('span', { className: 'dhb-toolsCrumbCur' }, panelLabel)),
            h('button', { className: 'dhb-btn', type: 'button', onClick: props.controller.close }, t('toolsClose')),
          ),
          h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('sessionMore') },
            caps.changes === true ? navItem('changes', t('tabChanges'), changesIcon) : null,
            caps.terminal === true ? navItem('terminal', t('tabTerminal'), terminalIcon) : null,
          ),
          h('div', { className: 'dhb-toolsBody' },
            panel === 'terminal'
              ? h(TerminalView, { t: t, kit: fakeKit })
              : h(ChangesView, { t: t, kit: fakeKit }),
          ),
        ),
      )
    }

    // ── settings nav icons (DOM patch) ────────────────────────────────────

    /**
     * The settings shell (ui-settings-general SettingsRoot) draws nav icons
     * from a HARDCODED id→icon map that covers only the core sections
     * (models / agent-presets / plugins); every other row — including all
     * five of this plugin's sections — falls back to the same settings
     * gear, and the section slot contract carries no icon field. This patch
     * differentiates OUR rows: a MutationObserver watches for the settings
     * dialog, matches nav buttons by their CURRENT localized label (so
     * locale switches re-resolve), and for each match inserts our 16px
     * outline glyph BEFORE the shell's gear while hiding the gear — insert +
     * hide, never remove, so React's own reconciliation of that subtree
     * stays intact (React only ever removes the gear node it created, which
     * remains in place; a re-render that recreates it is simply re-patched
     * by the observer). Core sections never match our label set and keep
     * their shell-owned icons.
     */
    var SECTION_NAV_ICONS = {
      usage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M7 20v-6"/><path d="M12 20V9"/><path d="M17 20V4"/></svg>',
      prompt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
      mcp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/><path d="M7 7h10v4a5 5 0 0 1-10 0z"/><line x1="12" y1="16" x2="12" y2="21"/></svg>',
      skills: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.2"/></svg>',
      sessions: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>',
      mobile: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>',
    }

    /** Section key → the i18n key whose CURRENT value is the nav label. */
    var SECTION_NAV_LABEL_KEYS = {
      usage: 'sectionUsage',
      prompt: 'sectionPrompt',
      mcp: 'sectionMcp',
      skills: 'sectionSkills',
      sessions: 'sectionSessions',
      mobile: 'sectionMobile',
    }

    /** One scan pass: patch every matching nav button inside open dialogs.
     * Idempotence is decided by SCANNING the button's svgs for our marker —
     * NOT by "svg before the gear": after the first pass our icon IS the
     * first svg, so a previousSibling probe would never match again and the
     * observer (which fires on our own insertions) would re-patch every
     * frame, leaking one hidden node per pass. */
    function patchSettingsNavIcons(t) {
      var dialogs = document.querySelectorAll('div[role="dialog"]')
      for (var d = 0; d < dialogs.length; d += 1) {
        // Mobile adaptation hooks: tag the settings panel + its nav/options
        // so the plugin stylesheet can reflow them on phone widths without
        // touching harness source (class names are CSS-module hashed; these
        // structural tags are stable). Re-tagged every pass — idempotent.
        var nav = dialogs[d].querySelector('nav')
        if (nav !== null) {
          dialogs[d].setAttribute('data-dhb-settings-panel', '1')
          nav.setAttribute('data-dhb-settings-nav', '1')
          var content = nav.nextElementSibling
          // content's element children are exactly [header, options] —
          // children (not querySelectorAll) avoids matching nested leaves.
          if (content !== null) {
            // Column-flip fix: the shell sized .content with min-width:0
            // only (row layout — height was never flex-distributed). In the
            // mobile column layout min-height:auto floors it at content
            // height, overflowing the panel and killing options scrolling.
            content.setAttribute('data-dhb-settings-content', '1')
            if (content.children.length > 1) {
              content.children[content.children.length - 1].setAttribute('data-dhb-settings-options', '1')
            }
          }
        }
        var buttons = dialogs[d].querySelectorAll('button')
        for (var i = 0; i < buttons.length; i += 1) {
          var button = buttons[i]
          var span = button.querySelector('span')
          if (span === null) continue
          var label = (span.textContent || '').trim()
          var matched = null
          for (var key in SECTION_NAV_LABEL_KEYS) {
            if (label === t(SECTION_NAV_LABEL_KEYS[key])) { matched = key; break }
          }
          if (matched === null) continue
          var svgs = button.querySelectorAll('svg')
          if (svgs.length === 0) continue
          var mine = null
          for (var s = 0; s < svgs.length; s += 1) {
            var node = svgs[s]
            if (mine === null && node.getAttribute('data-dhb-nav') === matched) mine = node
            else node.style.display = 'none' // the shell's gear, or a stale duplicate
          }
          if (mine !== null) continue // already patched
          svgs[0].insertAdjacentHTML('beforebegin', SECTION_NAV_ICONS[matched])
          var inserted = svgs[0].previousSibling
          if (inserted !== null && inserted.nodeType === 1) inserted.setAttribute('data-dhb-nav', matched)
        }
      }
    }

    /** Install the settings-nav icon patcher; returns its disposer. */
    function installSettingsNavIcons(t) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return function () {}
      }
      var scheduled = false
      var schedule = function () {
        if (scheduled) return
        scheduled = true
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(function () { scheduled = false; patchSettingsNavIcons(t) })
        } else {
          setTimeout(function () { scheduled = false; patchSettingsNavIcons(t) }, 16)
        }
      }
      var observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })
      schedule()
      return function () { observer.disconnect() }
    }

    // ── plugin apply ──────────────────────────────────────────────────────

    var inject = ['slots']

    async function apply(ctx) {
      var slots = ctx.get('slots')
      if (slots === undefined) return

      var disposeStyles = injectStyles()

      var locale = ctx.get('locale')
      var t = fallbackT
      var localeDisposers = []
      if (locale !== undefined && typeof locale.register === 'function' && typeof locale.bind === 'function') {
        localeDisposers.push(locale.register('dsh-base-plugin', 'zh', ZH))
        localeDisposers.push(locale.register('dsh-base-plugin', 'en', EN))
        t = locale.bind('dsh-base-plugin')
        if (typeof locale.subscribe === 'function') {
          localeDisposers.push(locale.subscribe(function () { bumpLocale() }))
        }
      }
      currentT = t

      var serviceController = createServiceController()
      var toolsController = createToolsController()

      // Settings nav icons: differentiate our five sections from the shell's
      // gear fallback (label-matched DOM patch; see installSettingsNavIcons).
      var disposeNavIcons = installSettingsNavIcons(t)

      // Availability of the ⋯ menu's tool panels, probed from the host half
      // (git binary / mounted terminals service). A store, not apply-time
      // consts: the probes resolve after the menu may already be mounted.
      var capabilities = createStore({ changes: false, terminal: false })
      api('/git/available')
        .then(function (value) { capabilities.set({ changes: value.available === true, terminal: capabilities.getSnapshot().terminal }) })
        .catch(function () { /* older host half: entry stays hidden */ })
      api('/terminal/available')
        .then(function (value) { capabilities.set({ changes: capabilities.getSnapshot().changes, terminal: value.available === true }) })
        .catch(function () { /* terminals service not mounted: entry stays hidden */ })

      // Session header ⋯ menu (tool panels + delete session) — the
      // RIGHT-ALIGNED utilities row (titleRow's right end), not the
      // title-adjacent actions group: visually the header's top-right corner,
      // on the same line as the title rather than squeezed beside the
      // breadcrumbs.
      var disposeHeaderMore = slots.inject('conversation.session.header.utilities', function () {
        return slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'dsh-base-plugin-session-more',
            order: 100,
            label: 'Session more',
            registrant: 'dsh-base-plugin',
          },
          function (kit) {
            return h(SessionHeaderMore, { t: t, kit: kit, caps: capabilities, tools: toolsController })
          },
        )
      })

      // File Changes / Terminal panels ride the ⋯ menu + right-docked panel
      // above (ToolsOverlay) — NOT the conversation.view tab ring, so the tab
      // bar keeps only the shell's own tabs (chat / trajectory).
      var disposeTools = slots.inject('shell.overlay', function () {
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-tools',
            order: 205, // above the service status card (200), below confirm (210)
            label: 'Tools overlay',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ToolsOverlay, { t: t, caps: capabilities, controller: toolsController }) },
        )
      })

      // Opaque footer backdrop (flicker fix): first footer action entry,
      // an absolute sheet painted under the whole footer strip.
      var disposeFooterBackdrop = slots.inject('sidebar.footer.action', function () {
        return slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-base-plugin-footer-backdrop',
            order: -1000,
            label: 'Footer backdrop',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(FooterBackdrop) },
        )
      })

      // In-app confirm dialog (themable replacement for window.confirm),
      // mounted above every page: the market tab, settings sections, and the
      // sidebar footer buttons all await showConfirm through this card.
      var disposeConfirm = slots.inject('shell.overlay', function () {
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-confirm',
            order: 210,
            label: 'Confirm',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ConfirmDialog) },
        )
      })

      // Stop/Restart buttons beside Settings at the sidebar foot. The owner
      // passes `wide` (false = 56px rail), switching row vs circle shapes.
      var disposeSvcActions = slots.inject('sidebar.footer.action', function () {
        return slots.register(
          {
            name: 'sidebar.footer.action',
            id: 'dsh-base-plugin-service',
            order: 10,
            label: 'Service',
            registrant: 'dsh-base-plugin',
          },
          function (ownerProps) {
            return h(ServiceFooterActions, {
              t: t,
              controller: serviceController,
              wide: ownerProps !== null && typeof ownerProps === 'object' && ownerProps.wide === false ? false : true,
            })
          },
        )
      })

      // Full-screen status card while stopping/restarting.
      var disposeSvcOverlay = slots.inject('shell.overlay', function () {
        return slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-base-plugin-service',
            order: 200,
            label: 'Service status',
            registrant: 'dsh-base-plugin',
          },
          function () { return h(ServiceOverlay, { t: t, controller: serviceController }) },
        )
      })

      var disposeMarket = slots.inject('settings.plugins.tab', function () {
        return slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'market',
            order: 80,
            label: function () { return t('tabMarket') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(MarketTab, { t: t }) },
        )
      })

      var disposeUsage = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-usage',
            order: 11, // right after Models (order 10)
            label: function () { return t('sectionUsage') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(UsageSection, { t: t }) },
        )
      })

      var disposePrompt = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-prompt',
            order: 199,
            label: function () { return t('sectionPrompt') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(PromptSection, { t: t }) },
        )
      })

      var disposeMcp = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-mcp',
            order: 200,
            label: function () { return t('sectionMcp') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(McpSection, { t: t }) },
        )
      })

      var disposeSkills = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-skills',
            order: 201,
            label: function () { return t('sectionSkills') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(SkillsSection, { t: t }) },
        )
      })

      var disposeSessions = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-sessions',
            order: 202,
            label: function () { return t('sectionSessions') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(SessionsSection, { t: t }) },
        )
      })

      var disposeMobile = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-mobile',
            order: 203,
            label: function () { return t('sectionMobile') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(MobileSection, { t: t }) },
        )
      })

      ctx.effect(function () {
        return function () {
          if (disposeStyles !== undefined) disposeStyles()
          disposeSvcActions()
          disposeSvcOverlay()
          disposeFooterBackdrop()
          disposeConfirm()
          disposeHeaderMore()
          disposeTools()
          disposeUsage()
          disposeMarket()
          disposePrompt()
          disposeMcp()
          disposeSkills()
          disposeNavIcons()
          disposeSessions()
          disposeMobile()
          for (var j = 0; j < localeDisposers.length; j += 1) {
            var dispose = localeDisposers[j]
            if (typeof dispose === 'function') dispose()
          }
        }
      }, 'dsh-base-plugin: contributions')
    }

    exports.name = 'dsh-base-plugin'
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
