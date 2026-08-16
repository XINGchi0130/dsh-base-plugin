/**
 * dsh-base-plugin — user skill file I/O (`~/.dsh/skills/<name>/SKILL.md`).
 *
 * The user skill root is one of dsh's watched skill directories, so a write
 * or delete here hot-registers/unregisters the skill immediately. Names are
 * validated against dsh-skill's own kebab-case contract, which also confines
 * every path this module touches under the user skill root.
 * @module dsh-base-plugin/lib/skills-io
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { atomicWrite, userSkillsDir } from './env.js'

/** Skill name contract, mirroring dsh-skill's SKILL_NAME (kebab-case). */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Create or overwrite one user skill at `~/.dsh/skills/<name>/SKILL.md`.
 * The watched directory hot-registers the skill; no restart involved.
 */
export function saveUserSkill(input) {
  if (input === null || typeof input !== 'object') throw new Error('dsh-base-plugin: body must be an object')
  const name = String(input.name ?? '').trim()
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error('dsh-base-plugin: skill name must be kebab-case (lowercase letters, digits, single hyphens)')
  }
  const description = String(input.description ?? '').trim()
  if (description === '') throw new Error('dsh-base-plugin: description is required')
  const content = String(input.content ?? '')
  const dir = join(userSkillsDir(), name)
  const file = join(dir, 'SKILL.md')
  const exists = existsSync(file)
  if (input.existing !== true && exists) {
    throw new Error(`dsh-base-plugin: skill "${name}" already exists`)
  }
  if (input.existing === true && !exists) {
    throw new Error(`dsh-base-plugin: skill "${name}" is not a user skill under ~/.dsh/skills`)
  }
  // JSON double-quoted strings are valid YAML scalars — safe frontmatter embed.
  const doc = `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n${content.trim()}\n`
  mkdirSync(dir, { recursive: true })
  atomicWrite(file, doc)
  return { name, created: !exists }
}

/** Delete one user skill directory (`~/.dsh/skills/<name>/`), nothing else. */
export function deleteUserSkill(name) {
  const trimmed = String(name ?? '').trim()
  if (!SKILL_NAME_PATTERN.test(trimmed)) throw new Error('dsh-base-plugin: invalid skill name')
  const dir = join(userSkillsDir(), trimmed)
  if (!existsSync(join(dir, 'SKILL.md'))) {
    throw new Error(`dsh-base-plugin: skill "${trimmed}" is not a user skill under ~/.dsh/skills`)
  }
  rmSync(dir, { recursive: true, force: true })
  return { name: trimmed }
}
