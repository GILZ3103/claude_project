import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const chatSchema = z.object({
  message: z.string().min(1).max(500),
  role: z.enum(['CONSUMER', 'VENDOR']).optional()
})

const mealSchema = z.object({
  prompt: z.string().min(1).max(500),
  calorie_budget: z.number().positive()
})

function getAi(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return new GoogleGenerativeAI(key)
}

function extractJson(text: string): any[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  return JSON.parse(text.slice(start, end + 1))
}

const SYSTEM_CHAT = `You are an assistant for NightMarket, a Malaysian night market platform.
Key facts:
- Consumers use physical NFC cards to tap at vendor stalls and pay in points (1 pt = RM 1)
- Dashboard: check points balance, top up, view daily calorie intake, see tap history
- Calories page: daily intake vs limit, macros breakdown (protein/carbs/fat), BMR calculator
- Campaigns page: join campaigns to earn vouchers (e.g. visit 3 stalls, spend 20 pts)
- Vendors page: browse stalls and food menus with calorie and macro info
- Map page: grid map showing vendor stall and kiosk locations
- NFC page: card status, points balance, active promotions, tap history
- Vendors manage food items (fixed price or per-gram pricing with load cell scale)
- Vendors track compliance documents (income tax/LHDN, electric bills/TNB, business tax/SST)
- Vendors submit subsidy claims based on campaign voucher redemptions
Reply in 2-3 short sentences. Be direct and specific. If unsure, say so.`

// POST /api/ai/chat
router.post('/chat', validate(chatSchema), async (req: Request, res: Response): Promise<void> => {
  const { message, role } = req.body
  const context = role === 'VENDOR'
    ? 'The user is a vendor managing their stall.'
    : 'The user is a consumer visiting the night market.'

  const ai = getAi()
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const result = await model.generateContent(
    `${SYSTEM_CHAT}\n\n${context}\n\nUser: ${message}`
  )
  const reply = result.response.text()
  res.json({ success: true, data: { reply } })
})

// POST /api/ai/meal-advisor
router.post('/meal-advisor', validate(mealSchema), async (req: Request, res: Response): Promise<void> => {
  const { prompt, calorie_budget } = req.body

  const { data: items } = await supabase
    .from('food_items')
    .select('name, calories, price_in_points, calories_per_100g, price_per_100g, is_available, vendors(business_name, is_active)')
    .eq('is_available', true)
    .limit(80)

  if (!items || items.length === 0) {
    res.json({ success: true, data: { suggestions: [] } })
    return
  }

  const foodList = items
    .filter((i: any) => i.vendors?.is_active)
    .map((i: any) => ({
      vendor: i.vendors?.business_name ?? 'Unknown',
      food: i.name,
      kcal: i.calories ?? (i.calories_per_100g ? `${i.calories_per_100g}/100g` : 'unknown'),
      price_rm: i.price_in_points ?? (i.price_per_100g ? `${i.price_per_100g}/100g` : 'unknown')
    }))

  const ai = getAi()
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const systemPrompt = `You are a meal advisor for a Malaysian night market.
Given available food items, suggest exactly 3 items that best match the user's preference and calorie budget.
Return ONLY a raw JSON array — no markdown fences, no explanation, no text before or after.
Use this exact format:
[{"vendor_name":"...","food_name":"...","calories":123,"price_in_points":5.00,"reason":"..."}]
Keep each reason under 12 words. Use the vendor and food names exactly as given in the list.`

  const result = await model.generateContent(
    `${systemPrompt}\n\nAvailable food:\n${JSON.stringify(foodList)}\n\nUser preference: ${prompt}\nCalorie budget: ${calorie_budget} kcal`
  )

  let suggestions: any[] = []
  try {
    const raw = extractJson(result.response.text())
    suggestions = raw.filter((s: any) => s.vendor_name && s.food_name)
  } catch {
    suggestions = []
  }

  res.json({ success: true, data: { suggestions } })
})

export default router
