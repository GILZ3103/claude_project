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
  prompt: z.string().min(1).max(300),
  calorie_budget: z.number().positive()
})

function getAi(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')
  return new GoogleGenerativeAI(key)
}

const SYSTEM_CHAT = `You are a helpful assistant for NightMarket, a Malaysian night market platform.
Consumers can: top up points, tap NFC cards at vendor stalls to buy food, track daily calories, join campaigns to earn vouchers, browse vendors and their menus, view a grid map of the market.
Vendors can: manage their food menu (fixed price or weight-based via load cell), track compliance submissions (income tax, electric bills, business tax), view government portal links, submit subsidy claims.
Reply in 2-3 sentences maximum. Be direct and friendly. If you don't know, say so honestly.`

// POST /api/ai/chat
router.post('/chat', validate(chatSchema), async (req: Request, res: Response): Promise<void> => {
  const { message, role } = req.body
  const context = role === 'VENDOR' ? 'The user is a vendor.' : 'The user is a consumer.'

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

  // Fetch all food items with vendor names
  const { data: items } = await supabase
    .from('food_items')
    .select('name, calories, price_in_points, calories_per_100g, price_per_100g, vendors(business_name)')
    .eq('vendors.is_active', true)

  if (!items || items.length === 0) {
    res.json({ success: true, data: { suggestions: [] } })
    return
  }

  const foodList = items.map((i: any) => ({
    vendor: i.vendors?.business_name ?? 'Unknown',
    food: i.name,
    calories: i.calories ?? (i.calories_per_100g ? `${i.calories_per_100g}/100g` : null),
    price: i.price_in_points ?? (i.price_per_100g ? `${i.price_per_100g}/100g` : null)
  }))

  const ai = getAi()
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const systemPrompt = `You are a meal advisor for a Malaysian night market. Given a list of available food items, suggest exactly 3 items that best match the user's preference and calorie budget.
Respond ONLY with a JSON array (no markdown, no explanation) in this exact format:
[{"vendor_name":"...","food_name":"...","calories":123,"price_in_points":5.00,"reason":"..."}]
Keep each reason under 10 words.`

  const result = await model.generateContent(
    `${systemPrompt}\n\nAvailable food: ${JSON.stringify(foodList)}\n\nUser preference: ${prompt}\nCalorie budget: ${calorie_budget} kcal`
  )

  let suggestions: any[] = []
  try {
    const text = result.response.text().replace(/```json|```/g, '').trim()
    suggestions = JSON.parse(text)
  } catch {
    suggestions = []
  }

  res.json({ success: true, data: { suggestions } })
})

export default router
