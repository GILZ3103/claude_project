"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const supabase_1 = require("../lib/supabase");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    owner_card_uid: zod_1.z.string().min(4).max(20),
    business_name: zod_1.z.string().max(100),
    ssm_registration_number: zod_1.z.string().min(5).max(50),
    phone_number: zod_1.z.string().regex(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/, 'Invalid Malaysian phone number'),
    category: zod_1.z.string().max(50).optional(),
    description: zod_1.z.string().optional(),
    grid_x: zod_1.z.number().int().optional(),
    grid_y: zod_1.z.number().int().optional(),
    terminal_mac_address: zod_1.z.string().regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/).optional()
});
const foodItemSchema = zod_1.z.object({
    name: zod_1.z.string().max(100),
    calories: zod_1.z.number().int().positive().optional(),
    calories_per_100g: zod_1.z.number().positive().optional(),
    price_in_points: zod_1.z.number().positive().optional(),
    price_per_100g: zod_1.z.number().positive().optional(),
    photo_url: zod_1.z.string().url().optional(),
    protein_g: zod_1.z.number().min(0).optional(),
    carbs_g: zod_1.z.number().min(0).optional(),
    fat_g: zod_1.z.number().min(0).optional()
}).refine(d => d.price_in_points != null || d.price_per_100g != null, { message: 'Either price_in_points or price_per_100g is required.' });
// Auth helper — vendor routes require x-card-uid header with VENDOR role owning this vendor
async function authoriseVendor(req, res, vendorId) {
    const raw = req.headers['x-card-uid'];
    const cardUid = Array.isArray(raw) ? raw[0] : raw;
    if (!cardUid) {
        res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'x-card-uid header required.' });
        return false;
    }
    const { data: card } = await supabase_1.supabase
        .from('cards')
        .select('role')
        .eq('uid', cardUid)
        .single();
    if (!card || card.role !== 'VENDOR') {
        res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'Card does not have VENDOR role.' });
        return false;
    }
    const { data: vendor } = await supabase_1.supabase
        .from('vendors')
        .select('vendor_id')
        .eq('vendor_id', vendorId)
        .eq('owner_card_uid', cardUid)
        .single();
    if (!vendor) {
        res.status(403).json({ success: false, error: 'UNAUTHORIZED', message: 'This card does not own this vendor.' });
        return false;
    }
    return true;
}
// GET /api/vendors
router.get('/', async (_req, res) => {
    const { data, error } = await supabase_1.supabase
        .from('vendors')
        .select('vendor_id, business_name, category, description, grid_x, grid_y, terminal_mac_address, food_items(count)')
        .eq('is_active', true)
        .order('business_name');
    if (error)
        throw error;
    const vendors = (data ?? []).map((v) => ({
        vendor_id: v.vendor_id,
        business_name: v.business_name,
        category: v.category,
        description: v.description,
        grid_x: v.grid_x,
        grid_y: v.grid_y,
        food_item_count: v.food_items?.[0]?.count ?? 0
    }));
    res.json({ success: true, data: vendors });
});
// POST /api/vendors/register
router.post('/register', (0, validate_1.validate)(registerSchema), async (req, res) => {
    const { owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, terminal_mac_address } = req.body;
    const { data: card, error: cardError } = await supabase_1.supabase
        .from('cards')
        .select('uid, role')
        .eq('uid', owner_card_uid)
        .single();
    if (cardError || !card) {
        res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' });
        return;
    }
    // Check SSM number is not already registered
    const { data: existingSSM } = await supabase_1.supabase
        .from('vendors')
        .select('vendor_id')
        .eq('ssm_registration_number', ssm_registration_number)
        .single();
    if (existingSSM) {
        res.status(409).json({ success: false, error: 'SSM_ALREADY_REGISTERED', message: 'This SSM registration number is already in use.' });
        return;
    }
    // Upgrade card role to VENDOR
    await supabase_1.supabase.from('cards').update({ role: 'VENDOR', phone_number }).eq('uid', owner_card_uid);
    const { data: vendor, error } = await supabase_1.supabase
        .from('vendors')
        .insert({ owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, terminal_mac_address })
        .select()
        .single();
    if (error)
        throw error;
    res.status(201).json({ success: true, data: vendor });
});
// GET /api/vendors/:id/food
router.get('/:id/food', async (req, res) => {
    const id = String(req.params.id);
    const { data, error } = await supabase_1.supabase
        .from('food_items')
        .select('*')
        .eq('vendor_id', id)
        .order('name');
    if (error)
        throw error;
    res.json({ success: true, data: data ?? [] });
});
// POST /api/vendors/:id/food
router.post('/:id/food', (0, validate_1.validate)(foodItemSchema), async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { data: vendor } = await supabase_1.supabase.from('vendors').select('vendor_id').eq('vendor_id', id).single();
    if (!vendor) {
        res.status(404).json({ success: false, error: 'VENDOR_NOT_FOUND', message: 'Vendor not found.' });
        return;
    }
    const { data, error } = await supabase_1.supabase
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
        .single();
    if (error)
        throw error;
    res.status(201).json({ success: true, data });
});
// GET /api/vendors/:id/summary
router.get('/:id/summary', async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { data, error } = await supabase_1.supabase
        .from('subsidy_summary')
        .select('*')
        .eq('vendor_id', id);
    if (error)
        throw error;
    const rows = data ?? [];
    const grand_total = rows.reduce((sum, r) => sum + Number(r.total_subsidy_owed), 0);
    const { data: vendor } = await supabase_1.supabase.from('vendors').select('business_name').eq('vendor_id', id).single();
    res.json({
        success: true,
        data: {
            vendor_id: id,
            business_name: vendor?.business_name ?? null,
            campaigns: rows,
            grand_total_subsidy: grand_total
        }
    });
});
// POST /api/vendors/:id/claim
router.post('/:id/claim', async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { claim_period_start, claim_period_end } = req.body;
    if (!claim_period_start || !claim_period_end) {
        res.status(400).json({ success: false, error: 'INVALID_PAYLOAD', message: 'claim_period_start and claim_period_end are required.' });
        return;
    }
    // Query vouchers used at this vendor within the period
    const { data: usedVouchers, error: vErr } = await supabase_1.supabase
        .from('vouchers')
        .select('voucher_id, discount_value, campaigns(reward_value)')
        .eq('used_at_vendor_id', id)
        .eq('status', 'USED')
        .gte('used_at', claim_period_start)
        .lte('used_at', claim_period_end);
    if (vErr)
        throw vErr;
    const total_amount = (usedVouchers ?? []).reduce((sum, v) => {
        return sum + Number(v.campaigns?.reward_value ?? v.discount_value);
    }, 0);
    const { data: claim, error } = await supabase_1.supabase
        .from('subsidy_claims')
        .insert({ vendor_id: id, total_amount, claim_period_start, claim_period_end, status: 'PENDING_AUDIT' })
        .select()
        .single();
    if (error)
        throw error;
    res.status(201).json({ success: true, data: claim });
});
// GET /api/vendors/:id/claims
router.get('/:id/claims', async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { data, error } = await supabase_1.supabase
        .from('subsidy_claims')
        .select('*')
        .eq('vendor_id', id)
        .order('generated_at', { ascending: false });
    if (error)
        throw error;
    res.json({ success: true, data: data ?? [] });
});
const complianceSchema = zod_1.z.object({
    record_type: zod_1.z.enum(['INCOME_TAX', 'ELECTRIC_BILL', 'BUSINESS_TAX', 'OTHER']),
    period_label: zod_1.z.string().min(1).max(50),
    amount_rm: zod_1.z.number().positive().optional(),
    reference_number: zod_1.z.string().max(100).optional(),
    submitted_at: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
    notes: zod_1.z.string().optional()
});
// GET /api/vendors/:id/compliance
router.get('/:id/compliance', async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { data, error } = await supabase_1.supabase
        .from('compliance_records')
        .select('*')
        .eq('vendor_id', id)
        .order('submitted_at', { ascending: false });
    if (error)
        throw error;
    res.json({ success: true, data: data ?? [] });
});
// POST /api/vendors/:id/compliance
router.post('/:id/compliance', (0, validate_1.validate)(complianceSchema), async (req, res) => {
    const id = String(req.params.id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { data, error } = await supabase_1.supabase
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
        .single();
    if (error)
        throw error;
    res.status(201).json({ success: true, data });
});
// DELETE /api/vendors/:id/compliance/:rec_id
router.delete('/:id/compliance/:rec_id', async (req, res) => {
    const id = String(req.params.id);
    const rec_id = String(req.params.rec_id);
    const authorised = await authoriseVendor(req, res, id);
    if (!authorised)
        return;
    const { error } = await supabase_1.supabase
        .from('compliance_records')
        .delete()
        .eq('record_id', rec_id)
        .eq('vendor_id', id);
    if (error)
        throw error;
    res.json({ success: true });
});
exports.default = router;
