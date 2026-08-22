// Import completeness audit: for every host file, collect import bindings,
// then flag any KNOWN cross-module export referenced as a free identifier
// but not imported. Also: exports never imported anywhere (dead exports).
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync("git ls-files 'index.js' 'lib/*.js' 'lib/routes/*.js' 'lib/mobile/*.js'", { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter(f => f.endsWith('.js'))

// Collect each module's exports
const exportsOf = new Map() // file -> Set(name)
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const names = new Set()
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim()
      if (seg === '') continue
      const as = seg.match(/^[\w$]+\s+as\s+([\w$]+)$/)
      names.add(as ? as[1] : seg.split(/\s+/)[0])
    }
  }
  exportsOf.set(f, names)
}
const allExportNames = new Map() // name -> [files]
for (const [f, names] of exportsOf) for (const n of names) {
  if (!allExportNames.has(n)) allExportNames.set(n, [])
  allExportNames.get(n).push(f)
}

// Node builtin module names (import source starts with node:)
const nodeBuiltins = new Set()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/import\s+(?:\{[^}]*\}|[\w$]+|(?:\{[^}]*\}\s*,\s*[\w$]+))\s+from\s+['"]([^'"]+)['"]/g)) {
    if (m[1].startsWith('node:')) nodeBuiltins.add(m[1])
  }
}
void nodeBuiltins

let problems = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // strip comments and string literals roughly for usage scan
  const lines = src.split('\n')
  const importLines = new Set()
  lines.forEach((l, i) => { if (/^\s*import\s/.test(l)) importLines.add(i) })
  const body = lines.filter((_, i) => !importLines.has(i)).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')

  // import bindings: default, namespace, named
  const imported = new Set()
  for (const m of src.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*,?\s*(?:\{([^}]*)\})?\s*from\s+['"][^'"]+['"]/g)) {
    if (m[1]) imported.add(m[1])
    if (m[2]) for (const p of m[2].split(',')) {
      const seg = p.trim(); if (seg === '') continue
      const as = seg.match(/^[\w$]+\s+as\s+([\w$]+)$/)
      imported.add(as ? as[1] : seg.split(/\s+/)[0])
    }
  }
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s+['"][^'"]+['"]/g)) {
    for (const p of m[1].split(',')) {
      const seg = p.trim(); if (seg === '') continue
      const as = seg.match(/^[\w$]+\s+as\s+([\w$]+)$/)
      imported.add(as ? as[1] : seg.split(/\s+/)[0])
    }
  }

  // 1) free identifier check against every known cross-module export name
  for (const [name, exporters] of allExportNames) {
    if (imported.has(name)) continue
    const re = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`)
    if (re.test(body)) {
      // defined in THIS file? then fine (own export used locally)
      if (exporters.includes(f)) continue
      // common globals / not-an-identifier contexts
      if (/^(name|description)$/.test(name)) continue
      console.log(`[MISSING-IMPORT] ${f}: uses '${name}' (exported by ${exporters.join(', ')}) but does not import it`)
      problems += 1
    }
  }
  // 2) unused import binding (imported but never referenced in body)
  for (const name of imported) {
    const re = new RegExp(`(?<![\\w$.'"])${name}(?![\\w$])`)
    if (!re.test(body)) {
      console.log(`[UNUSED-IMPORT] ${f}: imports '${name}' but never uses it`)
      problems += 1
    }
  }
}

// 3) dead exports: exported but never imported by any OTHER host file
const importedSomewhere = new Set()
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s+['"]\.[^'"]*['"]/g)) {
    for (const p of m[1].split(',')) {
      const seg = p.trim(); if (seg === '') continue
      importedSomewhere.add(seg.split(/\s+as\s+/)[0])
    }
  }
}
for (const [f, names] of exportsOf) {
  for (const n of names) {
    const usedLocally = new RegExp(`(?<![\\w$.])${n}(?![\\w$])`).test(
      readFileSync(f, 'utf8').replace(/^\s*import\s.*$/gm, ' ').replace(/^\s*export\s+((?:async\s+)?(?:function|class|const|let|var))\s+/gm, 'export-ref '))
    if (!importedSomewhere.has(n) && !usedLocally) {
      console.log(`[DEAD-EXPORT] ${f}: '${n}' exported, never imported anywhere, never used locally`)
    }
  }
}
console.log(problems === 0 ? 'NO MISSING/UNUSED IMPORT PROBLEMS' : `${problems} problems`)
