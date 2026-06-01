import OpenAI from 'openai'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'
import fs from 'fs'
import path from 'path'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools'

const MAX_ITERATIONS = 5
const AGENT_MD_PATH = path.resolve(process.cwd(), 'agent', 'warungtek-agent.md')

// DeepSeek is OpenAI-compatible: same SDK, different baseURL + model.
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-chat'

let cachedSystemPrompt: string | null = null

function readAgentMd(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt
  try {
    cachedSystemPrompt = fs.readFileSync(AGENT_MD_PATH, 'utf8')
  } catch {
    cachedSystemPrompt = 'You are a helpful assistant for WarungTek, a Malaysian night market platform. Reply in 2-3 sentences.'
  }
  return cachedSystemPrompt
}

function getAi(): OpenAI {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error('DEEPSEEK_API_KEY not configured')
  return new OpenAI({ apiKey: key, baseURL: DEEPSEEK_BASE_URL })
}

// Wrap our plain function declarations in OpenAI's tool envelope.
const TOOLS: ChatCompletionTool[] = ALL_TOOL_SCHEMAS.map(fn => ({
  type: 'function',
  function: fn,
}))

export async function runAgent(card_uid: string, userMessage: string): Promise<string> {
  const t0 = Date.now()
  const ai = getAi()
  const systemPrompt = readAgentMd()

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  console.log(`[AI] User ${card_uid.slice(-6)}: "${userMessage}"`)

  let iterations = 0
  while (iterations < MAX_ITERATIONS) {
    const completion = await ai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    })

    const msg = completion.choices[0]?.message
    const calls = msg?.tool_calls ?? []

    if (calls.length === 0) {
      const text = msg?.content ?? ''
      console.log(`[AI] Reply (${Date.now() - t0}ms): "${text}"`)
      return text
    }

    console.log(
      `[AI] Tools (iter ${iterations + 1}):`,
      calls.map(c => (c.type === 'function' ? `${c.function.name}(${c.function.arguments})` : c.type)).join(', ')
    )

    // Record the assistant turn (with its tool_calls) before answering them.
    messages.push(msg)

    for (const call of calls) {
      if (call.type !== 'function') continue
      let args: any = {}
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {}
      } catch {
        args = {}
      }
      const output = await executeTool(call.function.name, args, { card_uid })
      console.log(`[AI] ↳ ${call.function.name}:`, JSON.stringify(output).slice(0, 200))
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      })
    }

    iterations++
  }

  console.log(`[AI] Max iterations reached for ${card_uid.slice(-6)}`)
  return 'Sorry, I could not complete that request. Try rephrasing.'
}
