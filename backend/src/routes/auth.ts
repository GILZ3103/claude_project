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

const adminLoginSchema = z.object({
  authority_id: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1)
})

// POST /api/auth/consumer/login
router.post('/consumer/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, owner_email, phone_number, points_balance, calorie_limit, role, is_active, password_hash, photo_url')
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

  let vendorData = {}
  if (card.role === 'VENDOR') {
    const { data: vendor } = await supabase
      .from('vendors')
      .select('vendor_id, business_name, ssm_registration_number, application_status')
      .eq('owner_card_uid', safeCard.uid)
      .eq('is_active', true)
      .single()
    vendorData = {
      vendor_id: vendor?.vendor_id ?? null,
      business_name: vendor?.business_name ?? null,
      ssm_registration_number: vendor?.ssm_registration_number ?? null,
      application_status: vendor?.application_status ?? null,
    }
  }

  res.json({ success: true, data: { ...safeCard, ...vendorData } })
})

// POST /api/auth/vendor/login (uses email now for consistency)
router.post('/vendor/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, owner_email, phone_number, role, is_active, password_hash, photo_url')
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
    res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'No password set.' })
    return
  }

  const valid = await bcrypt.compare(password, card.password_hash)
  if (!valid) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Incorrect password.' })
    return
  }

  if (card.role !== 'VENDOR') {
    res.status(403).json({ success: false, error: 'NOT_A_VENDOR', message: 'This card is not registered as a vendor.' })
    return
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('vendor_id, business_name, ssm_registration_number, application_status, rejection_reason')
    .eq('owner_card_uid', card.uid)
    .eq('is_active', true)
    .single()

  const { password_hash: _, ...safeCard } = card
  res.json({
    success: true,
    data: {
      ...safeCard,
      vendor_id: vendor?.vendor_id ?? null,
      business_name: vendor?.business_name ?? null,
      application_status: vendor?.application_status ?? null,
      rejection_reason: vendor?.rejection_reason ?? null,
    }
  })
})

// POST /api/auth/admin/login
router.post('/admin/login', validate(adminLoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { authority_id, email, password } = req.body

  const { data: card, error } = await supabase
    .from('cards')
    .select('uid, owner_name, owner_email, role, is_active, password_hash, authority_id, department, photo_url')
    .eq('owner_email', email)
    .eq('authority_id', authority_id)
    .single()

  if (error || !card) {
    res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Admin account not found.' })
    return
  }

  if (!card.is_active) {
    res.status(403).json({ success: false, error: 'ACCOUNT_DISABLED', message: 'This admin account is disabled.' })
    return
  }

  if (card.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'NOT_AN_ADMIN', message: 'This account does not have admin privileges.' })
    return
  }

  if (!card.password_hash) {
    res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'No password set.' })
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

export default router
