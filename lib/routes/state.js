/**
 * state / market / skills / persona 路由（设置页对插件自身状态文件的
 * 读写面）。
 *
 * 每个导出返回路由行，由 lib/routes.js 的表驱动分发器消费；handler
 * 收到 (req, res, url)，抛出的普通 Error 会被分发器统一框成 400 JSON。
 * @module dsh-base-plugin/lib/routes/state
 */
import { homePatchPath, resolveProfileDir } from '../env.js'
import { marketSearch } from '../market.js'
import { commit, serversYaml } from '../patch.js'
import { deleteUserSkill, saveUserSkill } from '../skills-io.js'
import { defaultSkillScope, effectivePersona, isShippedPresetSkill, isUserSkill, loaderRows, mcpStatus } from '../status.js'
import { loadState } from '../state.js'
import { readJsonBody, sendJson } from './http.js'

export function stateRoutes(ctx, deps) {
  return [
    // GET /dsh-base-plugin/api/state — everything the pages need at mount.
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/state',
      handler: async (_req, res) => {
        const state = loadState()
        sendJson(res, 200, {
          ok: true,
          value: {
            profileDir: resolveProfileDir(ctx),
            homePatch: homePatchPath(),
            // 投影为 {name, spec}：完整行属于受管块，前端重装时不需要。
            plugins: state.plugins.map(p => ({ name: p.name, spec: p.spec })),
            mcpServers: mcpStatus(ctx, state),
            mcpYaml: serversYaml(state.mcpServers),
            persona: state.persona,
            effectivePersona: effectivePersona(ctx),
            busy: deps.busyOp(),
            hasToken: process.env.GITHUB_TOKEN !== undefined && process.env.GITHUB_TOKEN !== '',
          },
        })
      },
    },
  ]
}

export function marketRoutes(ctx, _deps) {
  return [
    // GET /dsh-base-plugin/api/market?q=...&sort=default|stars|updated|name
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/market',
      handler: async (_req, res, url) => {
        const q = url.searchParams.get('q') ?? ''
        const result = await marketSearch(q, url.searchParams.get('sort') ?? 'default')
        // 「已安装」徽标取两个来源的并集：本插件记录的市场安装
        // （state.plugins）+ 实际挂载的 loader 行（loaderRows——覆盖手装
        // 或宿主自带的同名包，否则会显示可安装但其实已存在）。
        const state = loadState()
        const installed = new Set([
          ...state.plugins.map(p => p.name),
          ...loaderRows(ctx).map(r => r.moduleName),
        ])
        sendJson(res, 200, {
          ok: true,
          value: {
            ...result,
            items: result.items.map(item => ({ ...item, installed: installed.has(item.name) })),
          },
        })
      },
    },
  ]
}

export function skillsRoutes(ctx, _deps) {
  return [
    // GET /dsh-base-plugin/api/skills — list (deployment-shipped preset skills hidden)
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/skills',
      handler: async (_req, res) => {
        const skills = ctx.get('skills')
        if (skills === undefined) {
          // 服务缺席时返回 available:false 而非报错：设置页据此显示
          // 引导文案，而不是把整个页打成错误横幅。
          sendJson(res, 200, { ok: true, value: { available: false, skills: [], hiddenCount: 0 } })
          return
        }
        // 默认预设的 standing scope：技能目录按 scope 分层，仅全局层
        // 通常是空的——不带 scope 查询会漏掉预设贡献的全部技能。
        const scope = await defaultSkillScope(ctx)
        const list = await skills.list(scope === undefined ? {} : { scope })
        const visible = []
        let hiddenCount = 0
        for (const skill of list) {
          // 部署自带的预设技能（升级会被覆盖、用户不可编辑）从列表
          // 隐藏，只计数——设置页显示「已隐藏 N 个部署技能」。
          if (isShippedPresetSkill(skill)) {
            hiddenCount += 1
            continue
          }
          visible.push({
            name: skill.name,
            description: skill.description ?? '',
            whenToUse: typeof skill.whenToUse === 'string' ? skill.whenToUse : '',
            provider: skill.provider ?? '',
            writable: isUserSkill(skill),
          })
        }
        sendJson(res, 200, {
          ok: true,
          value: { available: true, skills: visible, hiddenCount, canCreate: true },
        })
      },
    },
    // GET /dsh-base-plugin/api/skills/detail?name=...
    {
      method: 'GET',
      path: '/dsh-base-plugin/api/skills/detail',
      handler: async (_req, res, url) => {
        const skills = ctx.get('skills')
        const skillName = url.searchParams.get('name') ?? ''
        if (skills === undefined) {
          sendJson(res, 200, { ok: true, value: null })
          return
        }
        const scope = await defaultSkillScope(ctx)
        const definition = await skills.get(skillName, scope === undefined ? {} : { scope })
        // 查无此技能返回 null（200）而非 404：详情是打开技能行的
        // 伴随查询，null 让前端安静地回落到「不可读」态。
        if (definition === undefined) {
          sendJson(res, 200, { ok: true, value: null })
          return
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            name: definition.name,
            description: definition.description ?? '',
            content: definition.content ?? '',
            path: typeof definition.path === 'string' ? definition.path : '',
            provider: definition.provider ?? '',
          },
        })
      },
    },
    // POST /dsh-base-plugin/api/skills/save { name, description, content, existing? }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/skills/save',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        // 写入 ~/.dsh/skills/<name>/SKILL.md（kebab-case 名即路径围栏，
        // 见 skills-io.js）；目录被 dsh 监听，保存即热注册。
        const result = saveUserSkill(body)
        sendJson(res, 200, { ok: true, value: result })
      },
    },
    // POST /dsh-base-plugin/api/skills/delete { name }
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/skills/delete',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const result = deleteUserSkill(body?.name)
        sendJson(res, 200, { ok: true, value: result })
      },
    },
  ]
}

export function promptRoutes() {
  return [
    // POST /dsh-base-plugin/api/prompt { persona } — set/clear the global persona
    // override. Empty/whitespace text clears the override (deployment
    // default persona back in effect). Hot-loads via the managed block.
    {
      method: 'POST',
      path: '/dsh-base-plugin/api/prompt',
      handler: async (req, res) => {
        const body = await readJsonBody(req)
        const raw = typeof body.persona === 'string' ? body.persona : ''
        // 64 KiB 上限与 agent-instructions 同级：persona 会整体注入每个
        // 会话的系统提示词，无上限会直接吃掉上下文预算。
        if (raw.length > 64 * 1024) throw new Error('dsh-base-plugin: persona text exceeds 64 KiB')
        // 仅去尾随空白：内部换行/缩进是用户排版的一部分，不动。
        const persona = raw.replace(/\s+$/, '')
        const state = loadState()
        state.persona = persona
        // commit = saveState + 重写受管块；受管块被 dsh 热监听，无需重启。
        await commit(state)
        sendJson(res, 200, { ok: true, value: { persona, active: persona.trim() !== '' } })
      },
    },
  ]
}
