/**
 * dsh-base-plugin — prompt optimizer (the Tools dock's Prompt tab data plane).
 *
 * Calls the OFFICIAL `llm` service (the same LlmRuntime the agent loop runs
 * on) with the user's default model (agentDefaultModel.currentSelection —
 * what the Models page configured) to rewrite a rough prompt into a clear,
 * structured one. Pure one-shot: no session, no tools, no persistence.
 *
 * @module dsh-base-plugin/lib/prompt-optimizer
 */

/** Whether both required services exist. */
export function promptOptimizerAvailable(ctx) {
  const llm = ctx.get('llm')
  const selection = ctx.get('agentDefaultModel')
  return llm !== undefined && typeof llm.stream === 'function'
    && selection !== undefined && typeof selection.currentSelection === 'function'
}

/** The optimizer system prompt (Chinese-first: this plugin's audience). */
const OPTIMIZER_SYSTEM = [
  '你是一个提示词优化专家。用户会给你一段想对 AI 助手说的话（可能是粗糙、口语化、不完整的想法）。',
  '请把它重写为一条高质量的提示词，要求：',
  '1. 明确任务目标与期望产出；',
  '2. 补全必要上下文（技术栈、约束、格式），但不要编造用户没提供的事实；',
  '3. 结构清晰（可用简短分点），去除口语与冗余；',
  '4. 保持用户原意与语言（中文输入输出中文，英文输入输出英文）；',
  '5. 长度适中——只在有助于清晰时增加细节。',
  '输出格式：先给出优化后的提示词（放在 ```text 代码块中，方便复制），然后用一两句话说明主要改动。',
].join('\n')

/**
 * Optimize one rough prompt through the default model.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {string} rawInput - the user's rough prompt.
 * @returns the `{ optimized, provider, model }` payload.
 */
export async function optimizePrompt(ctx, rawInput) {
  const input = String(rawInput ?? '').trim()
  if (input === '') throw new Error('dsh-base-plugin: 请输入要优化的提示词')
  if (input.length > 32 * 1024) throw new Error('dsh-base-plugin: 输入过长（上限 32KB）')

  const selection = ctx.get('agentDefaultModel')
  const { provider, model } = selection.currentSelection()
  const llm = ctx.get('llm')

  // 120s 上限：模型/网络黑洞时 HTTP 请求不能无限悬挂；AbortSignal 让
  // adapter 侧也能中断上游请求。
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  let optimized = ''
  let failure = null
  try {
    const chunks = llm.stream({
      provider,
      model,
      system: OPTIMIZER_SYSTEM,
      signal: controller.signal,
      messages: [{
        id: 'prompt-optimize',
        role: 'user',
        content: [{ type: 'text', text: input }],
        source: { kind: 'user' },
      }],
    })
    for await (const chunk of chunks) {
      if (chunk.type === 'text-delta') {
        optimized += chunk.text
        // 输出上限：异常循环的模型曾可无限累积字符串。
        if (optimized.length > 256 * 1024) {
          controller.abort()
          break
        }
      } else if (chunk.type === 'finish' && chunk.reason.kind === 'error') {
        failure = chunk.reason.failure
      }
    }
  } finally {
    clearTimeout(timer)
  }
  if (failure !== null) {
    throw new Error(`dsh-base-plugin: 模型调用失败（${String(failure?.code ?? 'unknown')}）——检查模型配置后重试`)
  }
  if (optimized.trim() === '') throw new Error('dsh-base-plugin: 模型未返回内容')

  return { optimized: optimized.trim(), provider, model }
}
