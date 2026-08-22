# DSH（DeepSeek Harness）官方插件参考手册

> 依据 `/Users/zxc/project/deepseek-harness` 源码整理（版本 0.1.1-rc.2，2026-08-21 从 0.1.0-rc.5 升级，854 个提交）。
> 0.1.1 主要变化：多模态图像管线（DeepSeek 视觉模型 + Files API 统一 + 附件规范编码）、凭据系统重构（可向用户请求凭据）、webserver 结构化 index 注入事件（`webserver/index-inject`，替代裸 HTML 变换的新机制）、Web UI 改进（宽表自适应/悬停滚动条/多行问答/自动开浏览器）、SQLite 持久化布局优化。
> 目标：日常查阅不需要再翻源码。

---

## 目录

1. [总览：DSH 中"插件"的两层含义](#1-总览)
2. [Cordis 核心概念速览](#2-cordis-核心概念速览)
3. [组合文件（cordis.yml）行格式](#3-组合文件cordisyml行格式)
4. [组合分层与加载顺序](#4-组合分层与加载顺序)
5. [官方插件行目录（Host 基础层）](#5-官方插件行目录host-基础层)
6. [官方插件行目录（Web 面补丁层）](#6-官方插件行目录web-面补丁层)
7. [Agent Preset（预设）体系](#7-agent-preset预设体系)
8. [动态 Cordis 插件（cordis_* 工具集）](#8-动态-cordis-插件cordis_工具集)
9. [动态插件开发规则速记](#9-动态插件开发规则速记)
10. [源码索引（偶尔需要深入时用）](#10-源码索引)

---

## 1. 总览

DSH 的能力全部由 Cordis 插件构成，"插件"有两层含义：

| 层 | 形态 | 生命周期 | 修改方式 |
|---|---|---|---|
| **静态组合行** | `cordis.yml` 里的一行 `- id: xxx, name: '@deepseek-ai/...'` | 随进程/会话启动加载 | 编辑组合文件（yml） |
| **动态 Cordis 插件** | 模型通过 `cordis_define`/`cordis_run` 工具注入的 JS 代码 | 临时挂在当前进程，重启即失 | 模型会话内 define/run |

两个平面（决定一行该放哪）：

- **Host 组合**：注册表本体（`tools`、`systemPrompt`、`agents`）、跨会话共享的东西（持久化、沙箱、审批、模型路由、子代理注册表及其后端）。进程内单实例。
- **Agent Preset**：单个会话贡献给注册表的内容（工具插件、persona、提示词段落、压缩策略）。每会话一份，随会话卸载。
- **判断准则**：一个 Service 若在 agent 面之外还有消费者，就不能移进 preset。典型例子 `subagents` 注册表是进程单例、被 api-proxy 跨会话查询 → 留 Host；preset 只贡献委托"工具"。

---

## 2. Cordis 核心概念速览

- **插件是实现 Service 的对象**：带 `inject` + `apply(ctx)` 的函数，或 `Service` 子类。
- **上下文是服务容器**：服务占据稳定的 `ctx.<key>`（如 `ctx.tools`、`ctx.llm`），按 key 查找而非导入实现。
- **`inject` 声明依赖**：声明后插件等待服务就绪才启动；加载顺序由服务依赖表达。
- **类型化事件**：`emit`（不 await、观察）/ `waterfall`（环绕中间件，有返回值）/ `parallel`（await 并行）/ `serial`（await 按序）。模式是事件契约的一部分。
- **注册必须可逆**：用 `ctx.effect()` / `ctx.on()` 或返回 disposer 的官方 API；teardown 时自动撤销。

Waterfall 语义：监听器收 `(...args, next)`；调 `next()` 走下游并拿返回值；不调直接 return 即短路。策略型监听器可短路，观察型必须委托。

---

## 3. 组合文件（cordis.yml）行格式

```yaml
- id: tool-bash                # 行 ID（补丁层按 id 覆盖）
  name: '@deepseek-ai/dsh-tool-bash'   # 包名；cordis:group / cordis:include 是内建协议前缀
  config: { ... }              # 插件配置（支持 !!js 表达式，注入服务激活后插值）
  inject: [webStartup]         # 声明服务依赖（字符串数组或 {required, optional} 对象）
  disabled: true               # 禁用该行（config 无法禁用，只能靠 disabled 字段）
  group: true                  # 分组容器
  isolate: { planMode: true }  # isolate realm：组内服务对外隔离
```

要点：

- 补丁按 `id` 定位，**整体替换**目标行的 `config`（不合并），所以每行重述自己拥有的全部键。
- `!!js` 表达式在声明的注入激活后、基于插件上下文插值（如 `!!js ctx.webStartup.port ?? 3080`）。
- 行顺序无加载语义（激活由服务可用性驱动），分组仅为可读性。

---

## 4. 组合分层与加载顺序

```
空 profile 根
 └─ dsh-base bundle patch（packages/bundle/base/cordis.patch.yml）—— 所有共享核心行
     └─ dsh-web-app bundle patch（packages/bundle/web-app/cordis.patch.yml）
         └─ profile 自己的 cordis.patch.yml
             └─ --patch 命令行 overlay
```

- 后层按 id 覆盖前层整行 config；`insert` 追加新行。
- Web 层把 agent 面的行（tool-bash、tool-fs、tool-subagent 等）**disable**（不是删除），改由每个会话挂载 preset。
- 挂载 preset 的行：`agent-presets`（`@deepseek-ai/dsh-agent-presets`，config.default: standard）。

---

## 5. 官方插件行目录（Host 基础层）

来自 `packages/bundle/base/cordis.patch.yml`，按功能分组：

### 框架与基础服务

| 行 id | 包名 | 用途 |
|---|---|---|
| `timer` | `@deepseek-ai/cordis-plugin-timer` | Cordis 定时器（ctx.timeout/interval 等，随 Fiber 回收） |
| `hmr` | `@deepseek-ai/cordis-plugin-hmr` | 客户端插件热重载 |
| `llm` | `@deepseek-ai/dsh-llm` | LLM 抽象层 |
| `llm-retry` | `@deepseek-ai/dsh-llm-retry` | 请求重试 |
| `llm-deepseek` | `@deepseek-ai/dsh-llm-deepseek` | DeepSeek 官方适配器（key/endpoint 走 settings 与凭据） |
| `llm-pi-ai` | `@deepseek-ai/dsh-llm-pi-ai` | 多提供商孪生，默认休眠，settings 供给后激活 |
| `session` | `@deepseek-ai/dsh-session` | 会话域 |
| `typert` / `typert-loader` / `typert-gateway` | dsh-typert-* | 类型协议注册表/加载器/API 网关 |
| `agent` | `@deepseek-ai/dsh-agent` | Agent 定义 |
| `agent-loop` | `@deepseek-ai/dsh-agent-loop` | 启动时创建的 agents（base 为空） |
| `agent-default-model` | `@deepseek-ai/dsh-agent-default-model` | 默认模型路由 |
| `settings` | `@deepseek-ai/dsh-settings-file` | 用户设置文档（$DSH_HOME/settings.yaml，热重载） |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | 凭据源（环境变量 > 托管文档 > .env） |
| `subprocess` | `@deepseek-ai/dsh-subprocess-local` | 子进程服务 |

### 会话持久化与检索

| 行 id | 包名 | 用途 |
|---|---|---|
| `session-persistence-jsonl` | `@deepseek-ai/dsh-session-persistence-jsonl` | JSONL 会话日志 |
| `session-query-sqlite` | `@deepseek-ai/dsh-session-query-sqlite` | 全文检索（默认 `openAt: never` 只挂服务不打开） |
| `session-projection` | `@deepseek-ai/dsh-session-projection` | 投影注册表 |
| `session-title` / `session-title-llm` | dsh-session-title* | 会话标题（规则 + LLM） |
| `attachment-local` | `@deepseek-ai/dsh-attachment-local` | 图片等二进制附件（内容寻址） |
| `session-telemetry-otel` | `@deepseek-ai/dsh-session-telemetry-otel` | OTel 遥测（默认 DISABLED，DSH_TELEMETRY_MODE 开启） |
| `session-checkpoint-policy` | `@deepseek-ai/dsh-session-checkpoint-policy` | 每次模型请求前的持久化检查点 |

### 沙箱与权限

| 行 id | 包名 | 用途 |
|---|---|---|
| `sandbox` | `@deepseek-ai/dsh-sandbox-local` | 文件效应边界 |
| `sandbox-policy` | `@deepseek-ai/dsh-sandbox-policy` | 沙箱模式（DSH_PERMISSION_MODE，默认 workspace-write） |
| `bash-sandbox` / `pwsh-sandbox` | dsh-bash/pwsh-sandbox | shell 执行器（按平台二选一启用） |
| `approval` | `@deepseek-ai/dsh-user-approval` | 审批策略（danger-full-access → never，否则 ask） |
| `permission` | `@deepseek-ai/dsh-permission-presets` | 三档权限预设（read-only / workspace-write / danger-full-access） |
| `fs-sandbox` | `@deepseek-ai/dsh-fs-sandbox` | 受沙箱约束的文件系统提供者 |
| `fs-observation-policy` | `@deepseek-ai/dsh-fs-observation-policy` | 读文件工具的策略 |
| `shell-env` | `@deepseek-ai/dsh-shell-env` | shell 环境变量（DSH_WEB_URL 等；**必须留 Host 面**） |

### 模型工具（tool-*）

| 行 id | 包名 | 用途 |
|---|---|---|
| `tool-bash` / `tool-pwsh` | dsh-tool-bash/pwsh | shell 工具（按平台） |
| `tool-jobs` | `@deepseek-ai/dsh-tool-jobs` | 后台任务控制（注册表在 Host 面） |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | 文件读写 |
| `tool-fs-search` | `@deepseek-ai/dsh-tool-fs-search` | glob/grep 搜索 |
| `tool-str-replace-editor` | `@deepseek-ai/dsh-tool-str-replace-editor` | 精确文本编辑 |
| `tool-todo` | `@deepseek-ai/dsh-tool-todo` | 任务清单 |
| `tool-goal` | `@deepseek-ai/dsh-tool-goal` | 同会话持久目标 |
| `tool-web` | `@deepseek-ai/dsh-tool-web` | web_search（fetch 默认禁用） |
| `web` / `web-search-deepseek` | dsh-web* | web 服务与 DeepSeek 搜索提供者 |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | skill 目录与加载 |
| `tool-subagent-control` | `@deepseek-ai/dsh-tool-subagent-control` | interrupt_agent 等控制 |
| `tool-subagent-list-agents` | `.../list-agents` | list_agents |
| `tool-subagent` | `@deepseek-ai/dsh-tool-subagent` | 后台子代理（provider: spawn，continuable） |
| `tool-subagent-fork` | `@deepseek-ai/dsh-tool-subagent` | fork 子代理（one-shot） |
| `tool-subagent-report` | `@deepseek-ai/dsh-tool-subagent-report` | 子代理回传通道 |
| `tool-workflow` | `@deepseek-ai/dsh-tool-workflow` | 多代理 workflow 编排 |
| `tool-ralph` | `@deepseek-ai/dsh-tool-ralph` | 全新代理 Ralph 迭代 |
| `tool-result-pruner` | `@deepseek-ai/dsh-compaction-tool-result-pruner` | 超大工具结果预压缩 |
| `repeat-tool-reminder` | `@deepseek-ai/dsh-repeat-tool-reminder` | 连续重复工具调用提醒 |

### 提示词、技能、命令

| 行 id | 包名 | 用途 |
|---|---|---|
| `system-prompt` | `@deepseek-ai/dsh-system-prompt` | persona 段落（默认空） |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | AGENTS.md 注入（maxBytes 64K） |
| `skill` / `skill-filesystem` / `skill-badge` | dsh-skill* | skill 注册表 / 文件系统发现 / 徽章 |
| `commands` | `@deepseek-ai/dsh-commands` | 斜杠命令注册表 |
| `command-feedback` | `@deepseek-ai/dsh-command-feedback` | `/feedback` |
| `command-compact` | `@deepseek-ai/dsh-command-compact` | `/compact` |
| `command-goal` | `@deepseek-ai/dsh-command-goal` | `/goal` |
| `plan-mode` | `@deepseek-ai/dsh-plan-mode` | 计划模式（exit_plan_mode） |
| `user-questions` | `@deepseek-ai/dsh-user-questions` | ask_user_question 通道 |

### 子代理与压缩

| 行 id | 包名 | 用途 |
|---|---|---|
| `subagent` | `@deepseek-ai/dsh-subagent` | 子代理注册表（进程单例） |
| `subagent-spawn-in-process` | `...spawn-in-process` | spawn 后端（providerName: spawn） |
| `subagent-fork-in-process` | `...fork-in-process` | fork 后端 |
| `workflow-worker-thread` | `@deepseek-ai/dsh-workflow-worker-thread` | workflow 执行后端 |
| `token-meter` | `@deepseek-ai/dsh-token-meter` | token 计量（Host 面单例） |
| `compaction-basic` | `@deepseek-ai/dsh-compaction-basic` | 自动压缩 |
| `goal` / `goal-round-driver` | dsh-goal* | 目标服务与续跑驱动 |
| `timeout-policy` | `@deepseek-ai/dsh-tool-call-timeout-policy` | 工具调用超时 |
| `spill-local` / `spill-policy` | dsh-spill* | 大结果外溢（maxInlineBytes 50000） |
| `jobs` | `@deepseek-ai/dsh-jobs-local` | 后台任务注册表 |

---

## 6. 官方插件行目录（Web 面补丁层）

来自 `packages/bundle/web-app/cordis.patch.yml`，在 base 之上 `insert`：

### Host 侧（Node）

| 行 id | 包名 | 用途 |
|---|---|---|
| `code-runtime` | `dsh-code-runtime-worker-thread` | 代码执行运行时 |
| `storage` / `storage-json` / `storage-domain` | dsh-storage* | 存储抽象 / JSON 后端 / 域层 |
| `message-feedback` | `dsh-message-feedback` | 消息点赞/点踩 |
| `session-log-download` | `dsh-session-log-export` | `/export` 会话导出 |
| `workspace` | `dsh-workspace` | 工作区域 |
| `session-projection-cache` | `dsh-session-projection-cache` | 投影缓存 |
| `session-stats` | `dsh-session-stats` | 会话统计 |
| `session-reference` | `dsh-session-reference` | 会话引用域（0.1.1 新增） |
| `file-reference-local` | `dsh-file-reference-local` | 本地文件引用（0.1.1 新增） |
| `directory-picker` | `dsh-host-directory-picker-auto` | 目录选择器（自动挑 native/browse） |
| `plugin-inventory` | `dsh-host-plugin-inventory` | Loader 插件清单只读投影 |
| `api-gateway` | `dsh-host-apiproxy` | API 网关（/api） |
| `cordis-host-runner` | `dsh-cordis-host-runner` | **动态插件 Host 半**（见第 8 节） |
| `web-startup` | `dsh-web-app/startup` | 命令行 flag 解析 |
| `webserver` | `dsh-host-webserver` | HTTP 服务（默认 127.0.0.1:3080） |
| `web-runtime` | `dsh-web-app` | 前端 dist、信任网、URL 打印 |

### 浏览器侧（dsh.client 行）

| 行 id | 包名 | 用途 |
|---|---|---|
| `client-hmr` | `dsh-client-hmr` | 客户端插件热重载链 |
| `modules` | `dsh-client-modules` | 模块表（window.__DSH_BOOT__ 组装） |
| `connection` | `dsh-client-connection` | fetch/SSE 传输 |
| `api-remotes` | `dsh-api-remotes` | Remote 协议客户端 |
| `client-runtime` | `dsh-client-runtime` | 浏览器运行时（含 Slot 注册表） |
| `cordis-client-runner` | `dsh-cordis-client-runner` | **动态插件浏览器半** |
| `ui-theme` / `locale` | dsh-client-ui-theme / locale | 主题 / 国际化 |
| `ui-layout` / `ui-sidebar` | dsh-client-ui-* | 布局 / 侧栏 |
| `ui-settings` (+general/models/plugin-inventory/plugins) | dsh-client-ui-settings* | 设置页各节 |
| `ui-conversation` | dsh-client-ui-conversation | 会话流 |
| `ui-tool` | dsh-client-ui-tool | 工具调用树与业务视图 |
| `ui-cordis` | `dsh-client-ui-cordis` | **动态插件面板/审批 UI** |
| `ui-workflow-run` / `ui-deliverables` / `ui-workspace` | dsh-client-ui-* | workflow 卡 / 产出文件 / 工作区 |
| `ui-input-trigger` / `ui-commands` / `ui-skill` / `ui-subagent` | dsh-client-ui-* | 输入触发 / 命令面 / 技能 / 子代理引用 |
| `ui-reference` | dsh-client-ui-reference | 引用源（文件/会话引用，0.1.1 新增） |
| `ui-renderer` | dsh-client-ui-renderer | 渲染器（0.1.1 新增） |
| `ui-brand-official` | dsh-client-ui-brand-official | 官方品牌占位（侧栏/会话品牌槽，0.1.1 新增） |
| `ui-attachment` | dsh-client-ui-attachment | 附件 UI（多模态图像管线，0.1.1 新增） |
| `ui-jobs` / `ui-goal` / `ui-message-feedback` | dsh-client-ui-* | 后台任务 / 目标条 / 反馈条 |
| `ui-model-selection` / `ui-permission` / `ui-agent-preset` | dsh-client-ui-* | 模型选择 / 权限 / 预设选择 |
| `ui-plan` / `ui-user-questions` / `ui-trajectory` | dsh-client-ui-* | 计划座 / 用户提问 / 轨迹 |

### Web 层的关键 disable

`tool-bash/pwsh、tool-jobs、tool-fs、tool-fs-search、tool-str-replace-editor、skill-filesystem、tool-skill、tool-goal、plan-mode、compaction-basic、command-compact、tool-result-pruner、tool-subagent*、workflow-worker-thread、tool-workflow、tool-ralph、agent-instructions、tool-todo、tool-web` 全部 disabled —— 改由每个会话的 agent preset 提供。

---

## 7. Agent Preset（预设）体系

### 位置与信任

| 根 | 路径 | 信任级 |
|---|---|---|
| 随部署发行（只读！） | `apps/cli/config/agent-presets/`（安装后位于部署自身 config 旁） | `system` |
| 用户自建 | `${DSH_HOME:-$HOME/.dsh}/.agent-presets/<id>/` | `user`（等同 shell 权限） |

**绝对不要编辑/删除发行版 preset**：升级会覆盖；弄坏 `cordis` 预设会让预设创作模式本身失效。要改行为 → 复制成新目录改副本。

### 预设目录结构

```
<id>/
├── agent.cordis.yml   # 组合（必需）
├── preset.yml         # 显示元数据（建议）：name / description / order
└── skills/            # 随预设分发的技能（可选）
```

### 发行版预设

| id | name | order | 说明 |
|---|---|---|---|
| `standard` | 标准模式 | 1 | 全功能编码 Agent |
| `minimal` | — | — | 最小集 |
| `code` | — | — | 代码模式 |
| `cordis` | 创造模式 | 4 | standard + `tool-cordis` 自引用工具集 + 组合创作技能 |

### `cordis` 预设的独有行

- `persona`：声明"可以读改自己运行的平台"、两平面归属规则、预设创作路径。
- `tool-cordis`：`@deepseek-ai/dsh-tool-cordis`（动态插件工具集，见下节）。
- `skill-filesystem`：customSkillDirs 指向预设自带 `skills/`，分发两个技能：
  - `editing-cordis-compositions` —— 组合/预设创作规范
  - `cordis-plugin-development` —— 动态插件开发规范
- 其余行与 standard 一致；`planning`、`compaction`、`delegation` 三个 group 使用 `isolate` realm 隔离组内服务。

### 预设服务（roster）

`ctx.agentPresets`：`list()`（id/trust/path）、`read(id)`、`copy(from, id, name?)`、`standingKeyFor(id)`（挂载校验）。相关事件 `agent-preset/selected`。

---

## 8. 动态 Cordis 插件（cordis_* 工具集）

### 参与包

| 包 | 角色 |
|---|---|
| `@deepseek-ai/dsh-cordis-host-runner` | Host 半：注册表、审批、node:vm 沙箱、invoke |
| `@deepseek-ai/dsh-cordis-client-runner` | 浏览器半：编排器、加载引擎、slot 目录、timer |
| `@deepseek-ai/dsh-tool-cordis` | 模型工具 + 系统提示段 + @pluginId 注入 |
| `@deepseek-ai/dsh-client-ui-cordis` | 面板 / Run 卡 / 审批交互 |

### 六个模型工具

| 工具 | 作用 |
|---|---|
| `cordis_inspect_list` | 列出 Host/Client 全部 Inspect Provider 及方法/Schema |
| `cordis_inspect_query` | 只读查询：Service/Event/Builtin/Slot/主题 token/Tool 的精确契约 |
| `cordis_inspect_self` | 自检：无参列 Plugin 概要；+pluginId 列版本指针；+packageId 读源码与诊断 |
| `cordis_define` | 定义不可变 Package（新建 Plugin 或给已有 Plugin 追加版本） |
| `cordis_run` | 激活（mode: run 首次/重启/回滚；update 切换版本） |
| `cordis_stop` / `cordis_undefine` | 停用（保留版本）/ 永久删除 |

### 身份与版本模型

| ID | 形如 | 含义 |
|---|---|---|
| `pluginId` | `<prefix>-N`（prefix 为 3–6 小写字母） | Plugin 稳定身份 |
| `packageId` | `pkg-N` | 不可变版本（define 顺序追加，永不覆盖） |
| `pluginRunId` | `run-N` | 一次激活尝试 |
| approval id | `approval-N` | 一次审批请求 |

- `currentPackageId`：最近一次完全成功的版本；`nextPackageId`：目标/失败版本。
- 失败后旧 current 保留；update 失败不会自动回滚，需手动 `run` 回滚或 `update` 重试。
- **审批**：带 Client 半且未授权的包 → `awaiting-approval`（单勾授权当前包，双勾授权该 Plugin 未来所有版本）；授权后返回 `starting` 异步继续。结果通过 steering 消息回报，不要在同一轮里等。
- 用户拒绝后**不要**再次请求同一激活。

### 生命周期与容错

- Host 半在 `node:vm` 沙箱求值 → `guardedPlugin` 包装 → 挂到 `cordis-dynamic` 组 Fiber 下。
- 所有副作用（Service/Event/Tool/Slot/timer/theme）必须挂当前 Fiber，stop/update 自动回收。
- 异步失败（host-load/client-apply/client-render/guard）会 steer 回模型，附诊断；修复 = 同一 Plugin define 新 Package + `run mode:"update"`。
- `@pluginId` 用户引用：pre-step 注入上下文，指明以该包为修改基线，禁止另起 Plugin。

---

## 9. 动态插件开发规则速记

### 平台选择

| 需求 | 平台 |
|---|---|
| 文件、命令、进程、网络、Agent/Session 访问、模型工具、给 Client 的 JSON 方法 | Host |
| 主题、布局、页面状态、工具卡、Slot UI | Client |

### Host 沙箱约束

- 纯 JS，无 TypeScript/JSX/import/bundler；Client React 用 `React.createElement`。
- 不可用：`require`、`process`、`Buffer`、`setTimeout` 系列、`fetch`、Node API → 改用 Cordis 服务（`inject: ['fs'/'web'/'bash'/'timer']`）。
- 可用内建：`ctx`（受限 façade）、`harness`（handle/defineTool/registerTool）、`console`（带包 tag）、`btoa/atob`、`TextEncoder/TextDecoder`。

### ctx façade 白名单

- 允许：`ctx.get(name)`（可选查找）、`ctx.on/once/provide/effect`、timer 动词（需 inject timer）、`ctx.tools.register/schemas/get`。
- 服务属性访问必须先在 `inject` 声明；框架内部（root/fiber/registry/…）一律拒绝；façade 只读。
- Service 返回 Context 会被拒绝。

### 高频错误

```js
// ✅ 正确：硬依赖 inject，可选服务 ctx.get
return {
  inject: ['requiredService'],
  apply(ctx) {
    const opt = ctx.get('optionalService')
    if (opt !== undefined) opt.someMethod()
  },
}
```

- Host↔Client 通信：Client → `host.call(method, args)`；Host → `harness.handle(method, handler)`；只过无损 JSON。
- 禁止对 Service/Event/Session 等活对象 `JSON.stringify`/深拷贝；只取所需叶子字段。
- 每个副作用可逆：`ctx.effect()` / `ctx.on()` / 返回 disposer 的官方 API。
- 写码前先 `cordis_inspect_list` → `cordis_inspect_query` 查真实契约，不要凭名字猜 API。

---

## 10. 源码索引

偶尔需要深入时按图索骥（均相对 `/Users/zxc/project/deepseek-harness/`）：

| 内容 | 路径 |
|---|---|
| Cordis 框架 vendor 源码 | `vendor/cordis/src/`（context/fiber/registry/events/service） |
| Loader（cordis.yml 解析） | `vendor/loader/src/` |
| 基础层组合 | `packages/bundle/base/cordis.patch.yml` |
| Web 面组合 | `packages/bundle/web-app/cordis.patch.yml` |
| 发行版预设 | `apps/cli/config/agent-presets/{standard,code,minimal,cordis}/` |
| 动态插件 Host 半 | `packages/extensions/cordis-host-runner/src/`（index 1274 行：Service 本体；registry/sandbox/guard/lifecycle） |
| 动态插件 Client 半 | `packages/extensions/cordis-client-runner/src/client/`（orchestrator/runtime/evaluator/guard/slot-catalog） |
| 模型工具定义 | `packages/extensions/tool-cordis/src/`（index.ts 530 行；api-catalog.ts 4751 行 API 目录） |
| 动态插件 UI | `packages/extensions/ui-cordis/src/client/`（CordisPanel/RunRow/DefineRow） |
| 插件清单投影 | `packages/host/plugin-inventory/src/` |
| 预设服务 | `packages/preset/agent-presets/src/`（discovery/authoring/mount/preset） |
| 预设技能文档 | `apps/cli/config/agent-presets/cordis/skills/{editing-cordis-compositions,cordis-plugin-development}/SKILL.md` |
| Cordis 入门文档 | `docs/cordis-primer.zh.md`、`docs/cordis-tutorial/`、`docs/architecture.zh.md` |
| 组合示例 | `examples/*/cordis.yml`（web-cordis、headless-agent 等） |

---

*整理自源码静态阅读；工具与行为的权威描述以会话内的 `cordis-plugin-development` / `editing-cordis-compositions` Skill 和 `docs/` 为准。*
