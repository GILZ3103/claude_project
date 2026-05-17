import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const enrolSchema = z.object({
  card_uid: z.string().min(4).max(20)
})

const campaignApplicationSchema = z.object({
  vendor_id: z.string().uuid(),
  card_uid: z.string().min(4).max(20),
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  condition_type: z.enum(['VISIT_STALLS', 'SPEND_POINTS', 'DIRECTORY_REBATE']).default('SPEND_POINTS'),
  condition_threshold: z.number().positive(),
  point_deduction: z.number().min(0).optional(),
  reward_value: z.number().positive(),
})

const kioskTapSchema = z.object({
  card_uid: z.string().min(4).max(20),
  kiosk_id: z.string().uuid(),
  device_timestamp: z.string()
})

// GET /api/campaigns
// If ?card_uid= provided, include progress for that card
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { card_uid } = req.query

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .order('created_at')

  if (error) throw error

  if (!card_uid) {
    res.json({ success: true, data: campaigns ?? [] })
    return
  }

  // Attach progress for this card
  const { data: progressRows } = await supabase
    .from('campaign_progress')
    .select('*')
    .eq('card_uid', card_uid as string)

  const progressMap = new Map((progressRows ?? []).map(p => [p.campaign_id, p]))

  const result = (campaigns ?? []).map(c => ({
    ...c,
    progress: progressMap.get(c.campaign_id) ?? null
  }))

  res.json({ success: true, data: result })
})

// POST /api/campaigns/:id/enrol
router.post('/:id/enrol', validate(enrolSchema), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { card_uid } = req.body

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('campaign_id')
    .eq('campaign_id', id)
    .eq('is_active', true)
    .single()

  if (!campaign) {
    res.status(404).json({ success: false, error: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found or inactive.' })
    return
  }

  const { data: card } = await supabase.from('cards').select('uid').eq('uid', card_uid).single()
  if (!card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  const { data: existing } = await supabase
    .from('campaign_progress')
    .select('progress_id')
    .eq('card_uid', card_uid)
    .eq('campaign_id', id)
    .single()

  if (existing) {
    res.status(409).json({ success: false, error: 'ALREADY_COMPLETED', message: 'Card is already enrolled in this campaign.' })
    return
  }

  const { data, error } = await supabase
    .from('campaign_progress')
    .insert({ card_uid, campaign_id: id, current_value: 0, completed: false })
    .select()
    .single()

  if (error) throw error

  res.status(201).json({ success: true, data })
})

// GET /api/kiosk/foods — all available food items with vendor + grid position
router.get('/kiosk/foods', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('food_items')
    .select('food_id, name, calories, price_in_points, vendors(vendor_id, business_name, grid_x, grid_y)')
    .eq('is_available', true)
    .not('calories', 'is', null)
    .limit(100)
  if (error) throw error
  res.json({ success: true, data: data ?? [] })
})

// POST /api/kiosk/tap
// Directory rebate tap — called by kiosk React app on card scan
router.post('/kiosk/tap', validate(kioskTapSchema), async (req: Request, res: Response): Promise<void> => {
  const { card_uid, kiosk_id, device_timestamp } = req.body

  // Validate card
  const { data: card } = await supabase.from('cards').select('*').eq('uid', card_uid).single()
  if (!card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }
  if (!card.is_active) {
    res.status(403).json({ success: false, error: 'CARD_INACTIVE', message: 'Card is inactive.' })
    return
  }

  // Validate kiosk
  const { data: kiosk } = await supabase.from('kiosks').select('*').eq('kiosk_id', kiosk_id).eq('is_active', true).single()
  if (!kiosk) {
    res.status(404).json({ success: false, error: 'VENDOR_NOT_FOUND', message: 'Kiosk not found.' })
    return
  }

  const server_timestamp = new Date().toISOString()

  // Insert tap event (vendor_id is null for kiosk taps — use a placeholder reference via metadata)
  // We store kiosk_id in metadata instead since kiosks are not vendors
  const { data: tapEvent } = await supabase
    .from('tap_events')
    .insert({
      card_uid,
      vendor_id: null,
      event_type: 'DIRECTORY_REBATE',
      device_timestamp,
      server_timestamp,
      synced_from_queue: false,
      metadata: { kiosk_id, kiosk_label: kiosk.label }
    })
    .select()
    .single()

  // Find active DIRECTORY_REBATE campaign for this card
  let campaign_completed: string | null = null
  let voucher_issued: string | null = null
  let points_added = 0

  try {
    const { data: drCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .eq('condition_type', 'DIRECTORY_REBATE')

    for (const campaign of drCampaigns ?? []) {
      const { data: progress } = await supabase
        .from('campaign_progress')
        .select('*')
        .eq('card_uid', card_uid)
        .eq('campaign_id', campaign.campaign_id)
        .single()

      if (!progress || progress.completed) continue

      // DIRECTORY_REBATE threshold is always 1 — single tap completes it
      await supabase.from('campaign_progress').update({
        current_value: 1,
        completed: true,
        completed_at: server_timestamp
      }).eq('progress_id', progress.progress_id)

      // Issue voucher
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

      // Add rebate points directly to balance
      points_added = Number(campaign.reward_value)
      await supabase.from('cards').update({
        points_balance: Number(card.points_balance) + points_added
      }).eq('uid', card_uid)

      await supabase.from('points_log').insert({
        card_uid,
        delta: points_added,
        reason: 'CAMPAIGN_REWARD',
        reference_id: newVoucher?.voucher_id
      })

      campaign_completed = campaign.name
      voucher_issued = newVoucher?.voucher_id ?? null
      break // one rebate campaign per tap
    }
  } catch (err) {
    console.error('Kiosk campaign processing failed (non-fatal):', err)
  }

  const new_balance = Number(card.points_balance) + points_added

  res.json({
    success: true,
    data: {
      card_uid,
      points_balance: new_balance,
      kiosk_grid: { x: kiosk.grid_x, y: kiosk.grid_y },
      campaign_completed,
      voucher_issued,
      tap_event_id: tapEvent?.event_id ?? null
    }
  })
})

// POST /api/campaigns/apply — vendor submits a campaign proposal for admin review
router.post('/apply', validate(campaignApplicationSchema), async (req: Request, res: Response): Promise<void> => {
  const { vendor_id, card_uid, name, description, period_start, period_end, condition_type, condition_threshold, point_deduction, reward_value } = req.body

  // Verify card owns this vendor
  const { data: vendor } = await supabase.from('vendors').select('vendor_id').eq('vendor_id', vendor_id).eq('owner_card_uid', card_uid).single()
  if (!vendor) {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Card does not own this vendor.' })
    return
  }

  const { data, error } = await supabase
    .from('campaign_applications')
    .insert({ vendor_id, name, description: description ?? null, period_start: period_start ?? null, period_end: period_end ?? null, condition_type, condition_threshold, point_deduction: point_deduction ?? null, reward_value })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
})

// GET /api/campaigns/applications/admin?card_uid= — all applications (admin only)
router.get('/applications/admin', async (req: Request, res: Response): Promise<void> => {
  const { card_uid } = req.query
  if (!card_uid) { res.status(400).json({ success: false, error: 'MISSING_PARAMS' }); return }

  const { data: adminCard } = await supabase.from('cards').select('role').eq('uid', card_uid as string).single()
  if (!adminCard || adminCard.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Admin access required.' })
    return
  }

  const { data, error } = await supabase
    .from('campaign_applications')
    .select('*, vendors(business_name, owner_card_uid)')
    .order('created_at', { ascending: false })

  if (error) throw error
  res.json({ success: true, data: data ?? [] })
})

// POST /api/campaigns/applications/:id/review — admin approves or rejects a campaign application
router.post('/applications/:id/review', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { card_uid, action, rejection_reason } = req.body

  if (!card_uid || !action) { res.status(400).json({ success: false, error: 'MISSING_PARAMS' }); return }
  if (!['APPROVE', 'REJECT'].includes(action)) { res.status(400).json({ success: false, error: 'INVALID_ACTION' }); return }

  const { data: adminCard } = await supabase.from('cards').select('role').eq('uid', card_uid).single()
  if (!adminCard || adminCard.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Admin access required.' })
    return
  }

  const { data: app } = await supabase.from('campaign_applications').select('*').eq('application_id', id).single()
  if (!app) { res.status(404).json({ success: false, error: 'NOT_FOUND' }); return }

  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  await supabase.from('campaign_applications').update({
    status: newStatus,
    rejection_reason: rejection_reason ?? null,
    reviewed_by: card_uid,
    reviewed_at: new Date().toISOString()
  }).eq('application_id', id)

  // If approved, create actual campaign record
  if (action === 'APPROVE') {
    await supabase.from('campaigns').insert({
      name: app.name,
      description: app.description,
      condition_type: app.condition_type,
      condition_threshold: app.condition_threshold,
      reward_type: 'VOUCHER',
      reward_value: app.reward_value,
      applicable_vendor_ids: [app.vendor_id],
      is_active: true,
      start_date: app.period_start,
      end_date: app.period_end,
    })
  }

  res.json({ success: true, data: { application_id: id, status: newStatus } })
})

// GET /api/campaigns/applications?vendor_id=&card_uid= — list vendor's own applications
router.get('/applications', async (req: Request, res: Response): Promise<void> => {
  const { vendor_id, card_uid } = req.query
  if (!vendor_id || !card_uid) {
    res.status(400).json({ success: false, error: 'MISSING_PARAMS', message: 'vendor_id and card_uid are required.' })
    return
  }

  const { data: vendor } = await supabase.from('vendors').select('vendor_id').eq('vendor_id', vendor_id as string).eq('owner_card_uid', card_uid as string).single()
  if (!vendor) {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied.' })
    return
  }

  const { data, error } = await supabase
    .from('campaign_applications')
    .select('*')
    .eq('vendor_id', vendor_id as string)
    .order('created_at', { ascending: false })

  if (error) throw error
  res.json({ success: true, data: data ?? [] })
})

export default router
