import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const enrolSchema = z.object({
  card_uid: z.string().min(4).max(20)
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

export default router
