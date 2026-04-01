import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const registerSchema = z.object({
  uid: z.string().min(4).max(20),
  owner_name: z.string().max(100),
  owner_email: z.string().email()
})

const topupSchema = z.object({
  amount: z.number().positive()
})

const calorieLimitSchema = z.object({
  calorie_limit: z.number().int().positive()
})

// POST /api/cards/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const { uid, owner_name, owner_email } = req.body

  const { data: existing } = await supabase
    .from('cards')
    .select('uid')
    .eq('uid', uid)
    .single()

  if (existing) {
    res.status(409).json({ success: false, error: 'CARD_ALREADY_REGISTERED', message: 'This card UID is already registered.' })
    return
  }

  const { data, error } = await supabase
    .from('cards')
    .insert({ uid, owner_name, owner_email, role: 'CONSUMER' })
    .select()
    .single()

  if (error) throw error

  res.status(201).json({ success: true, data })
})

// GET /api/cards/:uid
router.get('/:uid', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params

  const { data: card, error } = await supabase
    .from('cards')
    .select('*')
    .eq('uid', uid)
    .single()

  if (error || !card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // Calories today
  const { data: taps } = await supabase
    .from('tap_events')
    .select('metadata')
    .eq('card_uid', uid)
    .eq('event_type', 'TAP_PURCHASE')
    .gte('server_timestamp', `${today}T00:00:00+08:00`)
    .lte('server_timestamp', `${today}T23:59:59+08:00`)

  const calories_today = (taps ?? []).reduce((sum, t) => sum + (t.metadata?.calories ?? 0), 0)

  // Checkpoints today (distinct vendors tapped)
  const { data: checkpoints } = await supabase
    .from('tap_events')
    .select('vendor_id')
    .eq('card_uid', uid)
    .gte('server_timestamp', `${today}T00:00:00+08:00`)
    .lte('server_timestamp', `${today}T23:59:59+08:00`)

  const checkpoints_today = [...new Set((checkpoints ?? []).map(c => c.vendor_id))]

  // Active vouchers
  const { data: active_vouchers } = await supabase
    .from('vouchers')
    .select('voucher_id, discount_value, applicable_vendor_ids, expires_at')
    .eq('card_uid', uid)
    .eq('status', 'ACTIVE')

  res.json({
    success: true,
    data: {
      uid: card.uid,
      owner_name: card.owner_name,
      owner_email: card.owner_email,
      points_balance: card.points_balance,
      calorie_limit: card.calorie_limit,
      is_active: card.is_active,
      calories_today,
      checkpoints_today,
      active_vouchers: active_vouchers ?? []
    }
  })
})

// GET /api/cards/:uid/history
router.get('/:uid/history', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  const { data: card } = await supabase.from('cards').select('uid').eq('uid', uid).single()
  if (!card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  const { data, count, error } = await supabase
    .from('tap_events')
    .select('event_id, vendor_id, event_type, metadata, server_timestamp, vendors(business_name)', { count: 'exact' })
    .eq('card_uid', uid)
    .order('server_timestamp', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  const history = (data ?? []).map((e: any) => ({
    event_id: e.event_id,
    vendor_name: e.vendors?.business_name ?? null,
    event_type: e.event_type,
    food_name: e.metadata?.food_name ?? null,
    calories: e.metadata?.calories ?? null,
    final_cost: e.metadata?.final_cost ?? null,
    server_timestamp: e.server_timestamp
  }))

  res.json({ success: true, data: { uid, total: count ?? 0, limit, offset, history } })
})

// GET /api/cards/:uid/vouchers
router.get('/:uid/vouchers', async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params
  const { status } = req.query

  let query = supabase
    .from('vouchers')
    .select('*, campaigns(name)')
    .eq('card_uid', uid)
    .order('issued_at', { ascending: false })

  if (status) query = query.eq('status', status as string)

  const { data, error } = await query
  if (error) throw error

  res.json({ success: true, data: data ?? [] })
})

// PATCH /api/cards/:uid/calorie-limit
router.patch('/:uid/calorie-limit', validate(calorieLimitSchema), async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params
  const { calorie_limit } = req.body

  const { data, error } = await supabase
    .from('cards')
    .update({ calorie_limit })
    .eq('uid', uid)
    .select()
    .single()

  if (error || !data) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  res.json({ success: true, data })
})

// POST /api/cards/:uid/topup
router.post('/:uid/topup', validate(topupSchema), async (req: Request, res: Response): Promise<void> => {
  const { uid } = req.params
  const { amount } = req.body

  const { data: card, error: fetchError } = await supabase
    .from('cards')
    .select('uid, points_balance')
    .eq('uid', uid)
    .single()

  if (fetchError || !card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  const new_balance = Number(card.points_balance) + amount

  const { error: updateError } = await supabase
    .from('cards')
    .update({ points_balance: new_balance })
    .eq('uid', uid)

  if (updateError) throw updateError

  await supabase.from('points_log').insert({
    card_uid: uid,
    delta: amount,
    reason: 'TOPUP'
  })

  res.json({ success: true, data: { uid, points_balance: new_balance } })
})

export default router
