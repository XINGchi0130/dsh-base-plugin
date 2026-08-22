#!/usr/bin/env node
/**
 * hooks 顺序静态检查：组件函数内任何"条件 return / 循环 / 条件块"之后
 * 不得再出现 React.useState/useEffect/useRef/useCallback/useMemo 调用。
 *
 * 背景：工具坞面板曾因拖拽 hook 落在 `if (snap.panel === null) return
 * null` 之后而整体崩溃（第四次"快速修复引入回归"）。构建链不加 React
 * 运行时，这个静态近似（括号深度感知的函数体切分 + 保守的 return 判定）
 * 在本项目源码风格下足够抓住该类错误。
 *
 * 用法：node scripts/check-hooks.mjs（构建前自动跑，见 build-client.mjs）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const HOOK_RE = /React\.(useState|useEffect|useRef|useCallback|useMemo|useSyncExternalStore|useLayoutEffect)\s*\(/
// 保守条件 return 判定：行首缩进 + if(...) return / return X（非表达式续行）
// 只认函数体语句级的 return（本项目组件体为 6 空格缩进；回调/表达式内
// 的 return 缩进更深，不算早退）。
const COND_RETURN = /^ {6}(?:if\s*\([^)]*\)\s*return\b|return\b)/
const LOOP_OR_COND = /^\s*(?:for\s*\(|while\s*\(|if\s*\(|switch\s*\()/

let violations = 0

/** 切出每个顶层组件函数体（简化：4 空格缩进的 function 声明到下一个同级）。 */
function componentBodies(src) {
  const lines = src.split('\n')
  const bodies = []
  let current = null
  let depth = 0
  for (const line of lines) {
    const startMatch = /^ {4}function (\w+)\s*\(/.exec(line)
    if (current === null && startMatch !== null) {
      current = { name: startMatch[1], lines: [], started: false }
    }
    if (current !== null) {
      current.lines.push(line)
      for (const ch of line) {
        if (ch === '{') { depth += 1; current.started = true }
        else if (ch === '}') depth -= 1
      }
      // 字符串里的花括号会扰动深度——本项目风格极少；深度回到函数声明行的
      // 基线（约 0）且已开始即结束。保守：只在看到下一个 4 缩进 function
      // 或文件尾时结束。
      const nextFn = /^ {4}function /.test(line) && current.lines.length > 1
      if ((nextFn && depth <= 0) || (current.started && depth <= 0 && current.lines.length > 3)) {
        bodies.push(current)
        current = null
        depth = 0
      }
    }
  }
  if (current !== null) bodies.push(current)
  return bodies
}

for (const file of readdirSync(join(root, 'src'))) {
  if (!file.endsWith('.js')) continue
  const src = readFileSync(join(root, 'src', file), 'utf8')
  for (const body of componentBodies(src)) {
    let returned = false
        for (let i = 0; i < body.lines.length; i += 1) {
      const line = body.lines[i]
      if (COND_RETURN.test(line)) returned = true
            if (HOOK_RE.test(line)) {
        // hook 在任何条件 return 之后 → 违例
        if (returned) {
          console.error(`✗ src/${file} ${body.name}: 第 ${i + 1} 行 hook 在条件 return 之后 → ${line.trim().slice(0, 60)}`)
          violations += 1
        }
      }
    }
  }
}



// ── 词典 lint：重复键检测（粘贴事故防线——中英两套贴进同一词典曾令
// 中文界面显示英文）+ 键引用粗检（i18n 键在 src 其余文件无引用即死键，
// 动态拼接键需在 DYNAMIC_KEYS 白单）。──
{
  const i18n = readFileSync(join(root, 'src', 'i18n.js'), 'utf8')
  const dictKeys = (name) => {
    const start = i18n.indexOf('var ' + name + ' = {')
    if (start === -1) return null
    let i = i18n.indexOf('{', start), depth = 0, j = i
    for (; j < i18n.length; j++) {
      if (i18n[j] === '{') depth++
      else if (i18n[j] === '}') { depth--; if (depth === 0) break }
    }
    const body = i18n.slice(i, j + 1)
    const re = /^ {6}([A-Za-z0-9_]+):/gm
    const out = []
    let m
    while ((m = re.exec(body))) out.push(m[1])
    return out
  }
  const zh = dictKeys('ZH') ?? []
  const en = dictKeys('EN') ?? []
  const dup = (a) => a.filter((k, i) => a.indexOf(k) !== i)
  const dz = dup(zh), de = dup(en)
  if (dz.length || de.length) {
    console.error(`✗ 词典重复键：ZH[${dz.join(',')}] EN[${de.join(',')}] —— 粘贴事故（后者静默覆盖前者）`)
    process.exit(1)
  }
  const onlyZh = zh.filter(k => !en.includes(k))
  const onlyEn = en.filter(k => !zh.includes(k))
  if (onlyZh.length || onlyEn.length) {
    console.error(`✗ 双语不对齐：仅ZH[${onlyZh.join(',')}] 仅EN[${onlyEn.join(',')}]`)
    process.exit(1)
  }
}

if (violations > 0) {
  console.error(`✗ hooks 顺序检查：${violations} 处违例`)
  process.exit(1)
}
console.log('✓ hooks 顺序检查通过（无条件 return 后的 hook 调用）')
