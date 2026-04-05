import { Router, Request, Response } from 'express'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const vendorLoginSchema = z.object({
  uid: z.string().min(4).max(20),
  password: z.string().min(1)
})

// POST /api/auth/consumer/login
// Validates email + password, returns card profile (no password_hash in response)
router.post('/consumer/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, owner_email, phone_number, points_balance, calorie_limit, role, is_active, password_hash')
    .eq('owner_email', email)
    .single()

  if (error || !card) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Card not found.' })
    return
  }

  if (!card.is_active) {
    res.status(403).json({ success: false, error: 'ACCOUNT_DISABLED', message: 'This card has been deactivated.' })
    return
  }

  if (!card.password_hash) {
    res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'This card has no password. Please register again.' })
    return
  }

  const valid = await bcrypt.compare(password, card.password_hash)
  if (!valid) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Incorrect password.' })
    return
  }

  const { password_hash: _, ...safeCard } = card
  res.json({ success: true, data: safeCard })
})

// POST /api/auth/vendor/login
// Validates UID + password, checks VENDOR role, returns card + vendor_id
router.post('/vendor/login', validate(vendorLoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { uid, password } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, owner_email, phone_number, role, is_active, password_hash')
    .eq('uid', uid)
    .single()

  if (error || !card) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Card not found.' })
    return
  }

  if (!card.is_active) {
    res.status(403).json({ success: false, error: 'ACCOUNT_DISABLED', message: 'This card has been deactivated.' })
    return
  }

  if (!card.password_hash) {
    res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'This card has no password. Please register again.' })
    return
  }

  const valid = await bcrypt.compare(password, card.password_hash)
  if (!valid) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Incorrect password.' })
    return
  }

  if (card.role !== 'VENDOR') {
    res.status(403).json({ success: false, error: 'NOT_A_VENDOR', message: 'This card is not registered as a vendor. Complete stall registration first.' })
    return
  }

  // Fetch linked vendor
  const { data: vendor } = await supabase
    .from('vendors')
    .select('vendor_id, business_name, ssm_registration_number')
    .eq('owner_card_uid', uid)
    .eq('is_active', true)
    .single()

  const { password_hash: _, ...safeCard } = card
  res.json({ success: true, data: { ...safeCard, vendor_id: vendor?.vendor_id ?? null, business_name: vendor?.business_name ?? null } })
})

export default router
