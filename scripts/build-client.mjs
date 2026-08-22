#!/usr/bin/env node
/**
 * build-client —— 把 src/ 下的源文件按固定顺序拼接成协议要求的单文件
 * client.js（web boot：每包一个 bundle、一个工厂，工厂内无相对导入）。
 *
 * 用法：node scripts/build-client.mjs [--check]
 *   --check  只校验 client.js 是否与源文件同步，不写盘（用于提交前守卫）
 *
 * 约定：
 *   - 每个源文件首行的 `// ══ 名称 ══ …` 模块文档头在构建时剥离，
 *     不进入产物；
 *   - 顺序表 ORDER 是唯一的拼接契约（文件间只有函数提升级的依赖，
 *     与原单文件语义一致）；
 *   - 产物头部写入生成戳（GENERATED 注释 + 源文件联合哈希），浏览器
 *     加载行为不受影响；--check 时校验该戳判断“改了 src 忘了构建”。
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 拼接顺序（= 原单文件内的分区顺序；调整它等于调整原文件的代码顺序）。 */
const ORDER = [
  'head',      // 工厂外壳
  'i18n',      // 词典
  'helpers',   // store/api
  'styles',    // CSS + injectStyles
  'shared',    // post/Banner/确认框/useLocaleVersion
  'market',    // 插件市场标签页
  'mcp',       // MCP 设置节
  'prompt',    // 系统提示词设置节
  'skills',    // 技能设置节
  'sessions',  // 会话管理设置节
  'mobile',    // 手机访问设置节
  'changes',   // 文件变更面板
  'terminal',  // 终端面板
  'usage',     // 用量统计节
  'moremenu',  // ⋯ 菜单
  'service',   // 停止/重启控制器
  'icons',     // 图标 + IME 判定
  'serviceui', // 服务控制 UI
  'panels',    // 工具坞
  'navicons',  // 导航图标补丁
  'rail',      // 消息刻度轨道
  'apply',     // apply 组装层
]

const DOC_HEADER = /^\/\/ ══ .*?\n/

const sources = ORDER.map((name) => {
  const raw = readFileSync(join(root, 'src', `${name}.js`), 'utf8')
  return { name, body: raw.replace(DOC_HEADER, '') }
})

const stamp = createHash('sha256')
  .update(sources.map((s) => s.body).join('\u0000'))
  .digest('hex')
  .slice(0, 12)

// 生成戳插在文件头注释块结束后（第二行 `*/` 之后）——纯注释，零运行时影响。
const built =
  sources[0].body.replace(
    /\*\/\n/,
    `*/\n// GENERATED from src/* by scripts/build-client.mjs — edit src/, then rebuild. stamp:${stamp}\n`,
  ) +
  sources.slice(1).map((s) => s.body).join('\n')

const clientPath = join(root, 'client.js')
const checkOnly = process.argv.includes('--check')

if (checkOnly) {
  const current = readFileSync(clientPath, 'utf8')
  const m = current.match(/^\/\/ GENERATED .*stamp:([0-9a-f]+)$/m)
  if (m === null) {
    console.error('✗ client.js 无生成戳——请先运行 pnpm build:client')
    process.exit(1)
  }
  if (m[1] !== stamp) {
    console.error(`✗ client.js 与 src/ 不同步（现有 ${m[1]}，应为 ${stamp}）——运行 pnpm build:client`)
    process.exit(1)
  }
  console.log(`✓ client.js 与 src/ 同步（stamp ${stamp}）`)
  process.exit(0)
}

writeFileSync(clientPath, built)
// 语法守卫：产物必须可解析
execFileSync(process.execPath, ['--check', clientPath], { stdio: 'inherit' })
console.log(`✓ client.js 已生成（stamp ${stamp}，${built.split('\n').length} 行）`)
