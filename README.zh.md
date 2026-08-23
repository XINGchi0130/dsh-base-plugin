# dsh-base-plugin

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的增强插件：**插件市场、MCP 管理、会话管理、手机访问、通知推送、终端、文件变更、提示词优化**等 12 项能力——全部通过设置页面与工具坞提供，**不改动 DSH 源代码**。界面中英双语（跟随 DSH 语言设置），所有页面适配手机屏幕。

## 功能特性

| 功能 | 入口 | 一句话说明 |
|---|---|---|
| **插件市场** | 设置 → 插件 | 搜索 GitHub 生态认证插件，一键安装/卸载（含 DSH 插件校验与自动回滚） |
| **MCP 管理** | 设置 → MCP | YAML 直编服务器列表，保存即热加载；每台服务器实时状态与**健康面板**（调用量/失败率/延迟） |
| **技能管理** | 设置 → 技能 | 浏览已注册技能；`~/.dsh/skills/` 下的可新建/编辑/删除，写入即热注册 |
| **系统提示词** | 设置 → 系统提示词 | 编辑全局人设（对所有会话生效），支持 `{{model}}`/`{{cwd}}` 变量，保存即热加载 |
| **用量统计** | 设置 → 用量 | 全会话 token 汇总、按模型费用估算（单价可编辑）、31 天趋势、Top 会话 |
| **会话管理** | 设置 → 会话 | 全部持久化会话列表（筛选/搜索）、删除（实时从侧栏消失）、导出 MD/Zip、**时间机器**（从任意轮次分叉） |
| **通知** | 设置 → 通知 | 回合结束/任务完结/审批等待/上下文将满 → **浏览器通知**（零配置；页面需保持打开——后台标签即可，切回时自动补拉）/ Bark / ntfy / webhook |
| **手机访问** | 设置 → 手机访问 | 局域网扫码配对，手机使用完整 DSH 界面（HMAC 设备 Cookie + 指数退避防爆破） |
| **文件变更** | 会话 ⋯ 菜单 | 三标签：**工作区变更**（git 基线 diff，纯只读）+ **提交历史**（本地未推送/远程已推送分段，点提交展开 diff）+ **操作记录**（AI 读写/bash 轨迹，含 ±行数与成败） |
| **终端** | 会话 ⋯ 菜单 | 多 PTY 终端：Enter 执行、Ctrl+C 中断、流式输出 |
| **监控** | 会话 ⋯ 菜单 | 三标签：**概览**（轮次/耗时/token/上下文水位）、**任务**（后台作业+子代理树）、**系统**（CPU/内存/负载，压力口径） |
| **提示词优化** | 会话 ⋯ 菜单 | 大白话输入 → 默认模型重写为结构化提示词，一键复制 |
| 消息刻度轨道 | 会话内（自动） | 滚动条旁刻度条：蓝=用户/绿=AI 消息，点击跳转、悬停预览 |
| 服务停止/重启 | 侧栏底部 | 优雅退出（会话先落盘）；重启原地刷新不开新标签页 |

所有工具面板均为停靠在聊天右侧的真实列（应用框架随之收窄，不遮挡内容），左缘可拖拽调宽，面板间原地切换。

## 环境要求

- DeepSeek Harness（DSH）运行中的 web 部署 [待补充：最低 DSH 版本]
- Node.js ≥ 20（随 DSH 宿主）[待补充：确认的最低版本]
- git（可选——文件变更面板需要，无则入口自动隐藏）
- pnpm（插件市场安装需要）

## 快速开始

```bash
# 1. 在 dsh web profile 中安装本插件
cd ~/.dsh/profiles/web
pnpm add /path/to/dsh-base-plugin

# 2. 将组合行加入 profile 级补丁（注意：不是 ~/.dsh/cordis.patch.yml——
#    home 补丁作用于所有 profile，而本插件只在其依赖所在 profile 可解析）
cat >> cordis.patch.yml <<'EOF'
- insert:
    - id: dsh-base-plugin
      name: dsh-base-plugin
EOF

# 3. 重启 dsh web，设置里即可看到新页面
```

市场搜索 GitHub 限流时，在 dsh 进程环境设置 `GITHUB_TOKEN` 提升额度。

## 使用示例

**安装一个市场插件**：设置 → 插件 → 插件市场标签 → 搜索关键词（中英文均可）→ 认证行带“topic 认证”徽章 → 点「安装」→ 组合行写入受管区块并热加载。

**配置 MCP 服务器**：设置 → MCP → YAML 编辑器中写：

```yaml
- transport: stdio
  serverName: my-server
  command: npx
  args: [-y, @some/mcp-server]
```

保存即热加载；健康面板随之累积该服务器的调用量与失败率。

**从任意轮次分叉会话**：设置 → 会话 → 某行「回到过去」→ 列出全部已完成轮次 → 选一轮「从此轮分叉」→ 子会话即时出现在侧栏。

**提示词优化**：会话 ⋯ 菜单 → 提示词 → 大白话写想法（Cmd/Ctrl+Enter）→ 得到结构化提示词 → 一键复制。

## 目录结构

```
dsh-base-plugin/
├── index.js               # 宿主半入口：状态迁移、受管区块、路由注册、通知桥/代理装配
├── client.js              # 浏览器半（构建产物，单文件协议约束）
├── lib/                   # 宿主功能模块
│   ├── routes.js          # /dsh-base-plugin/api/* 表驱动分发器（单飞锁/同源/Host 白名单）
│   ├── routes/            # 各功能域路由
│   ├── market.js          # GitHub 市场搜索（缓存/单飞/软匹配）
│   ├── installer.js       # pnpm 安装 + id 冲突栅栏 + spec 白名单
│   ├── monitor.js         # 会话监控数据面（投影+token 折叠+子代理树）
│   ├── mcp-health.js      # MCP 健康聚合（两级聚合+epoch 栅栏）
│   ├── file-ops.js        # 操作记录折叠（write/edit/read/bash）
│   ├── export.js          # Markdown 转写折叠
│   ├── timemachine.js     # 轮次清单 + 官方 fork
│   ├── notify.js          # 通知桥（Bark/ntfy/webhook + 上下文守卫）
│   ├── prompt-optimizer.js# 提示词优化（官方 llm 服务）
│   ├── sessions.js        # 会话删除（五步幂等）+ 导出/时间机器
│   ├── git.js             # 基线/状态/diff（numstat -z）
│   ├── sysres.js          # 系统资源采样（压力口径内存）
│   ├── mobile/            # 手机访问（代理/认证/二维码/PWA）
│   └── ...
├── src/                   # 浏览器半源码（25 模块，构建拼接成 client.js）
├── scripts/
│   ├── build-client.mjs   # 构建链（hooks 检查/ORDER 断言/逐字节校验）
│   ├── check-hooks.mjs    # React hooks 顺序静态检查
│   └── verify-routes.mjs  # 路由面 golden 快照
└── cordis.patch.yml       # 本包组合层声明
```

## 常见问题

**手机上会话列表是空的？**
手机访问代理已内置 `crypto.randomUUID` polyfill（局域网 HTTP 不是浏览器安全上下文）；若仍为空，确认代理端口未被防火墙拦截。

**市场搜索报限流？**
无 Token 时 GitHub API 限额 10 次/分钟。在 dsh 进程环境设置 `GITHUB_TOKEN` 并重启。

**重启后浏览器多开了一个标签页？**
已修复（re-exec 追加 `--no-open`）。旧版本请升级。

**文件变更面板显示“没有变更”？**
面板展示的是**相对基线（git 上次提交）的差异**——不是磁盘文件清单。所有改动已提交时会正确显示为空；点面板内「刷新」拉取最新。

**操作记录里没有 bash 改的文件？**
设计如此：操作记录展示 AI 经 write/edit 工具的轨迹；经 bash 的文件改动在「工作区变更」（git）标签可见——两个标签互补。

**MCP 服务器删了又出现？**
受管区块由状态文件 `$DSH_HOME/dsh-base-plugin.json` 重新生成。请通过设置页删除，勿手改 `cordis.patch.yml` 受管区块（标记外内容可自由编辑）。

## 安全说明

- 状态文件 `0o600` 权限（含 HMAC 密钥），与 DSH 自带凭据同标准
- 配对码 8 字符（约 40 位熵）、单次使用、按 IP 指数退避；设备 Cookie HMAC-SHA256 签名、HttpOnly、30 天滑动续期，可逐个吊销或一键轮换全部
- HTTP 边界：全方法同源检查 + 回环 Host 白名单（防 DNS rebinding）；进程执行无 shell + spec 白名单；技能名 kebab-case 校验（无路径穿越）
- 手机访问传输为局域网 HTTP——远程使用请配合 Tailscale 等加密组网

## 开发说明

浏览器半受协议约束为单文件，但源码拆分编写。编辑 `src/` 后：

```bash
pnpm build:client     # 重新生成 client.js（含 hooks 检查与语法校验）
pnpm check:client     # 校验逐字节同步（pre-commit 钩子自动重建）
```

构建链含三道防线：hooks 顺序静态检查、`src/` 与产物逐字节比对、路由面 golden 快照（`node scripts/verify-routes.mjs`）。

## 工作原理（简）

- **宿主半**（`index.js` + `lib/`）在 DSH web 服务器提供 `/dsh-base-plugin/api/*`
- 权威状态存于 `$DSH_HOME/dsh-base-plugin.json`；`~/.dsh/cordis.patch.yml` 的受管区块（`# >>> dsh-base-plugin managed` 标记之间）始终由状态重新生成，dsh 实时监听该文件——改动无需重启
- **浏览器半**（`client.js`）经标准插槽注册界面，locale 服务双语化
- 统计/健康/操作记录均从官方服务与持久化日志增量折叠（seq 游标 + 单飞 + epoch 栅栏），轮询近零开销

## 许可

MIT
