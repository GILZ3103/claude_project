import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const faceLoginSchema = z.object({
  card_uid: z.string().min(4).max(20),
  kiosk_id: z.string(),
  confidence: z.number().min(0).max(1),
  device_timestamp: z.string(),
})

// GET /api/face/photos
// Face daemon sync — returns cards that have given consent and have a photo
router.get('/photos', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('cards')
    .select('uid, owner_name, photo_url')
    .not('photo_url', 'is', null)
    .eq('face_consent', true)
    .eq('is_active', true)

  if (error) throw error

  res.json({ success: true, data: data ?? [] })
})

// POST /api/face/login
// Kiosk calls this when face recognition confirms a user
router.post('/login', validate(faceLoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { card_uid, kiosk_id, confidence, device_timestamp } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, is_active')
    .eq('uid', card_uid)
    .single()

  if (error || !card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND' })
    return
  }

  if (!card.is_active) {
    res.status(403).json({ success: false, error: 'CARD_INACTIVE' })
    return
  }

  // Log as a tap event (event_type: FACE_LOGIN) — no points deducted
  await supabase.from('tap_events').insert({
    card_uid,
    event_type: 'FACE_LOGIN',
    device_timestamp,
    server_timestamp: new Date().toISOString(),
    synced_from_queue: false,
    metadata: { kiosk_id, confidence },
  })

  res.json({ success: true, data: { owner_name: card.owner_name } })
})

export default router
