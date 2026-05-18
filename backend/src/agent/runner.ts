import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { ALL_TOOL_SCHEMAS, executeTool } from './tools'

const MAX_ITERATIONS = 5
const AGENT_MD_PATH = path.resolve(process.cwd(), 'agent', 'warungtek-agent.md')

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

function getAi(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return new GoogleGenerativeAI(key)
}

export async function runAgent(card_uid: string, userMessage: string): Promise<string> {
  const t0 = Date.now()
  const ai = getAi()
  const systemPrompt = readAgentMd()

  const model = ai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: ALL_TOOL_SCHEMAS }],
  })

  const chat = model.startChat()
  console.log(`[AI] User ${card_uid.slice(-6)}: "${userMessage}"`)

  let result = await chat.sendMessage(userMessage)
  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    const calls = result.response.functionCalls()
    if (!calls || calls.length === 0) {
      const text = result.response.text()
      console.log(`[AI] Reply (${Date.now() - t0}ms): "${text}"`)
      return text
    }

    console.log(`[AI] Tools (iter ${iterations + 1}):`, calls.map(c => `${c.name}(${JSON.stringify(c.args)})`).join(', '))

    const fnResponses = await Promise.all(
      calls.map(async (call: any) => {
        const output = await executeTool(call.name, call.args, { card_uid })
        console.log(`[AI] ↳ ${call.name}:`, JSON.stringify(output).slice(0, 200))
        return { functionResponse: { name: call.name, response: output } }
      })
    )

    result = await chat.sendMessage(fnResponses)
    iterations++
  }

  console.log(`[AI] Max iterations reached for ${card_uid.slice(-6)}`)
  return 'Sorry, I could not complete that request. Try rephrasing.'
}
