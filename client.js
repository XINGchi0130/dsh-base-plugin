/**
 * dsh-base-plugin — browser bundle.
 *
 * 手写遵循 web boot 协议格式（无构建步骤）：向 window.__ModuleLoader__
 * 注册工厂，模块导出即 cordis 插件。React 经加载器模块表解析。
 *
 * 贡献面（全部文案经 DSH locale 服务做中英双语——语言跟随设置页的
 * 语言选项）：
 *
 * 1. `settings.plugins.tab` 注册项 id `market` —— 插件设置区里的
 *    「插件市场」标签页（GitHub 搜索 + 经宿主半 HTTP API 一键安装/卸载）。
 * 2. `settings.section` 注册项 id `dsh-base-plugin-mcp` —— MCP 设置页
 *    （实时状态 + YAML 直接编辑；保存即热加载）。
 * 3. `settings.section` 注册项 id `dsh-base-plugin-skills` —— 技能页
 *    （列表 + 内容查看；`~/.dsh/skills` 下的技能可编辑/新建）。
 * 4. `settings.section` 注册项 id `dsh-base-plugin-prompt` —— 全局系统
 *    提示词页（persona 覆盖；保存热加载，置空恢复默认）。
 * 5. `sidebar.footer.action` 注册项 id `dsh-base-plugin-service` —— 设置
 *    旁的停止/重启按钮（宿主优雅退出；重启按原命令行 re-exec，回来后
 *    页面自刷新，期间显示 `shell.overlay` 状态卡）。
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
 * 7. Conversation message rail (no slot — DOM-level): slim floating ticks
 *    beside the chat column's native scrollbar (the harness's own themed
 *    scrollbar skin stays untouched) — one per user (blue) / AI (green)
 *    message, positioned proportionally; clicking a tick jumps to that
 *    message, hovering shows a content-only excerpt (chrome-free: clock,
 *    run stats, and button labels are structurally skipped), and the tick
 *    nearest the viewport stays highlighted while scrolling. The rail draws
 *    no track or viewport capsule of its own (the native scrollbar beside it
 *    already shows position). Mount-tracked via a body observer; fully
 *    disposable.
 *
 * 单文件是协议约束而非选择：web boot 加载器为每个包只物化一个工厂
 * （无打包器、无相对导入——`require` 只能触达平台模块表），因此本文件
 * 用分区横幅代替模块切分。分区顺序：i18n 词典 → store/api/styles
 * 辅助 → MarketTab → McpSection → SkillsSection → plugin apply。
 */
// GENERATED from src/* by scripts/build-client.mjs — edit src/, then rebuild. stamp:c8246a3fcdfb
window.__ModuleLoader__.load({
  id: 'dsh-base-plugin',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    // ── i18n 词典 ─────────────────────────────────────────────────────────

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
      noResults: '没有找到匹配的仓库。试试英文关键词，或清空搜索框浏览全部 topic 认证插件。',
      topicVerified: 'topic 认证',
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
      mcpHealthTitle: '健康面板',
      mcpHealthEmpty: '尚无 MCP 工具调用记录——配好多服务器后，通过它们的调用会在这里累积统计。',
      mcpHealthUnavailable: '健康数据不可用（宿主半为旧版本或日志服务缺席）。',
      mcpHealthNote: '统计自全部会话日志（tool 流量按 mcp__服务器__ 前缀聚合，增量扫描）——回答「这台到底值不值得留」。',
      mcpCalls: '{n} 次调用',
      mcpErrorRate: '失败率',
      mcpAvgLatency: '平均延迟',
      mcpLastUsed: '最近使用',
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
      tabMonitor: '监控',
      monNoSession: '未选择会话——从会话头部的 ⋯ 菜单打开监控。',
      monUnavailable: '该会话暂无统计数据。发出第一条消息后即可看到。',
      monLive: '会话进行中',
      monCold: '未在当前进程打开（读自持久化日志）',
      monRounds: '轮次与步骤',
      monTurns: '轮',
      monSteps: '步',
      monRequests: '{n} 次模型请求',
      monTimes: '耗时',
      monLlmLabel: '模型',
      monToolLabel: '工具',
      monTtftLabel: '首 token 平均',
      monContextTitle: '上下文水位',
      monContextUsed: '已用 {pct}%',
      monCtxSystem: '系统提示词',
      monCtxTools: '工具',
      monCtxMessages: '对话消息',
      monCtxNote: '构成为启发式估值（官方 contextBreakdown），与占比分母不同源。',
      monContextHigh: '即将写满，建议开新会话',
      monTokenTitle: 'Token 用量',
      monInput: '输入',
      monOutput: '输出',
      monCacheHit: '缓存命中',
      monCacheWrite: '缓存写入',
      monReasoning: '思考',
      monIntro: '统计来自官方整日志投影与 token 折叠，每 5 秒自动刷新；点击刷新立即更新。',
      monPanelTitle: '监控标签页',
      monTabOverview: '概览',
      monTabTasks: '任务',
      monTabSystem: '系统',
      monSysCpu: 'CPU',
      monSysCpuOf: '({n} 核)',
      monSysProcCpu: 'dsh 进程',
      monSysLoad: '负载(1/5/15分)',
      monSysMem: '内存',
      monSysProcMem: '进程内存',
      monSysUptime: '运行时长',
      monSysOsUptime: '系统',
      monSysCached: '可回收缓存',
      monSysPressureNote: '随时可让给应用，不计入压力',
      monSysNote: 'CPU 为差分采样（首答为空，约 4 秒后有值），进程 CPU 为占单核百分比（与 top 一致）；内存为压力口径（已扣除可回收缓存——macOS 下文件缓存不计为占用）。',
      monTasksUnavailable: '任务与子代理服务均未挂载。',
      monJobsTitle: '任务',
      monJobsRunning: '运行中 {n}',
      monJobsDone: '已结束 {n}',
      monNoJobs: '无后台任务。',
      monJobRunning: '运行中',
      monJobStatus: '{status}',
      monJobsColdNote: '任务是进程内的——会话未在当前进程打开时不显示。',
      monSubagentsTitle: '子代理',
      monSubTotal: '共 {n} 个',
      monSubRunning: '运行中 {n}',
      monNoSubagents: '无子代理。',
      monSubUnreadable: '子会话日志不可读',
      monSubContinuable: '可续聊',
      monSubOneShot: '一次性',
      monSubStateRunning: '运行中',
      monSubInactive: '已结束',
      sectionNotify: '通知',
      ntfIntro: '把 dsh 的事件推到手机：回合结束、后台任务完结、审批等待。支持 Bark（iOS）、ntfy（跨平台）与通用 webhook（飞书/钉钉/企业微信自定义机器人等）。',
      ntfEnable: '启用通知桥',
      ntfChannelLabel: '渠道',
      ntfChannelBark: 'Bark',
      ntfChannelNtfy: 'ntfy',
      ntfChannelWebhook: 'Webhook',
      ntfUrlLabel: '服务器 / Webhook URL',
      ntfUrlPlaceholder: 'Bark/ntfy 自建服务器，或 webhook 完整 URL',
      ntfUrlHint: 'Bark 与 ntfy 留空用官方服务；webhook 填完整 URL。URL 含 {title}/{body} 时按模板 GET，否则 POST JSON {title, body}。',
      ntfBarkKeyLabel: 'Bark 设备 Key',
      ntfBarkKeyHint: 'Bark App 里复制的那串 key；用自建服务器时可为空。',
      ntfTopicLabel: 'ntfy Topic',
      ntfTopicHint: '订阅名，手机 ntfy 应用里订阅同名 topic。',
      ntfEventsLabel: '通知事件',
      ntfEventTurnEnd: '回合结束（长任务完成信号）',
      ntfEventJobs: '后台任务完结（含失败）',
      ntfEventApprovals: '审批等待（需要你批准工具调用）',
      ntfEventContext: '上下文将满（≥85%，建议开新会话）',
      ntfTestBtn: '发送测试',
      ntfTestOk: '测试通知已发出——手机上应该收到了。',
      ntfQuietBtn: '静音 1 小时',
      ntfQuietCancel: '取消静音',
      ntfQuietOn: '已静音 {n} 分钟。',
      ntfQuietOff: '已取消静音。',
      ntfQuietActive: '通知处于静音窗口——事件不会推送。',
      ntfSaved: '通知配置已保存，即时生效。',
      ntfSecurityNote: '提示：Bark/ntfy 官方服务经公网中转；webhook URL 与设备 key 等同于凭据，请勿泄露。',
      foTabsLabel: '文件变更标签页',
      foTabGit: '工作区变更',
      foTabHistory: '操作记录',
      foIntro: 'AI 的操作轨迹：write/edit（带 diff）、read 探查、bash 执行',
      foEmpty: '本会话暂无操作记录——AI 读写文件或执行命令后，这里会按目标分组记录每次操作。',
      foOpsCount: '次操作',
      foTruncated: '仅显示最近 {n} 条',
      foMoreGroups: '加载更多（还有 {n} 个目标）',
      foRan: '执行',
      foDiffEvicted: '该操作的 diff 已超出保留窗口（仅最近 200 条完整保留）。',
      foNoSession: '未选择会话。',
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
      mobileCurrentAddress: '当前地址',
      mobileAddressHint: '手机请使用下面的地址访问。若 IP 变化（DHCP 重新分配），旧书签会失效——建议在路由器上为本机绑定静态 IP。',
      mobileNoLan: '未检测到局域网 IP（可在手机浏览器手动输入地址）',
      mobileDevices: '已配对设备',
      mobileNoDevices: '暂无已配对设备。',
      mobileRevoke: '移除',
      mobileRotate: '轮换密钥（断开所有设备）',
      mobileRotateConfirm: '轮换签名密钥？所有已配对手机将立即失联，需要重新扫码配对。',
      mobileLastSeen: '最近活跃',
      mobilePairedAt: '配对时间',
      mobileApply: '应用',
      mobileEnabled: '已启用手机访问',
      mobileDisabled: '已关闭手机访问',
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
      tmBtn: '回到过去',
      tmHint: '按轮次分叉此会话：从任意一轮创建副本继续',
      tmTitle: '时间机器',
      tmIntro: '从「{name}」的任意一轮创建分叉副本——官方 fork 原语，子会话即时出现在侧栏。',
      tmTurnLabel: '第 {n} 轮',
      tmForkHere: '从此轮分叉',
      tmForked: '已创建分叉 {id}…——侧栏应已出现新会话。',
      tmCold: '该会话未在当前进程打开（fork 需要活跃会话）——先在聊天里打开它再回来分叉。',
      tmNoTurns: '没有已完成的轮次可分叉。',
      sessExportMd: '导出 MD',
      sessExportMdHint: '下载可读的 Markdown 转写（用户/助手/工具调用）',
      sessExportZip: '导出 Zip',
      sessExportZipHint: '官方全量导出：完整日志与附件，zip 包',
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
      noResults: 'No matching repositories. Try English keywords, or clear the search box to browse all topic-verified plugins.',
      topicVerified: 'topic verified',
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
      mcpHealthTitle: 'Health',
      mcpHealthEmpty: 'No MCP tool calls recorded yet — once servers are configured, calls through them accumulate here.',
      mcpHealthUnavailable: 'Health data unavailable (older host half or the log service is absent).',
      mcpHealthNote: 'Aggregated from every session log (tool traffic grouped by the mcp__server__ prefix, incremental scan) — answers "is this server worth keeping".',
      mcpCalls: '{n} calls',
      mcpErrorRate: 'Error rate',
      mcpAvgLatency: 'Avg latency',
      mcpLastUsed: 'Last used',
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
      tabMonitor: 'Monitor',
      monNoSession: 'No session selected — open Monitor from the session header ⋯ menu.',
      monUnavailable: 'No stats for this session yet. Send the first message to see figures.',
      monLive: 'session in progress',
      monCold: 'not open in this process (read from the durable log)',
      monRounds: 'Turns & Steps',
      monTurns: 'turns',
      monSteps: 'steps',
      monRequests: '{n} model requests',
      monTimes: 'Wall time',
      monLlmLabel: 'LLM',
      monToolLabel: 'tools',
      monTtftLabel: 'avg first token',
      monContextTitle: 'Context pressure',
      monContextUsed: '{pct}% used',
      monCtxSystem: 'System prompt',
      monCtxTools: 'Tools',
      monCtxMessages: 'Messages',
      monCtxNote: 'Composition is heuristic (the official contextBreakdown) and not the same denominator as the ratio.',
      monContextHigh: 'nearly full — consider a new session',
      monTokenTitle: 'Token usage',
      monInput: 'input',
      monOutput: 'output',
      monCacheHit: 'cache hit',
      monCacheWrite: 'cache write',
      monReasoning: 'reasoning',
      monIntro: 'Figures come from the official whole-log projection plus a token fold; auto-refreshes every 5s — click refresh for an immediate update.',
      monPanelTitle: 'Monitor tabs',
      monTabOverview: 'Overview',
      monTabTasks: 'Tasks',
      monTabSystem: 'System',
      monSysCpu: 'CPU',
      monSysCpuOf: '({n} cores)',
      monSysProcCpu: 'dsh process',
      monSysLoad: 'load (1/5/15m)',
      monSysMem: 'Memory',
      monSysProcMem: 'process memory',
      monSysUptime: 'Uptime',
      monSysOsUptime: 'OS',
      monSysCached: 'Reclaimable cache',
      monSysPressureNote: 'yielded to apps on demand, not counted as pressure',
      monSysNote: 'CPU is delta-sampled (empty on first answer, value ~4s later), process CPU is per-core percentage (like top); memory is pressure-based (reclaimable cache excluded — file cache on macOS is not counted as usage).',
      monTasksUnavailable: 'Neither the jobs nor the subagents service is mounted.',
      monJobsTitle: 'Jobs',
      monJobsRunning: '{n} running',
      monJobsDone: '{n} settled',
      monNoJobs: 'No background jobs.',
      monJobRunning: 'running',
      monJobStatus: '{status}',
      monJobsColdNote: 'Jobs live in-process — hidden while the session is not open here.',
      monSubagentsTitle: 'Subagents',
      monSubTotal: '{n} total',
      monSubRunning: '{n} running',
      monNoSubagents: 'No subagents.',
      monSubUnreadable: 'child log unreadable',
      monSubContinuable: 'continuable',
      monSubOneShot: 'one-shot',
      monSubStateRunning: 'running',
      monSubInactive: 'done',
      sectionNotify: 'Notifications',
      ntfIntro: 'Push dsh events to your phone: turn finished, background job settled, approval waiting. Channels: Bark (iOS), ntfy (cross-platform), and a generic webhook (Feishu/DingTalk/WeCom custom bots and friends).',
      ntfEnable: 'Enable the notification bridge',
      ntfChannelLabel: 'Channel',
      ntfChannelBark: 'Bark',
      ntfChannelNtfy: 'ntfy',
      ntfChannelWebhook: 'Webhook',
      ntfUrlLabel: 'Server / Webhook URL',
      ntfUrlPlaceholder: 'self-hosted Bark/ntfy server, or the full webhook URL',
      ntfUrlHint: 'Empty uses the official Bark/ntfy service; webhooks need the full URL. A URL containing {title}/{body} is fetched as a templated GET; otherwise a JSON POST {title, body} is sent.',
      ntfBarkKeyLabel: 'Bark device key',
      ntfBarkKeyHint: 'The key from the Bark app; may stay empty with a self-hosted server.',
      ntfTopicLabel: 'ntfy topic',
      ntfTopicHint: 'Subscribe to the same topic name in the phone ntfy app.',
      ntfEventsLabel: 'Events',
      ntfEventTurnEnd: 'Turn finished (the long-task-done signal)',
      ntfEventJobs: 'Background job settled (failures included)',
      ntfEventApprovals: 'Approval waiting (a tool call needs your decision)',
      ntfEventContext: 'Context nearly full (≥85% — consider a new session)',
      ntfTestBtn: 'Send test',
      ntfTestOk: 'Test notification sent — your phone should have it.',
      ntfQuietBtn: 'Mute 1 hour',
      ntfQuietCancel: 'Unmute',
      ntfQuietOn: 'Muted for {n} minutes.',
      ntfQuietOff: 'Mute cancelled.',
      ntfQuietActive: 'Notifications are muted — events will not be pushed.',
      ntfSaved: 'Notification settings saved and effective immediately.',
      ntfSecurityNote: 'Note: the official Bark/ntfy services relay over the public internet; a webhook URL or device key is a credential — keep it private.',
      foTabsLabel: 'File changes tabs',
      foTabGit: 'Workspace Changes',
      foTabHistory: 'Operation Log',
      foIntro: 'AI operation trail: write/edit (with diffs), reads, bash',
      foEmpty: 'No operations in this session yet — once the AI reads, writes, or runs commands, each operation is recorded here grouped by target.',
      foOpsCount: 'operations',
      foTruncated: 'showing the newest {n}',
      foMoreGroups: 'Load more ({n} more targets)',
      foRan: 'ran',
      foDiffEvicted: "This op's diff is outside the retention window (only the newest 200 keep full diffs).",
      foNoSession: 'No session selected.',
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
      mobileCurrentAddress: 'Current address',
      mobileAddressHint: 'Open this address on the phone. If the IP changes (DHCP reassignment), old bookmarks break — consider a static IP binding for this machine on the router.',
      mobileNoLan: 'No LAN IP detected (type the address manually on the phone)',
      mobileDevices: 'Paired devices',
      mobileNoDevices: 'No paired devices yet.',
      mobileRevoke: 'Remove',
      mobileRotate: 'Rotate key (disconnect all devices)',
      mobileRotateConfirm: 'Rotate the signing key? Every paired phone is disconnected instantly and must re-pair.',
      mobileLastSeen: 'Last seen',
      mobilePairedAt: 'Paired',
      mobileApply: 'Apply',
      mobileEnabled: 'Mobile access enabled',
      mobileDisabled: 'Mobile access disabled',
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
      tmBtn: 'Time machine',
      tmHint: 'Fork this session by turn: continue from any point as a copy',
      tmTitle: 'Time machine',
      tmIntro: 'Fork a copy of "{name}" from any completed turn — the official fork primitive; the child appears in the sidebar immediately.',
      tmTurnLabel: 'Turn {n}',
      tmForkHere: 'Fork here',
      tmForked: 'Fork {id}… created — the new session should already be in the sidebar.',
      tmCold: 'This session is not open in the current process (fork needs it live) — open it in the chat first.',
      tmNoTurns: 'No completed turns to fork from.',
      sessExportMd: 'Export MD',
      sessExportMdHint: 'Download a readable Markdown transcript (user/assistant/tool calls)',
      sessExportZip: 'Export Zip',
      sessExportZipHint: 'Official full export: the complete log with attachments, as a zip',
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

    /** 无 locale 服务时的回退：按浏览器语言选择词典，替换 {x} 占位。 */
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
     * 语言切换的重渲染触发器。所有已挂载组件共享一个 store（每次渲染
     * 内联新建 store 对象会让 useSyncExternalStore 逐渲染重订阅）。
     */
    var localeStore = { initial: 0, instance: null }
    function bumpLocale() {
      if (localeStore.instance !== null) localeStore.instance.set(localeStore.instance.getSnapshot() + 1)
    }

    // ── 轻量 store ────────────────────────────────────────────────────────

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

    // ── api 辅助 ──────────────────────────────────────────────────────────

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
          // 非 JSON 应答体（代理错误页、截断响应）：裸的
          // "Unexpected token" 对谁都没帮助。
          throw new Error('bad response from the dsh-base-plugin API (HTTP ' + res.status + ') — is dsh restarting?')
        })
      })
    }

    // ── 样式 ──────────────────────────────────────────────────────────────

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
      /* 悬停行完全容纳在自身盒内：不用负外边距（官方触发器上方 -4px 的
         渗出让两个命中区重叠，合成器重绘重叠带在浅色主题下表现为灰色
         闪烁）。本行严格限制在自己的盒内。 */
      /* 与侧栏背景同色的不透明垫层：只要底部任意悬停状态变化，祖先滚动
         容器就重绘其底缘（harness 布局行为——分层/隔离都拦不住）。不透明
         垫层让该重绘逐像素一致，于是不可见：「闪烁的线」本是滚动容器圆角
         裁剪边在透明间隙上于两个子像素位置间来回；在实色垫层上两个位置
         画同一颜色。 */
      '.dhb-svcWrap{flex:none;display:flex;width:100%;margin:4px 0;box-sizing:border-box;padding:2px 4px;border-radius:10px;background:var(--dsw-alias-bg-base,#fff)}',
      /* 静态几何不透明垫层：上探越过滚动容器的底部裁剪边、下盖过设置行。
         footerActions 是 position:static，因此这个绝对定位子元素锚到最近
         的定位祖先——侧栏列——恰好就是我们要覆盖的条带。 */
      '.dhb-svcBackdrop{position:absolute;left:0;right:0;top:-10px;bottom:-92px;pointer-events:none;z-index:-1;background:var(--dsw-alias-bg-base,#fff)}',
      /* 悬停不做过渡动画：侧栏底部 flex 行的背景动画在指针进入时明显闪烁
         （过渡头几帧的绘制与 flex 重排竞速）。现在悬停是即时状态切换，
         与下方设置触发器一致。 */
      /* 整数像素几何、不裁剪溢出（圆角悬停自绘遮罩；overflow:hidden 会
         强制裁剪层，其 1px 边缘落在子像素边界上，Retina 屏上闪烁）。 */
      '.dhb-svcBtn{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:6px 10px;box-sizing:border-box;border:none;border-radius:0;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-family:inherit;font-size:13px;line-height:22px;white-space:nowrap}',
      '.dhb-svcBtn:first-child{border-radius:12px 0 0 12px}',
      '.dhb-svcBtn:last-child{border-radius:0 12px 12px 0}',
      '.dhb-svcBtn:only-child{border-radius:12px}',
      /* 悬停背景用内嵌 box-shadow 而非 background+圆角：圆角背景强制抗锯齿
         裁剪，上下边在每次合成器提升时重采样（Retina 上的「两条闪烁线」）。
         同半径的内嵌阴影画出完全相同的药丸形，且完全没有裁剪层。 */
      '.dhb-svcBtn:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcBtn:disabled{opacity:.4;cursor:not-allowed}',
      '.dhb-svcBtn svg{flex:none;display:block}',
      '.dhb-svcStop:hover:not(:disabled){box-shadow:inset 0 0 0 9999px rgba(192,57,43,.08);color:#c0392b}',
      '.dhb-svcRailWrap{flex:none;display:flex;flex-direction:column;align-items:center;gap:8px;margin:4px 0}',
      '.dhb-svcRail{width:36px;height:36px;flex:none;display:flex;align-items:center;justify-content:center;padding:0;border:none;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer}',
      '.dhb-svcRail:hover:not(:disabled){box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-svcRail:disabled{opacity:.4;cursor:not-allowed}',
      /* 高于设置模态（其遮罩在 z-index 1000）：确认卡是对破坏性操作的全局
         应答，绝不能被发起它的界面盖住。 */
      '.dhb-cfmOverlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.32))}',
      '.dhb-cfmCard{display:flex;flex-direction:column;gap:14px;width:min(360px,calc(100vw - 48px));padding:18px 20px 16px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-cfmText{margin:0;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#222)}',
      '.dhb-cfmRow{display:flex;justify-content:flex-end;gap:8px}',
      /* 钉在会话头底边框上——与视图 tab 同一行（tab 行是头部最后一行，
         文字距边框约 11px）。bottom:2px 让 28px 按钮的垂直中心对齐 tab
         文字行；right:0 贴住头部右内边距，像末位 tab。
         z-index:7 — the SAME layer the harness gives the sticky composer
         seat (input box), and above markdown CodeBlock sticky banners (6).
         The wrap creates the stacking context for its dropdown menu, so a
         lower value here caps the whole subtree: scrolling content at z6/z7
         painted over the button and even the open menu. */
      '.dhb-smWrap{position:absolute;bottom:2px;right:0;z-index:7;flex:none}',
      '.dhb-smBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-caption,#8a919e);cursor:pointer}',
      '.dhb-smBtn:hover{box-shadow:inset 0 0 0 9999px var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,#3f4550)}',
      '.dhb-smMenu{position:absolute;top:calc(100% + 4px);right:12px;z-index:60;padding:4px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 8px 24px rgba(0,0,0,.14);font-size:13px;white-space:nowrap}',
      '.dhb-smItem{display:flex;align-items:center;gap:8px;width:100%;padding:6px 14px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;text-align:left;font-family:inherit;font-size:12.5px}',
      '.dhb-smItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-gtPage{display:flex;flex-direction:column;gap:10px;height:100%;padding:16px 20px;box-sizing:border-box;font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);overflow-y:auto}',
      '.dhb-gtHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;flex:none}',
      '.dhb-gtSubTitle{margin:14px 0 6px;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-secondary,#3f4550)}',
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
      '.dhb-diffN{display:inline-block;text-align:right;padding-right:8px;color:var(--dsw-alias-label-caption,#8a919e);opacity:.75;user-select:none;-webkit-user-select:none;vertical-align:baseline}',
      /* ── Think 折叠展开区高度上限 ─────────────────────────────────────────
         harness 的 ReasoningRow 把整段推理渲染进 .thinkBody，无高度限制，
         展开长推理会把会话流撑开数屏。此处用稳定结构锚点覆盖（类名是
         CSS-module 哈希，不可用；data-variant="think" 是 ReasoningRow 的
         稳定输出）：上限 40vh、内部滚动，展开仍可读完全文。 */
      '[data-variant="think"] [class*="thinkBody"]{max-height:40vh;overflow-y:auto;overscroll-behavior:contain}',
      /* ── 会话消息刻度轨道 ────────────────────────────────────────────────
         注意：此处不做自定义滚动条皮肤——harness 自带 token 驱动的皮肤
         （ui-theme styles/scrollbar.css，暗色自适应，--dsh-scrollbar-width:
         8px）。本插件只在其旁侧加刻度轨道。 */
      /* 消息刻度轨道：固定在原生滚动条旁侧（非覆盖）。容器穿透指针事件、
         只有刻度本身接收——条带不会挡住右缘的文本选择。刻意不画轨道、
         不画视口胶囊：旁边原生滚动条已表达位置，再画一个胶囊会被看成
         第二根滚动条。只有小刻度悬浮于此。 */
      '.dhb-rail{position:fixed;width:12px;z-index:500;pointer-events:none;display:none}',
      '.dhb-rail[data-on="1"]{display:block}',
      /* ⋯ 下拉菜单（任意 dhb-smMenu）打开期间轨道让位——菜单在更低的
         层叠上下文里，会被轨道盖住。 */
      '.dhb-rail[data-menu-open="1"]{display:none}',
      '.dhb-railTick{position:absolute;left:2px;right:2px;height:4px;border-radius:2px;cursor:pointer;pointer-events:auto;transition:transform .12s ease,box-shadow .12s ease}',
      '.dhb-railTick[data-role="user"]{background:rgba(47,111,237,.75)}',
      '.dhb-railTick[data-role="assistant"]{background:rgba(30,126,52,.75)}',
      '.dhb-railTick:hover,.dhb-railTick[data-active="1"]{transform:scaleX(1.6);box-shadow:0 0 0 1px rgba(127,127,127,.35)}',
      '.dhb-railTick[data-role="user"]:hover,.dhb-railTick[data-role="user"][data-active="1"]{background:#2f6fed}',
      '.dhb-railTick[data-role="assistant"]:hover,.dhb-railTick[data-role="assistant"][data-active="1"]{background:#1e7e34}',
      '.dhb-railTip{position:fixed;z-index:510;max-width:280px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 6px 18px rgba(0,0,0,.16);font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#3f4550);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}',
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
      '.dhb-toolsNav{flex:none;display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec);overflow-x:auto;scrollbar-width:thin}',
      '.dhb-toolsNavItem{display:inline-flex;align-items:center;gap:7px;flex:none;padding:6px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#3f4550);cursor:pointer;font-size:12.5px;font-family:inherit;line-height:1.4;white-space:nowrap}',
      '.dhb-toolsNavItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dhb-toolsNavItem[data-active="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#222);font-weight:600}',
      '.dhb-toolsMain{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.dhb-toolsHead{flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,#e3e6ec)}',
      '.dhb-toolsBody{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch}',
      '.dhb-svcCard{display:flex;flex-direction:column;gap:8px;align-items:center;padding:22px 30px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#d0d4dd);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 16px 40px rgba(0,0,0,.22);font-size:13px;color:var(--dsw-alias-label-secondary,#3f4550);max-width:420px;text-align:center}',
      '.dhb-svcSpin{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--dsw-alias-border-l2,#e3e6ec);border-top-color:#2f6fed;animation:dhbSpin 0.9s linear infinite}',
      '@keyframes dhbSpin{to{transform:rotate(360deg)}}',
      /* ── Mobile adaptation (phones reach these pages through the mobile
         proxy; the DSH shell itself auto-collapses below 1024px, these
         rules adapt THIS plugin's own surfaces). Touch-friendly targets,
         scrollable wide tables, full-width tool dock, scaled QR. ──────── */
      '@media (max-width: 760px){',
      /* 触控目标：按钮变大，小图标按钮达到 32px。 */
      '.dhb-btn{padding:8px 14px;font-size:13px}',
      '.dhb-smBtn{width:32px;height:32px}',
      /* 消息刻度轨道是指针精度交互：12px 的小刻度贴着本就由手指拖拽
         控制的滚动条。触屏/窄视口下它们只会截走右缘触摸、徒增噪音——
         整体隐藏（CSS 关断；观察者机制因无元素显示而保持休眠、开销
         极低）。 */
      '.dhb-rail{display:none !important}',
      '.dhb-tmX{width:20px;height:20px}',
      '.dhb-skillRow{padding:12px}',
      /* 输入框与标签同行：允许收缩，不在换行 flex 行里强撑 160px 最小宽。 */
      '.dhb-input{min-width:0}',
      '.dhb-textarea{min-height:72px;font-size:13px}',
      /* 宽表格（用量统计、价格编辑器）各自横向滚动——经典 display:block
         技巧。 */
      '.dhb-usTable{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      /* 统计卡与图表放弃最小宽，让每行换行收纳而非溢出。 */
      '.dhb-usStat{min-width:0}',
      '.dhb-usPriceIn{width:74px}',
      /* 代码块与 diff：把更多视口留给内容。 */
      '.dhb-pre{max-height:56vh}',
      '.dhb-diff{font-size:11px}',
      /* 窄视口下 diff 行号槽收紧。 */
      '.dhb-diffL{padding:0 8px}',
      '.dhb-diffN{padding-right:6px}',
      /* 配对二维码卡随视口缩放。 */
      '.dhb-qrBox svg{width:min(240px,68vw);height:auto}',
      /* 工具坞（文件变更/终端）在桌面是侧栏列；手机上变为全宽覆盖层。
         行内宽度来自 JS 拖拽状态——left:0/right:0 无论如何都钉满。拖宽
         条在触屏上无意义：隐藏。 */
      '.dhb-toolsDock{left:0;right:0;width:100vw !important;max-width:100vw;border-left:none}',
      '.dhb-toolsResize{display:none}',
      '.dhb-gtPage{padding:10px 10px}',
      '.dhb-tmOut{font-size:11.5px}',
      /* 服务状态卡片在小屏上留出呼吸空间。 */
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

    /** 样式表只插入一次；返回 disposer，停止时移除。 */
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

    // ── 共享小件 ──────────────────────────────────────────────────────────

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

    // ── 应用内确认对话框（不用原生 window.confirm）─────────────────────

    /**
     * 确认对话框用直接 DOM（非 React）：卡片必须挂在 document.body 层
     * 才能压过设置模态（body 层 z-index 1000），而 shell.overlay 槽位在
     * 外壳框架的层叠上下文里、什么都赢不了它。把 React 节点搬去 body
     * 会破坏 React 的卸载簿记（死处理器、幽灵节点），因此这里用一个极
     * 小的命令式覆盖层：showConfirm() 惰性构建，按钮结算挂起的 Promise
     * 并隐藏 DOM。同时只开一个对话框；Esc 与点背景取消。
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

    /** 插件停止时拆除 body 级对话框 DOM 与 document 监听（apply 清理调用）。
     * 打开中的对话框一并按取消结算——不悬挂任何 Promise。 */
    function disposeConfirm() {
      settleConfirm(false)
      if (confirmDom !== null) {
        if (confirmDom.keyHandler !== null) {
          document.removeEventListener('keydown', confirmDom.keyHandler)
          confirmDom.keyHandler = null
        }
        if (confirmDom.root.parentNode !== null) confirmDom.root.parentNode.removeChild(confirmDom.root)
        confirmDom = null
      }
    }

    /** 注册进 shell.overlay 以维持槽位注册契约；真正的卡片是 body 层
     * 的直接 DOM。 */
    function ConfirmDialog() {
      return null
    }

    /** apply 时捕获的绑定 locale 的翻译函数（回退：浏览器语言）。 */
    var currentT = null


    /** 让组件订阅语言变化（共享 store，引用稳定）。 */
    function useLocaleVersion() {
      if (localeStore.instance === null) {
        localeStore.instance = createStore(localeStore.initial)
      }
      return useStore(localeStore.instance)
    }

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
        // 健康面板：全部会话日志按服务器聚合的用量/失败/延迟
        h('div', { className: 'dhb-list' },
          h('h3', { className: 'dhb-sectTitle' }, t('mcpHealthTitle')),
          health.status === 'error' ? h(Banner, { kind: 'warn', text: t('mcpHealthUnavailable') }) : null,
          health.status !== 'error' && health.servers.length === 0
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
                  row.tools.length > 0
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

    // ── 系统提示词设置节 ───────────────────────────────────────────────────

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

      // 重读状态并重新填充编辑器（绝不覆盖未保存的编辑）。
      // 编辑器只以自定义 persona 填充——默认态就是空。
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

      // tm: null 关闭；{ item, status, turns, error, busyTurn }
      var tmState = React.useState(null)
      var tm = tmState[0]
      var setTm = tmState[1]

      function onTimeMachine(item) {
        setTm({ item: item, status: 'loading', turns: [], error: '', forkError: '' })
        api('/timemachine?sessionId=' + encodeURIComponent(item.id))
          .then(function (value) {
            setTm(function (prev) { return prev === null ? prev : { item: item, status: 'ready', turns: value.turns ?? [], error: value.live === true ? '' : 'cold' } })
          })
          .catch(function (error) {
            setTm(function (prev) { return prev === null ? prev : { item: item, status: 'error', turns: [], error: String(error.message || error) } })
          })
      }

      function onFork(turn) {
        if (tm === null || tm.busyTurn !== undefined) return
        setTm(function (prev) { return prev === null ? prev : Object.assign({}, prev, { busyTurn: turn.endSeq, forkError: '' }) })
        post('/timemachine/fork', { sessionId: tm.item.id, boundary: turn.endSeq })
          .then(function (value) {
            // 对话框在途关闭（prev 为 null）时丢弃响应——曾因
            // Object.assign({}, null, patch) 造出 {forked:…} 令 tm.item
            // 变 undefined、渲染树崩溃。
            setTm(function (prev) { return prev === null ? prev : Object.assign({}, prev, { forked: value.childId, busyTurn: undefined }) })
          })
          .catch(function (error) {
            setTm(function (prev) { return prev === null ? prev : Object.assign({}, prev, { forkError: String(error.message || error), busyTurn: undefined }) })
          })
      }

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

      // 时间机器对话框（打开时覆盖整页内容区）
      if (tm !== null) {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('tmTitle')),
          h('p', { className: 'dhb-desc' }, t('tmIntro', { name: sessionDisplayName(tm.item, t) })),
          h('div', { className: 'dhb-row' },
            h('button', { className: 'dhb-btn', type: 'button', onClick: function () { setTm(null); refresh() } }, t('back')),
            h('button', { className: 'dhb-btn', type: 'button', onClick: function () { onTimeMachine(tm.item) } }, t('refresh')),
          ),
          tm.error === 'cold' ? h(Banner, { kind: 'warn', text: t('tmCold') }) : null,
          tm.status === 'error' && tm.error !== 'cold' ? h(Banner, { kind: 'err', text: tm.error }) : null,
          tm.forked !== undefined ? h(Banner, { kind: 'ok', text: t('tmForked', { id: tm.forked.slice(0, 12) }) }) : null,
          tm.forkError !== undefined && tm.forkError !== '' ? h(Banner, { kind: 'err', text: tm.forkError }) : null,
          h('div', { className: 'dhb-list' },
            tm.status === 'loading' ? h('p', { className: 'dhb-desc' }, t('loading'))
            : tm.turns.length === 0 ? h('p', { className: 'dhb-desc' }, t('tmNoTurns'))
            : tm.turns.map(function (turn) {
                return h('div', { className: 'dhb-card', key: turn.endSeq },
                  h('div', { className: 'dhb-cardTitle' }, t('tmTurnLabel', { n: turn.turn })
                    + (turn.time > 0 ? ' · ' + new Date(turn.time).toLocaleString() : '')),
                  h('p', { className: 'dhb-hint', style: { margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                    turn.preview),
                  h('div', { className: 'dhb-cardActions' },
                    h('button', {
                      className: 'dhb-btn dhb-btnPrimary', type: 'button',
                      disabled: tm.busyTurn !== undefined || tm.error === 'cold',
                      onClick: function () { onFork(turn) },
                    }, tm.busyTurn === turn.endSeq ? t('loading') : t('tmForkHere'))),
                )
              }),
          ),
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
                // 时间机器：按轮次分叉（官方 sessions.fork）。
                h('button', {
                  className: 'dhb-btn', type: 'button',
                  title: t('tmHint'),
                  onClick: function () { onTimeMachine(item) },
                }, t('tmBtn')),
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

    // ── 手机访问设置节（配对代理控制）────────────────────────────────────

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
     * 手机访问设置节：启用开关 + 端口、配对二维码（每次打开都铸新
     * 码）、已配对设备列表（可逐个吊销）与轮换密钥操作。全部经宿主半
     * 的 /mobile* 控制路由。
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
        // 当前地址卡片：局域网 IP 是会无声漂移的东西（DHCP 重分配），
        // 一漂移手机里存的全部书签就失效——无论代理状态如何都醒目展示。
        data.addresses !== undefined && data.addresses.length > 0
          ? h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('mobileCurrentAddress')),
              h('div', { className: 'dhb-list' },
                data.addresses.map(function (addr, i) {
                  var url = 'http://' + addr + ':' + data.port
                  return h('div', { className: 'dhb-row', key: addr, style: { justifyContent: 'space-between' } },
                    h('code', { style: { fontSize: 13, wordBreak: 'break-all' } }, url),
                    h('button', {
                      className: 'dhb-btn', type: 'button',
                      onClick: function () {
                        if (navigator.clipboard !== undefined && navigator.clipboard.writeText !== undefined) {
                          navigator.clipboard.writeText(url)
                          setMsg({ kind: 'ok', text: url + ' → ⧉' })
                        }
                      },
                    }, '⧉'),
                  )
                }),
              ),
              h('p', { className: 'dhb-hint' }, t('mobileAddressHint')),
            )
          : h('div', { className: 'dhb-card' },
              h('div', { className: 'dhb-cardTitle' }, t('mobileCurrentAddress')),
              h('p', { className: 'dhb-desc' }, t('mobileNoLan')),
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

    // ── 通知设置节（通知桥控制）─────────────────────────────────────────

    /** 渠道定义：值 + 标签键 + 所需字段。 */
    var NOTIFY_CHANNELS = [
      { value: 'bark', labelKey: 'ntfChannelBark', fields: ['url', 'barkKey'] },
      { value: 'ntfy', labelKey: 'ntfChannelNtfy', fields: ['url', 'ntfyTopic'] },
      { value: 'webhook', labelKey: 'ntfChannelWebhook', fields: ['url'] },
    ]

    /**
     * 通知设置节：启用开关 + 渠道三选一 + 按渠道显隐的字段（Bark 设备
     * key/自建 URL、ntfy topic/服务器、webhook URL）+ 三类事件开关
     * （回合结束/任务完结/审批等待）+ 测试发送与静音。全部经宿主
     * /notify* 路由；保存即生效（监听器逐事件现读配置）。
     */
    function NotifySection(props) {
      var t = props.t
      useLocaleVersion()

      var dataState = React.useState({ status: 'idle' })
      var data = dataState[0]
      var setData = dataState[1]

      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      var msgState = React.useState(null)
      var msg = msgState[0]
      var setMsg = msgState[1]

      var refresh = React.useCallback(function () {
        api('/notify').then(function (value) {
          setData({ status: 'ready', cfg: value })
        }).catch(function (error) {
          setData({ status: 'error' })
          setMsg({ kind: 'err', text: String(error.message || error) })
        })
      }, [])

      React.useEffect(function () { refresh() }, [refresh])

      function patch(patchObj) {
        setData(function (prev) {
          return prev.status === 'ready' ? { status: 'ready', cfg: Object.assign({}, prev.cfg, patchObj) } : prev
        })
      }

      function onSave() {
        if (busy || data.status !== 'ready') return
        setBusy(true)
        setMsg(null)
        post('/notify', data.cfg)
          .then(function (value) {
            setData({ status: 'ready', cfg: value })
            setMsg({ kind: 'ok', text: t('ntfSaved') })
          })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      function onTest() {
        if (busy) return
        setBusy(true)
        setMsg(null)
        post('/notify/test', {})
          .then(function () { setMsg({ kind: 'ok', text: t('ntfTestOk') }) })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      function onQuiet(minutes) {
        if (busy) return
        setBusy(true)
        setMsg(null)
        post('/notify/quiet', { minutes: minutes })
          .then(function (value) {
            patch({ quietUntil: value.quietUntil })
            setMsg({ kind: 'ok', text: minutes > 0 ? t('ntfQuietOn', { n: minutes }) : t('ntfQuietOff') })
          })
          .catch(function (error) { setMsg({ kind: 'err', text: String(error.message || error) }) })
          .then(function () { setBusy(false) })
      }

      if (data.status !== 'ready') {
        return h('div', { className: 'dhb-page' },
          h('h2', { className: 'dhb-title' }, t('sectionNotify')),
          data.status === 'error' ? h(Banner, { kind: 'err', text: msg !== null ? msg.text : t('errorTitle') })
          : h('p', { className: 'dhb-desc' }, t('loading')),
        )
      }

      var cfg = data.cfg
      var channelDef = null
      for (var i = 0; i < NOTIFY_CHANNELS.length; i += 1) {
        if (NOTIFY_CHANNELS[i].value === cfg.channel) { channelDef = NOTIFY_CHANNELS[i]; break }
      }
      var needs = function (f) { return channelDef !== null && channelDef.fields.indexOf(f) !== -1 }
      var quietActive = typeof cfg.quietUntil === 'number' && cfg.quietUntil > Date.now()

      return h('div', { className: 'dhb-page' },
        h('h2', { className: 'dhb-title' }, t('sectionNotify')),
        h('p', { className: 'dhb-desc' }, t('ntfIntro')),
        msg !== null ? h(Banner, { kind: msg.kind, text: msg.text }) : null,
        quietActive ? h(Banner, { kind: 'warn', text: t('ntfQuietActive') }) : null,
        h('div', { className: 'dhb-form' },
          h('label', { className: 'dhb-row', style: { gap: 6 } },
            h('input', { type: 'checkbox', checked: cfg.enabled === true, onChange: function (e) { patch({ enabled: e.target.checked }) } }),
            h('span', null, t('ntfEnable'))),
          // 渠道选择
          h('div', { className: 'dhb-field' },
            h('span', { className: 'dhb-label' }, t('ntfChannelLabel')),
            h('div', { className: 'dhb-row' },
              NOTIFY_CHANNELS.map(function (ch) {
                return h('button', {
                  key: ch.value, type: 'button',
                  className: 'dhb-btn' + (cfg.channel === ch.value ? ' dhb-btnPrimary' : ''),
                  onClick: function () { patch({ channel: ch.value }) },
                }, t(ch.labelKey))
              }),
            ),
          ),
          // 按渠道显隐的字段
          needs('url')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfUrlLabel')),
                h('input', { className: 'dhb-input', value: cfg.url, placeholder: t('ntfUrlPlaceholder'), spellCheck: false, onChange: function (e) { patch({ url: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfUrlHint')),
              )
            : null,
          needs('barkKey')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfBarkKeyLabel')),
                h('input', { className: 'dhb-input', value: cfg.barkKey, placeholder: 'xxxxxxxx', spellCheck: false, onChange: function (e) { patch({ barkKey: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfBarkKeyHint')),
              )
            : null,
          needs('ntfyTopic')
            ? h('div', { className: 'dhb-field' },
                h('span', { className: 'dhb-label' }, t('ntfTopicLabel')),
                h('input', { className: 'dhb-input', value: cfg.ntfyTopic, placeholder: 'my-dsh', spellCheck: false, onChange: function (e) { patch({ ntfyTopic: e.target.value }) } }),
                h('span', { className: 'dhb-hint' }, t('ntfTopicHint')),
              )
            : null,
          // 事件开关
          h('div', { className: 'dhb-field' },
            h('span', { className: 'dhb-label' }, t('ntfEventsLabel')),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.turnEnd === true, onChange: function (e) { patch({ turnEnd: e.target.checked }) } }),
              h('span', null, t('ntfEventTurnEnd'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.jobs === true, onChange: function (e) { patch({ jobs: e.target.checked }) } }),
              h('span', null, t('ntfEventJobs'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.approvals === true, onChange: function (e) { patch({ approvals: e.target.checked }) } }),
              h('span', null, t('ntfEventApprovals'))),
            h('label', { className: 'dhb-row', style: { gap: 6 } },
              h('input', { type: 'checkbox', checked: cfg.context === true, onChange: function (e) { patch({ context: e.target.checked }) } }),
              h('span', null, t('ntfEventContext'))),
          ),
          h('div', { className: 'dhb-row' },
            h('button', { className: 'dhb-btn dhb-btnPrimary', type: 'button', disabled: busy, onClick: onSave }, busy ? t('saving') : t('save')),
            h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: onTest }, t('ntfTestBtn')),
            quietActive
              ? h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: function () { onQuiet(0) } }, t('ntfQuietCancel'))
              : h('button', { className: 'dhb-btn', type: 'button', disabled: busy, onClick: function () { onQuiet(60) } }, t('ntfQuietBtn')),
          ),
        ),
        h('p', { className: 'dhb-hint' }, t('ntfSecurityNote')),
      )
    }

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
    /** 编辑记录 tab：按文件分组的 write/edit 操作时间线（最新在前，
     * 每行可展开迷你 diff；数据来自宿主对 tool/result meta.diffs 的折叠）。
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

    /** 文件变更面板顶层：双 tab——「工作区变更」（git 基线差异）与
     * 「编辑记录」（AI 经 write/edit 工具的操作时间线）。 */
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
          tabItem('history', t('foTabHistory')),
        ),
        tab === 'history'
          ? h(EditHistoryView, { t: t, kit: kit })
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

    // ── 终端面板（PTY，多实例）─────────────────────────────────────────────

    /**
     * 单个终端窗格：输出流 + 单行输入。宿主把 PTY 的发送-操作模型映射
     * 到此 UI：按回车提交该行并结算操作；输出按增量轮询，输入期间保持
     * 一个操作打开。Ctrl+C 中断前台操作。
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
        // 只有 PTY 接受了该行才清空输入；被拒（如「命令仍在运行」）时
        // 保留已输入文本以便继续编辑。
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
     * 终端面板：会话工作区内的多个 PTY，从头部 ⋯ 菜单的右侧停靠面板
     * 打开。终端存活在宿主侧（按会话代理做属主隔离），因此本面板只恢复
     * 列表、逐终端的输出状态留在本地。
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

      /** 轮询一个操作直到结算；登记以便卸载时清理。useRef 而非渲染局部
       * 变量——组件函数每次渲染新建数组，卸载清理闭包只捕获首渲数组，
       * 首渲后登记的停止器曾因此永不生效（孤儿轮询器无限 POST）。 */
      var pollStoppersRef = React.useRef([])
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
              // 退避；连续失败（宿主消失/插件被移除）后结束循环，
              // 不再永久轮询。
              misses += 1
              if (misses >= 20) return
              setTimeout(tick, 1500)
            })
        }
        tick()
        var stopper = function () { stop = true }
        pollStoppersRef.current.push(stopper)
        return stopper
      }

      // 标签卸载时停掉所有在途轮询（切换视图不得留下孤儿轮询器给
      // 已卸载组件发 POST）。
      React.useEffect(function () {
        return function () {
          for (var i = 0; i < pollStoppersRef.current.length; i += 1) pollStoppersRef.current[i]()
          pollStoppersRef.current.length = 0
        }
      }, [])

      /** 恢复本会话在宿主侧的终端列表（标签重新挂载时）。 */
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
        // 加时钟后缀：标签重挂载后本地计数器归零，裸 "term-1" 会与仍
        // 存活的同名宿主 PTY 冲突（注册表拒绝重名）。
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

      /** 纯拷贝：设置或清除某一个终端的关闭中标记。 */
      function markClosing(prev, key, value) {
        var next = Object.assign({}, prev)
        if (value) next[key] = true
        else delete next[key]
        return next
      }

      function onInput(key, text, submit) {
        // one op per terminal: send (opens op) then poll its output.
        // 返回 POST 的 Promise，调用方在成功时清空输入。
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
                      (s.activity === 'running' ? t('monSubStateRunning') : t('monSubInactive'))
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

    // ── 模型用量设置节 ─────────────────────────────────────────────────────

    /** 每模型系列的图表配色（按模型 id 稳定映射）。 */
    var USAGE_COLORS = ['#2f6fed', '#1e7e34', '#c0392b', '#8e44ad', '#d68910', '#00838f', '#c2185b', '#5d4037']
    function usageColorOf(model, index) {
      var hash = 0
      for (var i = 0; i < model.length; i += 1) hash = (hash * 31 + model.charCodeAt(i)) & 0xffff
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

    // ── 会话头部 ⋯ 菜单（工具面板入口）───────────────────────────────────

    /**
     * 会话头部操作行末端的 ⋯ 按钮：小下拉菜单，承载文件变更/终端面板
     * （右侧停靠覆盖层，按可用性门控）。两个宿主能力都未就绪时整体隐
     * 藏——没有 git 或终端服务的宿主不会看到孤儿按钮。
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
      // 工具覆盖层是根作用域的，因此会话上下文在这里（会话作用域、真
      // kit）捕获、打开时移交：视图用的 cwd、侧栏面包屑用的标题。两个
      // 独立选择器（只返回字符串）——返回对象会让每次 getSnapshot 产生
      // 新快照引用、令 useSyncExternalStore 死循环。
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

      // 无可用面板（无 git 二进制、无终端服务、无监控数据源）：⋯ 菜单
      // 会是空的——干脆不渲染按钮。
      if (caps.changes !== true && caps.terminal !== true && caps.monitor !== true) return null

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
          caps.monitor === true ? h('button', {
            className: 'dhb-smItem', type: 'button', role: 'menuitem',
            onClick: function () { onOpenTool('monitor') },
          }, h(MonitorIcon, { size: 14 }), h('span', null, t('tabMonitor'))) : null,
        ) : null,
      )
    }

    // ── 服务生命周期（停止/重启）──────────────────────────────────────────

    /**
     * dsh 进程停止/重启动作的控制器。宿主半的端点在应答后即销毁进程，
     * 因此确认成功后的 POST 失败是**预期内**的（连接被断开）、直接忽略。
     * 重启后轮询直到新进程应答，然后刷新外壳。
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
        // 没有复苏可等：宽限期后直接显示已停止提示。
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
     * 按键是否发生在 IME 组合期间（中/日文输入）。按回车**确认候选词**
     * 会触发 isComposing=true 的 Enter——当作提交就会执行打了一半的
     * 命令。keyCode 229 兜底不设 isComposing 的旧引擎。
     */
    function isComposing(e) {
      var native = e.nativeEvent !== undefined ? e.nativeEvent : e
      return native.isComposing === true || native.keyCode === 229
    }

    /** 线性图标字形，与侧栏 16/18px 描边节奏一致。 */
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

    /** 带增删标记的文件字形（+ 压 −）：变更面板是只读 git diff 视图，
     * 文件体上的是增/删标记——不是「新文件」的加号。 */
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

    /** 经典终端字形（>_）。 */
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

    /** 监控面板字形（心电脉冲线）。 */
    function MonitorIcon(props) {
      var size = props.size === undefined ? 15 : props.size
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', strokeWidth: 2,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      },
        h('polyline', { points: '2 12 6 12 9 4 15 20 18 12 22 12' }))
    }

    /**
     * 画在 footerActions 内部的不透明背垫：绝对定位垫层、固定宽裕的
     * 上探下探（下盖过官方设置行、上盖过滚动容器底缘）。无测量循环
     * ——相对自身容器的纯 CSS 几何。祖先对底部的每次重绘都变成逐像素
     * 一致（子像素边两侧同为实色），闪烁线无从出现。
     */
    function FooterBackdrop() {
      var colorState = React.useState(null)
      var color = colorState[0]
      var setColor = colorState[1]
      React.useEffect(function () {
        if (typeof document === 'undefined') return undefined
        var read = function () {
          // 侧栏列自己的背景色——无论主题/解析到哪个 token——从活动
          // DOM 读一次，使垫层与周围绘制逐像素一致。
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
     * 设置旁的停止/重启控件（sidebar.footer.action）。两种形态跟随侧栏
     * 自身节奏：宽列 = 两枚 34px 连排行（共用设置触发器的 12px 圆角与
     * 悬停底色）；56px 轨道 = 叠放的 36px 圆钮（与轨道设置钮同款）。
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

    /** 停止/重启进行中的满屏状态卡。 */
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

    // ── 工具坞覆盖层（文件变更/终端面板）─────────────────────────────────

    /**
     * ⋯ 菜单工具面板的控制器。覆盖层在根作用域（shell.overlay），那里
     * 没有会话 kit，因此菜单在点击时捕获 {sessionId, sessionTitle, cwd}，
     * 覆盖层给内嵌视图喂合成 kit——两个视图都只消费 sessionId 与
     * useSessions(选择器 → row.cwd)。sessionTitle 供侧栏面包屑；switch()
     * 换面板时保留已捕获的上下文。
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
     * 右侧停靠的非模态面板，承载文件变更与终端，从会话头部 ⋯ 菜单打开
     * 而非会话 tab 环（tab 栏不进插件项）。真停靠、非浮层：打开期间应用
     * 框架（外壳三列网格）被面板宽度经行内 margin 挤窄，聊天列真正变窄、
     * 固定定位的面板占据视口右缘腾出的条带——无任何重叠。框架经外壳
     * 稳定的 `[data-shell-overlay]` 标记（其父级）定位；该锚点若消失则
     * 跳过 margin 步骤、面板退回纯浮动（优雅降级）。
     * 布局：左缘拖拽调宽柄（宽 360–760px，框架 margin 随拖动），顶栏
     * ——面包屑（会话标题 › 当前面板）+ 关闭钮——之下是横向工具导航行
     * （文件变更/终端，就地切换），再往下是活动视图主区。Esc 关闭；
     * 卸载经视图自身的清理停掉终端轮询。z-index 1500：高于服务卡
     * （1000）、低于确认框（2000），面板内确认不被盖住。
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

      // 停靠挤压：按面板宽度收窄外壳框架，聊天列真正重排而非被覆盖。
      // 框架自己的 ResizeObserver 会对减小后的宽度重解网格列。每次宽度
      // 变化（拖拽）都重跑；清理时恢复先前的行内 margin。margin 与 CSS
      // 的 max-width 钳制（极小视口）保持一致，让腾出的条带与实际渲染
      // 的面板严格同宽。
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
      // went away) falls back to another available one; none → close.
      var panel = snap.panel
      if (panel === 'changes' && caps.changes !== true) panel = caps.terminal === true ? 'terminal' : (caps.monitor === true ? 'monitor' : null)
      else if (panel === 'terminal' && caps.terminal !== true) panel = caps.changes === true ? 'changes' : (caps.monitor === true ? 'monitor' : null)
      else if (panel === 'monitor' && caps.monitor !== true) panel = caps.changes === true ? 'changes' : (caps.terminal === true ? 'terminal' : null)
      if (panel === null) return null

      var sessionLabel = snap.sessionTitle !== ''
        ? snap.sessionTitle
        : (snap.sessionId !== undefined ? snap.sessionId.slice(0, 8) : '—')

      var changesIcon = h(FileDiffIcon, { size: 15 })
      var terminalIcon = h(TerminalIcon, { size: 15 })
      var monitorIcon = h(MonitorIcon, { size: 15 })

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

      // 左缘拖拽调宽：指针 x → 停靠宽度（钳制在 360–760）。监听器只在
      // 拖拽期间挂在 document 上。
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
            h('div', { className: 'dhb-toolsCrumb', title: sessionLabel },
              h('span', { className: 'dhb-toolsCrumbSess' }, sessionLabel)),
            h('button', { className: 'dhb-btn', type: 'button', onClick: props.controller.close }, t('toolsClose')),
          ),
          h('div', { className: 'dhb-toolsNav', role: 'tablist', 'aria-label': t('sessionMore') },
            caps.changes === true ? navItem('changes', t('tabChanges'), changesIcon) : null,
            caps.terminal === true ? navItem('terminal', t('tabTerminal'), terminalIcon) : null,
            caps.monitor === true ? navItem('monitor', t('tabMonitor'), monitorIcon) : null,
          ),
          h('div', { className: 'dhb-toolsBody' },
            panel === 'terminal'
              ? h(TerminalView, { t: t, kit: fakeKit })
              : panel === 'monitor'
                ? h(MonitorView, { t: t, kit: fakeKit })
                : h(ChangesView, { t: t, kit: fakeKit }),
          ),
        ),
      )
    }

    // ── 设置导航图标（DOM 补丁）───────────────────────────────────────────

    /**
     * 设置外壳（ui-settings-general SettingsRoot）的导航图标来自硬编码的
     * id→图标映射，只覆盖核心节
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
      notify: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    }

    /** 节键 → 导航标签当前取值所用的 i18n 键。 */
    var SECTION_NAV_LABEL_KEYS = {
      usage: 'sectionUsage',
      prompt: 'sectionPrompt',
      mcp: 'sectionMcp',
      skills: 'sectionSkills',
      sessions: 'sectionSessions',
      mobile: 'sectionMobile',
      notify: 'sectionNotify',
    }

    /** 单趟扫描：为每个打开对话框里命中的导航按钮打补丁。幂等性以
     * 「扫描按钮的 svg 是否已带我们的标记」判定——绝不能用「齿轮前的
     * svg」：第一趟之后我们的图标就是第一个 svg，previousSibling 探测
     * 永远不再命中，观察器（对我们自己的插入也触发）会每帧重打补丁，
     * 每趟泄漏一个隐藏节点。 */
    function patchSettingsNavIcons(t) {
      var dialogs = document.querySelectorAll('div[role="dialog"]')
      for (var d = 0; d < dialogs.length; d += 1) {
        // 移动端适配钩子：给设置面板及其导航/选项区打结构标签，插件
        // 样式表据此在手机宽度重排——无需碰 harness 源码（类名是
        // CSS-module 哈希；这些结构属性稳定）。每趟重复打标——幂等。
        var nav = dialogs[d].querySelector('nav')
        if (nav !== null) {
          dialogs[d].setAttribute('data-dhb-settings-panel', '1')
          nav.setAttribute('data-dhb-settings-nav', '1')
          var content = nav.nextElementSibling
          // content's element children are exactly [header, options] —
          // children (not querySelectorAll) avoids matching nested leaves.
          if (content !== null) {
            // 纵向翻转修复：外壳给 .content 只设了 min-width:0（行布局
            // ——高度从不参与 flex 分配）。手机纵向布局里 min-height:auto
            // 把它钉在内容高度，溢出面板、杀死选项区滚动。
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

    /** 安装设置导航图标补丁器；返回其 disposer。 */
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

    // ── 会话滚动条消息刻度轨道 ────────────────────────────────────────────

    /**
     * 会话消息刻度轨道：当前会话列（`[data-conversation-scroll]`）原生
     * （harness 主题化）滚动条旁的细固定条。每条用户/打断/AI 消息行
     * （`[data-chat-flow-kind]`）一枚刻度，按行的流内偏移等比例定位；
     * 蓝 = 用户、绿 = AI。点击刻度滚动到该消息；悬停显示内容摘要；滚动
     * 时最接近视口中心的刻度保持高亮。轨道自身不画轨道底、不画视口
     * 胶囊——旁边原生滚动条已表达位置，再画一个会被看成第二根滚动条。
     *
     * 挂载跟踪用 body 级 MutationObserver（会话列随路由装卸）；内容跟踪
     * 用滚动容器内的观察器、约 250ms 防抖（全量重排是 O(行数)，流式输出
     * 不停改动子树）；几何还在滚动容器尺寸变化（工具坞挤压框架）与窗口
     * 缩放时重同步。一切以 position:fixed 挂在 document.body——不碰任何
     * React 子树，disposer 移除全部节点与观察器。
     */
    function installChatRail(t) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
        return function () {}
      }

      // 'assistant-step' is the assistant row's CHAT kind (register-node-
      // renderers); 'assistant' kept for forward compatibility.
      var RAIL_KINDS = { user: 'user', steering: 'user', assistant: 'assistant', 'assistant-step': 'assistant' }
      var RAIL_RIGHT = 22 // native scrollbar (~8px) + gap, rail sits beside it
      var TICK_MIN_GAP = 5
      var HOVER_HIDE_MS = 200

      var scrollport = null
      var rail = null
      var tip = null
      var ticks = [] // { el, row, role, flowTop }
      var bodyObserver = null
      var contentObserver = null
      var resizeObserver = null
      var refreshTimer = 0
      var scrollRaf = 0
      var tipTimer = 0

      /** 行相对滚动容器内容原点的流内偏移。 */
      function flowTopOf(row) {
        return row.getBoundingClientRect().top - scrollport.getBoundingClientRect().top + scrollport.scrollTop
      }

      /** 几何同步：按滚动容器矩形摆放固定轨道。 */
      function place() {
        var rect = scrollport.getBoundingClientRect()
        rail.style.left = Math.round(rect.right - 12 - RAIL_RIGHT) + 'px'
        rail.style.top = Math.round(rect.top + 6) + 'px'
        rail.style.height = Math.round(rect.height - 12) + 'px'
      }

      /** 活跃刻度高亮（开销小；由滚动驱动）。轨道自身不画视口指示器
       *  ——旁边的原生滚动条已经承担。 */
      function syncView() {
        scrollRaf = 0
        if (scrollport === null || rail === null) return
        var span = scrollport.scrollHeight - scrollport.clientHeight
        rail.setAttribute('data-on', span > 4 ? '1' : '0')
        if (span <= 4) return
        // 活跃刻度：最后一个行顶已越过视口上三分点的行。
        var mark = scrollport.scrollTop + scrollport.clientHeight / 3
        var active = null
        for (var i = 0; i < ticks.length; i += 1) {
          if (ticks[i].flowTop <= mark) active = ticks[i]
          else break
        }
        for (var j = 0; j < ticks.length; j += 1) {
          ticks[j].el.setAttribute('data-active', ticks[j] === active ? '1' : '0')
        }
      }

      function scheduleSyncView() {
        if (scrollRaf !== 0) return
        scrollRaf = requestAnimationFrame(syncView)
      }

      /** 全量重排：从实时消息行重建刻度。 */
      function refresh() {
        refreshTimer = 0
        if (scrollport === null || rail === null) return
        for (var i = 0; i < ticks.length; i += 1) {
          if (ticks[i].el.parentNode !== null) ticks[i].el.parentNode.removeChild(ticks[i].el)
        }
        ticks = []
        var rows = scrollport.querySelectorAll('[data-chat-flow-kind]')
        var height = 0
        var span = scrollport.scrollHeight
        var rect = scrollport.getBoundingClientRect()
        var placed = []
        for (var r = 0; r < rows.length; r += 1) {
          var row = rows[r]
          var role = RAIL_KINDS[row.getAttribute('data-chat-flow-kind')]
          if (role === undefined) continue
          var flowTop = row.getBoundingClientRect().top - rect.top + scrollport.scrollTop
          placed.push({ row: row, role: role, flowTop: flowTop })
        }
        if (placed.length === 0 || span <= 0) { syncView(); return }
        // 显示阶段：等比例定位 + 最小间距，密集区不塌缩成一条像素棒。
        // 比例先于挂载计算（轨道高度只有 append 后才可读）。
        for (var p = 0; p < placed.length; p += 1) {
          placed[p].ratio = placed[p].flowTop / span
        }
        height = rail.clientHeight
        var lastTop = -Infinity
        for (var q = 0; q < placed.length; q += 1) {
          var entry = placed[q]
          var px = Math.round(entry.ratio * height)
          if (px - lastTop < TICK_MIN_GAP) px = lastTop + TICK_MIN_GAP
          if (px > height - 4) px = height - 4
          lastTop = px
          ticks.push(makeTick(entry, px))
        }
        syncView()
      }

      function makeTick(entry, px) {
        var el = document.createElement('div')
        el.className = 'dhb-railTick'
        el.setAttribute('data-role', entry.role)
        el.style.top = px + 'px'
        el.addEventListener('click', function (event) {
          event.stopPropagation()
          scrollport.scrollTo({ top: Math.max(0, entry.flowTop - 8), behavior: 'smooth' })
        })
        el.addEventListener('mouseenter', function () { showTip(el, entry) })
        el.addEventListener('mouseleave', hideTipSoon)
        rail.appendChild(el)
        return { el: el, row: entry.row, role: entry.role, flowTop: entry.flowTop }
      }

      /**
       * 消息行的结构性摘录：其文本节点减去操作栏 chrome（时钟、
       * "Ran for"、tok/s、复制/分支按钮文字）。
       *
       * chrome 判定（读自 harness 标记）：沿祖先上溯到行根，文本节点若
       * 位于 BUTTON/SVG 内（复制/分支按钮、图标——标签永不入摘录），或
       * 其 SPAN 祖先拥有 BUTTON 兄弟（时钟 span 就在操作行里、紧挨
       * Tooltip 按钮；正文 span 永无按钮兄弟——代码块的复制按钮是
       * <code> 的兄弟而非文本 span 的，气泡又是纯 div），即为 chrome。
       * 此判定抗 CSS-module 类名哈希，对用户行（MessageItem）与 AI 回合
       * 尾（TurnTailNodeView）同样成立。
       */
      function hasButtonSibling(span) {
        var parent = span.parentNode
        for (var s = parent.firstChild; s !== null; s = s.nextSibling) {
          if (s !== span && s.nodeType === 1
            && (s.tagName === 'BUTTON' || (s.querySelector('button') !== null && s.querySelector('button') !== undefined))) {
            return true
          }
        }
        return false
      }
      function isChromeText(node, row) {
        for (var el = node.parentNode; el !== null && el !== row; el = el.parentNode) {
          var tag = el.tagName
          if (tag === 'BUTTON' || tag === 'SVG') return true
          if (tag === 'SPAN' && hasButtonSibling(el)) return true
        }
        return false
      }
      function excerptOf(row) {
        var parts = []
        function visit(el) {
          for (var node = el.firstChild; node !== null; node = node.nextSibling) {
            if (node.nodeType === 3) {
              if (node.textContent.trim() !== '' && !isChromeText(node, row)) parts.push(node.textContent)
            } else if (node.nodeType === 1) {
              visit(node)
            }
          }
        }
        visit(row)
        return parts.join(' ').replace(/\s+/g, ' ').trim()
      }

      function showTip(el, entry) {
        if (tipTimer !== 0) { clearTimeout(tipTimer); tipTimer = 0 }
        // 只显示内容——刻度颜色已表达角色；摘录跳过操作栏 chrome，
        // 时间/统计后缀不会漏进来。
        var text = excerptOf(entry.row)
        if (text.length > 120) text = text.slice(0, 120) + '…'
        tip.textContent = text === '' ? '…' : text
        tip.style.display = 'block'
        var rect = el.getBoundingClientRect()
        tip.style.top = Math.round(rect.top - 8) + 'px'
        tip.style.left = Math.round(rect.left - tip.offsetWidth - 10) + 'px'
      }

      function hideTipSoon() {
        if (tipTimer !== 0) clearTimeout(tipTimer)
        tipTimer = setTimeout(function () { tip.style.display = 'none'; tipTimer = 0 }, HOVER_HIDE_MS)
      }

      function scheduleRefresh() {
        if (refreshTimer !== 0) return
        refreshTimer = setTimeout(refresh, 250)
      }

      /** 从当前滚动容器解绑（幂等）。 */
      function detach() {
        if (scrollport !== null) scrollport.removeEventListener('scroll', scheduleSyncView)
        if (contentObserver !== null) { contentObserver.disconnect(); contentObserver = null }
        if (resizeObserver !== null) { resizeObserver.disconnect(); resizeObserver = null }
        if (rail !== null && rail.parentNode !== null) rail.parentNode.removeChild(rail)
        if (tip !== null && tip.parentNode !== null) tip.parentNode.removeChild(tip)
        rail = null
        tip = null
        ticks = []
        scrollport = null
      }

      /** 扫描会话列，变化时（重新）绑定。 */
      /**
       * 菜单层级：我们的 ⋯ 下拉（dhb-smMenu）绝对定位在会话列的层叠
       * 上下文之内——压不过 body 级固定元素，菜单打开时轨道会盖住菜单
       * 项。（harness 自有的门户菜单纯 z-index 1100，本就在轨道的 500
       * 之上——只有我们的菜单需要处理。）body 观察器对菜单装卸都会
       * 触发，scan() 每趟复查，存在任意 dhb-smMenu 即隐藏轨道。
       */
      function syncMenuLayer() {
        if (rail === null) return
        var menuOpen = document.querySelector('.dhb-smMenu') !== null
        rail.setAttribute('data-menu-open', menuOpen ? '1' : '0')
        if (menuOpen) tip.style.display = 'none'
      }

      function scan() {
        syncMenuLayer()
        var found = document.querySelector('[data-conversation-scroll]')
        if (found === scrollport) return
        detach()
        if (found === null) return
        scrollport = found
        rail = document.createElement('div')
        rail.className = 'dhb-rail'
        tip = document.createElement('div')
        tip.className = 'dhb-railTip'
        tip.style.display = 'none'
        document.body.appendChild(rail)
        document.body.appendChild(tip)
        place()
        // 内容变化（流式输出、新消息、压缩换页）。
        contentObserver = new MutationObserver(scheduleRefresh)
        contentObserver.observe(scrollport, { childList: true, subtree: true })
        // 框架被挤压（工具坞）、列宽变化。
        if (typeof ResizeObserver === 'function') {
          resizeObserver = new ResizeObserver(function () { place(); scheduleRefresh() })
          resizeObserver.observe(scrollport)
        }
        scrollport.addEventListener('scroll', scheduleSyncView, { passive: true })
        refresh()
        syncMenuLayer()
      }

      var scanScheduled = false
      function scheduleScan() {
        if (scanScheduled) return
        scanScheduled = true
        requestAnimationFrame(function () { scanScheduled = false; scan() })
      }

      bodyObserver = new MutationObserver(scheduleScan)
      bodyObserver.observe(document.body, { childList: true, subtree: true })
      window.addEventListener('resize', scheduleScan)
      scan()

      return function () {
        bodyObserver.disconnect()
        detach()
        window.removeEventListener('resize', scheduleScan)
        if (refreshTimer !== 0) clearTimeout(refreshTimer)
        if (scrollRaf !== 0) cancelAnimationFrame(scrollRaf)
        if (tipTimer !== 0) clearTimeout(tipTimer)
      }
    }

    // ── 插件 apply ────────────────────────────────────────────────────────

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

      // 设置导航图标：把我们的节与外壳的齿轮兜底区分开（按标签匹配的
      // DOM 补丁；见 installSettingsNavIcons）。
      var disposeNavIcons = installSettingsNavIcons(t)

      // 会话消息刻度轨道：原生滚动条旁按用户/AI 消息摆刻度，点击跳转
      // （见 installChatRail）。
      var disposeChatRail = installChatRail(t)

      // ⋯ 菜单各工具面板的可用性，从宿主半探测（git 二进制/终端服务/
      // 监控数据源是否挂载）。用 store 而非 apply 时常量：探测结果可能
      // 晚于菜单挂载返回。合并式更新（读改写）——多个探测并发落地时
      // 任何一个都不得覆盖其余字段。
      var capabilities = createStore({ changes: false, terminal: false, monitor: false })
      var mergeCaps = function (patch) {
        capabilities.set(Object.assign({}, capabilities.getSnapshot(), patch))
      }
      api('/git/available')
        .then(function (value) { mergeCaps({ changes: value.available === true }) })
        .catch(function () { /* older host half: entry stays hidden */ })
      api('/terminal/available')
        .then(function (value) { mergeCaps({ terminal: value.available === true }) })
        .catch(function () { /* terminals service not mounted: entry stays hidden */ })
      api('/monitor/available')
        .then(function (value) { mergeCaps({ monitor: value.available === true }) })
        .catch(function () { /* monitor sources not mounted: entry stays hidden */ })

      // 会话头部 ⋯ 菜单（工具面板入口）——用右对齐的 utilities 行
      // （titleRow 右端），不用标题旁的 actions 组：视觉上是头部右上角、
      // 与标题同线，而不是挤在面包屑边上。
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

      // 文件变更/终端面板经 ⋯ 菜单 + 上面的右侧停靠面板
      // （ToolsOverlay）呈现——不进 conversation.view 的 tab 环，tab 栏
      // 只保留外壳自己的标签（聊天/轨迹）。
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

      // 不透明底部背垫（防闪烁）：footer 首个动作项，整条底部区域下
      // 方的绝对定位垫层。
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

      // 应用内确认对话框（可主题化的 window.confirm 替代），挂载在所有
      // 页面之上：市场标签页、各设置节、侧栏底部按钮都经此卡等待
      // showConfirm。
      var disposeConfirmSlot = slots.inject('shell.overlay', function () { // 改名避开 shared.js 的 disposeConfirm()（同名曾使其被遮蔽成死代码）
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

      // 侧栏底部设置旁的停止/重启按钮。宿主传 `wide`（false = 56px 轨
      // 道模式），切换连排与圆形两种形态。
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

      // 停止/重启期间的满屏状态卡。
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

      // 通知桥设置节（渠道/事件开关/测试/静音）。
      var disposeNotify = slots.inject('settings.section', function () {
        return slots.register(
          {
            name: 'settings.section',
            id: 'dsh-base-plugin-notify',
            order: 204,
            label: function () { return t('sectionNotify') },
            registrant: 'dsh-base-plugin',
          },
          function () { return h(NotifySection, { t: t }) },
        )
      })

      ctx.effect(function () {
        return function () {
          if (disposeStyles !== undefined) disposeStyles()
          disposeConfirm() // body 级对话框 DOM 拆除（shared.js）
          disposeSvcActions()
          disposeSvcOverlay()
          disposeFooterBackdrop()
          disposeConfirmSlot()
          disposeHeaderMore()
          disposeTools()
          disposeUsage()
          disposeMarket()
          disposePrompt()
          disposeMcp()
          disposeSkills()
          disposeNavIcons()
          disposeChatRail()
          disposeSessions()
          disposeMobile()
          disposeNotify()
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
