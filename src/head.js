// ══ head ══ 文件头 + 工厂注册外壳：window.__ModuleLoader__.load 工厂开头、React/h 获取。整个插件的入口骨架。
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
window.__ModuleLoader__.load({
  id: 'dsh-base-plugin',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
