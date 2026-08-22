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

if (violations > 0) {
  console.error(`✗ hooks 顺序检查：${violations} 处违例`)
  process.exit(1)
}
console.log('✓ hooks 顺序检查通过（无条件 return 后的 hook 调用）')
