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
  calories: z.number().int().positive().optional(),
  calories_per_100g: z.number().positive().optional(),
  price_in_points: z.number().positive().optional(),
  price_per_100g: z.number().positive().optional(),
  photo_url: z.string().url().optional(),
  protein_g: z.number().min(0).optional(),
  carbs_g: z.number().min(0).optional(),
  fat_g: z.number().min(0).optional()
}).refine(
  d => d.price_in_points != null || d.price_per_100g != null,
  { message: 'Either price_in_points or price_per_100g is required.' }
)

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
    .insert({
      vendor_id: id,
      name: req.body.name,
      calories: req.body.calories ?? null,
      calories_per_100g: req.body.calories_per_100g ?? null,
      price_in_points: req.body.price_in_points ?? null,
      price_per_100g: req.body.price_per_100g ?? null,
      photo_url: req.body.photo_url ?? null,
      protein_g: req.body.protein_g ?? null,
      carbs_g: req.body.carbs_g ?? null,
      fat_g: req.body.fat_g ?? null,
    })
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

// --- ADMIN: Vendor application approval workflow ---

const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  rejection_reason: z.string().max(500).optional(),
})

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const raw = req.headers['x-card-uid']
  const cardUid = Array.isArray(raw) ? raw[0] : raw
  if (!cardUid) {
    res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'x-card-uid header required.' })
    return null
  }
  const { data: card } = await supabase.from('cards').select('role').eq('uid', cardUid).single()
  if (!card || card.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'NOT_AN_ADMIN', message: 'Admin role required.' })
    return null
  }
  return cardUid
}

// GET /api/vendors/pending — admin lists pending vendor applications
router.get('/admin/pending', async (req: Request, res: Response): Promise<void> => {
  const adminUid = await requireAdmin(req, res)
  if (!adminUid) return

  const { data, error } = await supabase
    .from('vendors')
    .select('*, owner_card_uid')
    .eq('application_status', 'PENDING_REVIEW')
    .order('registered_at', { ascending: true })

  if (error) throw error
  res.json({ success: true, data: data ?? [] })
})

// POST /api/vendors/:id/admin/review — admin approves or rejects a vendor
router.post('/:id/admin/review', validate(approvalSchema), async (req: Request, res: Response): Promise<void> => {
  const adminUid = await requireAdmin(req, res)
  if (!adminUid) return
  const id = String(req.params.id)
  const { action, rejection_reason } = req.body

  const updates: Record<string, any> = {
    application_status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    approved_at: action === 'APPROVE' ? new Date().toISOString() : null,
    approved_by: adminUid,
    rejection_reason: action === 'REJECT' ? (rejection_reason ?? null) : null,
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('vendor_id', id)
    .select()
    .single()

  if (error) throw error
  res.json({ success: true, data })
})

const complianceSchema = z.object({
  record_type: z.enum(['INCOME_TAX', 'ELECTRIC_BILL', 'BUSINESS_TAX', 'OTHER']),
  period_label: z.string().min(1).max(50),
  amount_rm: z.number().positive().optional(),
  reference_number: z.string().max(100).optional(),
  submitted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  notes: z.string().optional()
})

// GET /api/vendors/:id/compliance
router.get('/:id/compliance', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { data, error } = await supabase
    .from('compliance_records')
    .select('*')
    .eq('vendor_id', id)
    .order('submitted_at', { ascending: false })

  if (error) throw error
  res.json({ success: true, data: data ?? [] })
})

// POST /api/vendors/:id/compliance
router.post('/:id/compliance', validate(complianceSchema), async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { data, error } = await supabase
    .from('compliance_records')
    .insert({
      vendor_id: id,
      record_type: req.body.record_type,
      period_label: req.body.period_label,
      amount_rm: req.body.amount_rm ?? null,
      reference_number: req.body.reference_number ?? null,
      submitted_at: req.body.submitted_at,
      notes: req.body.notes ?? null
    })
    .select()
    .single()

  if (error) throw error
  res.status(201).json({ success: true, data })
})

// DELETE /api/vendors/:id/compliance/:rec_id
router.delete('/:id/compliance/:rec_id', async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id)
  const rec_id = String(req.params.rec_id)
  const authorised = await authoriseVendor(req, res, id)
  if (!authorised) return

  const { error } = await supabase
    .from('compliance_records')
    .delete()
    .eq('record_id', rec_id)
    .eq('vendor_id', id)

  if (error) throw error
  res.json({ success: true })
})

export default router
