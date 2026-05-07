import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

function requireTerminalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const expected = process.env.TERMINAL_AUTH_TOKEN
  if (!expected || !token || token !== expected) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing terminal token'
    })
    return
  }
  next()
}

const tapSchema = z.object({
  card_uid: z.string().min(4).max(20),
  vendor_id: z.string().uuid(),
  food_id: z.string().uuid(),
  device_timestamp: z.string(),
  synced_from_queue: z.boolean().default(false),
  weight_g: z.number().positive().optional()
})

const syncSchema = z.object({
  terminal_mac: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/),
  events: z.array(z.object({
    card_uid: z.string().min(4).max(20),
    food_id: z.string().uuid(),
    device_timestamp: z.string(),
    weight_g: z.number().positive().optional()
  }))
})

async function processTap(
  card_uid: string,
  vendor_id: string,
  food_id: string,
  device_timestamp: string,
  synced_from_queue: boolean,
  weight_g?: number
): Promise<{ status: number; body: object }> {
  // 1. Fetch card
  const { data: card } = await supabase.from('cards').select('*').eq('uid', card_uid).single()
  if (!card) return { status: 404, body: { success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' } }
  if (!card.is_active) return { status: 403, body: { success: false, error: 'CARD_INACTIVE', message: 'Card is inactive.' } }

  // 2. Fetch vendor
  const { data: vendor } = await supabase.from('vendors').select('*').eq('vendor_id', vendor_id).single()
  if (!vendor) return { status: 404, body: { success: false, error: 'VENDOR_NOT_FOUND', message: 'Vendor not found.' } }

  // 3. Fetch food item
  const { data: food } = await supabase.from('food_items').select('*').eq('food_id', food_id).single()
  if (!food) return { status: 404, body: { success: false, error: 'FOOD_NOT_FOUND', message: 'Food item not found.' } }
  if (food.vendor_id !== vendor_id) return { status: 400, body: { success: false, error: 'FOOD_NOT_FOUND', message: 'Food item does not belong to this vendor.' } }

  // 4. Duplicate tap check
  const today = new Date().toISOString().split('T')[0]
  const checkDate = synced_from_queue ? device_timestamp.split('T')[0] : today

  const { data: existingTap } = await supabase
    .from('tap_events')
    .select('event_id')
    .eq('card_uid', card_uid)
    .eq('vendor_id', vendor_id)
    .eq('event_type', 'TAP_PURCHASE')
    .gte(synced_from_queue ? 'device_timestamp' : 'server_timestamp', `${checkDate}T00:00:00+08:00`)
    .lte(synced_from_queue ? 'device_timestamp' : 'server_timestamp', `${checkDate}T23:59:59+08:00`)
    .limit(1)
    .single()

  if (existingTap) return { status: 409, body: { success: false, error: 'DUPLICATE_TAP', message: 'Card already tapped at this vendor today.' } }

  // 5. Voucher lookup
  let voucher: any = null
  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('*')
    .eq('card_uid', card_uid)
    .eq('status', 'ACTIVE')
    .or(`applicable_vendor_ids.is.null,applicable_vendor_ids.cs.["${vendor_id}"]`)
    .limit(1)

  if (vouchers && vouchers.length > 0) {
    const v = vouchers[0]
    if (!v.expires_at || new Date(v.expires_at) > new Date()) {
      voucher = v
    }
  }

  // 6. Calculate calories — weight-based if load cell data present, else fixed
  const calories: number = (weight_g && food.calories_per_100g)
    ? Math.round((weight_g / 100) * Number(food.calories_per_100g))
    : (food.calories ?? 0)

  // 7. Calculate cost — weight-based if load cell data present, else flat price
  const base_cost = (weight_g && food.price_per_100g)
    ? Math.round((weight_g / 100) * Number(food.price_per_100g) * 100) / 100
    : Number(food.price_in_points)
  const discount_applied = voucher ? Number(voucher.discount_value) : 0
  const final_cost = Math.max(0, base_cost - discount_applied)

  // 8. Check balance
  if (Number(card.points_balance) < final_cost) {
    return { status: 402, body: { success: false, error: 'INSUFFICIENT_POINTS', message: 'Insufficient points balance.' } }
  }

  const server_timestamp = new Date().toISOString()

  // 9. Build metadata
  const metadata: Record<string, any> = {
    food_id,
    food_name: food.name,
    calories,
    weight_g: weight_g ?? null,
    base_cost,
    voucher_applied: voucher?.voucher_id ?? null,
    discount_applied,
    final_cost
  }

  // 9. DB transaction
  const new_balance = Number(card.points_balance) - final_cost

  // a. Deduct points
  const { error: balanceErr } = await supabase
    .from('cards')
    .update({ points_balance: new_balance })
    .eq('uid', card_uid)
  if (balanceErr) throw balanceErr

  // b. Mark voucher used
  if (voucher) {
    await supabase.from('vouchers').update({
      status: 'USED',
      used_at: server_timestamp,
      used_at_vendor_id: vendor_id
    }).eq('voucher_id', voucher.voucher_id)
  }

  // c. Insert tap event
  const { data: tapEvent, error: tapErr } = await supabase
    .from('tap_events')
    .insert({
      card_uid,
      vendor_id,
      event_type: 'TAP_PURCHASE',
      device_timestamp,
      server_timestamp,
      synced_from_queue,
      weight_g: weight_g ?? null,
      metadata
    })
    .select()
    .single()
  if (tapErr) throw tapErr

  // d. Points log — purchase
  await supabase.from('points_log').insert({
    card_uid,
    delta: -final_cost,
    reason: 'TAP_PURCHASE',
    reference_id: tapEvent.event_id
  })

  // e. Points log — voucher discount
  if (voucher && discount_applied > 0) {
    await supabase.from('points_log').insert({
      card_uid,
      delta: discount_applied,
      reason: 'VOUCHER_DISCOUNT',
      reference_id: voucher.voucher_id
    })
  }

  // 10. Campaign progress update (non-blocking — does not roll back tap on failure)
  let campaign_completed: string | null = null
  let voucher_issued: string | null = null

  try {
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .in('condition_type', ['VISIT_STALLS', 'SPEND_POINTS'])

    for (const campaign of activeCampaigns ?? []) {
      const { data: progress } = await supabase
        .from('campaign_progress')
        .select('*')
        .eq('card_uid', card_uid)
        .eq('campaign_id', campaign.campaign_id)
        .single()

      if (!progress || progress.completed) continue

      let increment = 0
      if (campaign.condition_type === 'SPEND_POINTS') {
        increment = final_cost
      } else if (campaign.condition_type === 'VISIT_STALLS') {
        // Only count if this vendor hasn't been visited today
        const { data: alreadyVisited } = await supabase
          .from('tap_events')
          .select('event_id')
          .eq('card_uid', card_uid)
          .eq('vendor_id', vendor_id)
          .eq('event_type', 'TAP_PURCHASE')
          .neq('event_id', tapEvent.event_id)
          .gte('server_timestamp', `${today}T00:00:00+08:00`)
          .limit(1)
          .single()

        if (!alreadyVisited) increment = 1
      }

      if (increment === 0) continue

      const new_value = Number(progress.current_value) + increment
      const completed = new_value >= Number(campaign.condition_threshold)

      await supabase.from('campaign_progress').update({
        current_value: new_value,
        completed,
        completed_at: completed ? server_timestamp : null
      }).eq('progress_id', progress.progress_id)

      if (completed) {
        const { data: newVoucher } = await supabase
          .from('vouchers')
          .insert({
            card_uid,
            campaign_id: campaign.campaign_id,
            discount_value: campaign.reward_value,
            applicable_vendor_ids: campaign.applicable_vendor_ids,
            status: 'ACTIVE'
          })
          .select()
          .single()

        campaign_completed = campaign.name
        voucher_issued = newVoucher?.voucher_id ?? null
      }
    }
  } catch (err) {
    console.error('Campaign progress update failed (non-fatal):', err)
  }

  // 11. Calorie warning
  const { data: todayTaps } = await supabase
    .from('tap_events')
    .select('metadata')
    .eq('card_uid', card_uid)
    .eq('event_type', 'TAP_PURCHASE')
    .gte('server_timestamp', `${today}T00:00:00+08:00`)

  const calories_today = (todayTaps ?? []).reduce((sum, t) => sum + (t.metadata?.calories ?? 0), 0)
  const calorie_warning = calories_today >= card.calorie_limit

  return {
    status: 200,
    body: {
      success: true,
      data: {
        event_id: tapEvent.event_id,
        food_name: food.name,
        base_cost,
        discount_applied,
        final_cost,
        points_balance_remaining: new_balance,
        calories_added: calories,
        calories_today,
        calorie_limit: card.calorie_limit,
        calorie_warning,
        voucher_applied: voucher?.voucher_id ?? null,
        campaign_completed,
        voucher_issued,
        server_timestamp
      }
    }
  }
}

// POST /api/tap
router.post('/', requireTerminalAuth, validate(tapSchema), async (req: Request, res: Response): Promise<void> => {
  const { card_uid, vendor_id, food_id, device_timestamp, synced_from_queue, weight_g } = req.body
  const result = await processTap(card_uid, vendor_id, food_id, device_timestamp, synced_from_queue, weight_g)
  res.status(result.status).json(result.body)
})

// POST /api/tap/sync
router.post('/sync', requireTerminalAuth, validate(syncSchema), async (req: Request, res: Response): Promise<void> => {
  const { terminal_mac, events } = req.body

  const { data: vendor } = await supabase
    .from('vendors')
    .select('vendor_id')
    .eq('terminal_mac_address', terminal_mac)
    .single()

  if (!vendor) {
    res.status(404).json({ success: false, error: 'VENDOR_NOT_FOUND', message: 'No vendor found for this MAC address.' })
    return
  }

  const sorted = [...events].sort((a, b) =>
    new Date(a.device_timestamp).getTime() - new Date(b.device_timestamp).getTime()
  )

  let processed = 0
  let skipped = 0

  for (const event of sorted) {
    const result = await processTap(
      event.card_uid,
      vendor.vendor_id,
      event.food_id,
      event.device_timestamp,
      true,
      event.weight_g
    )
    if (result.status === 200) {
      processed++
    } else if (result.status === 409) {
      skipped++ // duplicate — skip silently
    }
    // Other errors are counted as skipped for batch resilience
    else {
      skipped++
    }
  }

  res.json({ success: true, data: { processed, skipped } })
})

export default router
