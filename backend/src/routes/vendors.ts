import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { validate } from '../middleware/validate'

const router = Router()

const registerSchema = z.object({
  owner_card_uid: z.string().min(4).max(20),
  business_name: z.string().max(100),
  ssm_registration_number: z.string().min(5).max(50),
  phone_number: z.string().regex(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/, 'Invalid Malaysian phone number'),
  category: z.string().max(50).optional(),
  description: z.string().optional(),
  grid_x: z.number().int().optional(),
  grid_y: z.number().int().optional(),
  terminal_mac_address: z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/).optional()
})

const foodItemSchema = z.object({
  name: z.string().max(100),
  calories: z.number().int().positive(),
  price_in_points: z.number().positive(),
  photo_url: z.string().url().optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional()
})

// Auth helper — vendor routes require x-card-uid header with VENDOR role owning this vendor
async function authoriseVendor(req: Request, res: Response<any, any>, vendorId: string): Promise<boolean> {
  const raw = req.headers['x-card-uid']
  const cardUid = Array.isArray(raw) ? raw[0] : raw
  if (!cardUid) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'x-card-uid header required.' })
    return false
  }

  const { data: card } = await supabase
    .from('cards')
    .select('role')
    .eq('uid', cardUid)
    .single()

  if (!card || card.role !== 'VENDOR') {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'Card does not have VENDOR role.' })
    return false
  }

  const { data: vendor } = await supabase
    .from('vendors')
    .select('vendor_id')
    .eq('vendor_id', vendorId)
    .eq('owner_card_uid', cardUid)
    .single()

  if (!vendor) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'This card does not own this vendor.' })
    return false
  }

  return true
}

// GET /api/vendors
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabase
    .from('vendors')
    .select('vendor_id, business_name, category, description, grid_x, grid_y, terminal_mac_address, food_items(count)')
    .eq('is_active', true)
    .order('business_name')

  if (error) throw error

  const vendors = (data ?? []).map((v: any) => ({
    vendor_id: v.vendor_id,
    business_name: v.business_name,
    category: v.category,
    description: v.description,
    grid_x: v.grid_x,
    grid_y: v.grid_y,
    food_item_count: v.food_items?.[0]?.count ?? 0
  }))

  res.json({ success: true, data: vendors })
})

// POST /api/vendors/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const { owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, terminal_mac_address } = req.body

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('uid, role')
    .eq('uid', owner_card_uid)
    .single()

  if (cardError || !card) {
    res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' })
    return
  }

  // Check SSM number is not already registered
  const { data: existingSSM } = await supabase
    .from('vendors')
    .select('vendor_id')
    .eq('ssm_registration_number', ssm_registration_number)
    .single()

  if (existingSSM) {
    res.status(409).json({ success: false, error: 'SSM_ALREADY_REGISTERED', message: 'This SSM registration number is already in use.' })
    return
  }

  // Upgrade card role to VENDOR
  await supabase.from('cards').update({ role: 'VENDOR', phone_number }).eq('uid', owner_card_uid)

  const { data: vendor, error } = await supabase
    .from('vendors')
    .insert({ owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, terminal_mac_address })
    .select()
    .single()

  if (error) throw error

  res.status(201).json({ success: true, data: vendor })
})

// GET /api/vendors/:id/food
router.get('/:id/food', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const { data, error } = await supabase
    .from('food_items')
    .select('*')
    .eq('vendor_id', id)
    .order('name')

  if (error) throw error

  res.json({ success: true, data: data ?? [] })
})

// POST /api/vendors/:id/food
router.post('/:id/food', validate(foodItemSchema), async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)

  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { data: vendor } = await supabase.from('vendors').select('vendor_id').eq('vendor_id', id).single()
  if (!vendor) {
    res.status(404).json({ success: false, error: 'VENDOR_NOT_FOUND', message: 'Vendor not found.' })
    return
  }

  const { data, error } = await supabase
    .from('food_items')
    .insert({ vendor_id: id, ...req.body })
    .select()
    .single()

  if (error) throw error

  res.status(201).json({ success: true, data })
})

// GET /api/vendors/:id/summary
router.get('/:id/summary', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)

  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { data, error } = await supabase
    .from('subsidy_summary')
    .select('*')
    .eq('vendor_id', id)

  if (error) throw error

  const rows = data ?? []
  const grand_total = rows.reduce((sum: number, r: any) => sum + Number(r.total_subsidy_owed), 0)

  const { data: vendor } = await supabase.from('vendors').select('business_name').eq('vendor_id', id).single()

  res.json({
    success: true,
    data: {
      vendor_id: id,
      business_name: vendor?.business_name ?? null,
      campaigns: rows,
      grand_total_subsidy: grand_total
    }
  })
})

// POST /api/vendors/:id/claim
router.post('/:id/claim', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)

  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { claim_period_start, claim_period_end } = req.body

  if (!claim_period_start || !claim_period_end) {
    res.status(400).json({ success: false, error: 'INVALID_PAYLOAD', message: 'claim_period_start and claim_period_end are required.' })
    return
  }

  // Query vouchers used at this vendor within the period
  const { data: usedVouchers, error: vErr } = await supabase
    .from('vouchers')
    .select('voucher_id, discount_value, campaigns(reward_value)')
    .eq('used_at_vendor_id', id)
    .eq('status', 'USED')
    .gte('used_at', claim_period_start)
    .lte('used_at', claim_period_end)

  if (vErr) throw vErr

  const total_amount = (usedVouchers ?? []).reduce((sum: number, v: any) => {
    return sum + Number(v.campaigns?.reward_value ?? v.discount_value)
  }, 0)

  const { data: claim, error } = await supabase
    .from('subsidy_claims')
    .insert({ vendor_id: id, total_amount, claim_period_start, claim_period_end, status: 'PENDING_AUDIT' })
    .select()
    .single()

  if (error) throw error

  res.status(201).json({ success: true, data: claim })
})

// GET /api/vendors/:id/claims
router.get('/:id/claims', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)

  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { data, error } = await supabase
    .from('subsidy_claims')
    .select('*')
    .eq('vendor_id', id)
    .order('generated_at', { ascending: false })

  if (error) throw error

  res.json({ success: true, data: data ?? [] })
})

export default router
