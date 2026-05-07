"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const supabase_1 = require("../lib/supabase");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    uid: zod_1.z.string().min(4).max(20),
    owner_name: zod_1.z.string().max(100),
    owner_email: zod_1.z.string().email(),
    phone_number: zod_1.z.string().regex(/^(\+?6?01)[0-46-9]-*[0-9]{7,8}$/, 'Invalid Malaysian phone number'),
    password: zod_1.z.string().min(8).max(100)
});
const topupSchema = zod_1.z.object({
    amount: zod_1.z.number().positive()
});
const calorieLimitSchema = zod_1.z.object({
    calorie_limit: zod_1.z.number().int().positive()
});
// POST /api/cards/register
router.post('/register', (0, validate_1.validate)(registerSchema), async (req, res) => {
    const { uid, owner_name, owner_email, phone_number, password } = req.body;
    const { data: existing } = await supabase_1.supabase
        .from('cards')
        .select('uid')
        .eq('uid', uid)
        .single();
    if (existing) {
        res.status(409).json({ success: false, error: 'CARD_ALREADY_REGISTERED', message: 'This card UID is already registered.' });
        return;
    }
    const password_hash = await bcryptjs_1.default.hash(password, 10);
    const { data, error } = await supabase_1.supabase
        .from('cards')
        .insert({ uid, owner_name, owner_email, phone_number, password_hash, role: 'CONSUMER' })
        .select('uid, owner_name, owner_email, phone_number, points_balance, calorie_limit, role, registered_at, is_active')
        .single();
    if (error)
        throw error;
    res.status(201).json({ success: true, data });
});
// GET /api/cards/:uid
router.get('/:uid', async (req, res) => {
    const { uid } = req.params;
    const { data: card, error } = await supabase_1.supabase
        .from('cards')
        .select('*')
        .eq('uid', uid)
        .single();
    if (error || !card) {
        res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' });
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    // Calories today
    const { data: taps } = await supabase_1.supabase
        .from('tap_events')
        .select('metadata')
        .eq('card_uid', uid)
        .eq('event_type', 'TAP_PURCHASE')
        .gte('server_timestamp', `${today}T00:00:00+08:00`)
        .lte('server_timestamp', `${today}T23:59:59+08:00`);
    const calories_today = (taps ?? []).reduce((sum, t) => sum + (t.metadata?.calories ?? 0), 0);
    // Checkpoints today (distinct vendors tapped)
    const { data: checkpoints } = await supabase_1.supabase
        .from('tap_events')
        .select('vendor_id')
        .eq('card_uid', uid)
        .gte('server_timestamp', `${today}T00:00:00+08:00`)
        .lte('server_timestamp', `${today}T23:59:59+08:00`);
    const checkpoints_today = [...new Set((checkpoints ?? []).map(c => c.vendor_id))];
    // Active vouchers
    const { data: active_vouchers } = await supabase_1.supabase
        .from('vouchers')
        .select('voucher_id, discount_value, applicable_vendor_ids, expires_at')
        .eq('card_uid', uid)
        .eq('status', 'ACTIVE');
    // Vendor info (if VENDOR role)
    let vendor_id = null;
    let business_name = null;
    let ssm_registration_number = null;
    let grid_x = null;
    let grid_y = null;
    if (card.role === 'VENDOR') {
        const { data: vendor } = await supabase_1.supabase
            .from('vendors')
            .select('vendor_id, business_name, ssm_registration_number, grid_x, grid_y')
            .eq('owner_card_uid', uid)
            .eq('is_active', true)
            .single();
        vendor_id = vendor?.vendor_id ?? null;
        business_name = vendor?.business_name ?? null;
        ssm_registration_number = vendor?.ssm_registration_number ?? null;
        grid_x = vendor?.grid_x ?? null;
        grid_y = vendor?.grid_y ?? null;
    }
    res.json({
        success: true,
        data: {
            uid: card.uid,
            owner_name: card.owner_name,
            owner_email: card.owner_email,
            phone_number: card.phone_number,
            role: card.role,
            points_balance: card.points_balance,
            calorie_limit: card.calorie_limit,
            is_active: card.is_active,
            calories_today,
            checkpoints_today,
            active_vouchers: active_vouchers ?? [],
            vendor_id,
            business_name,
            ssm_registration_number,
            grid_x,
            grid_y
        }
    });
});
// GET /api/cards/:uid/history
router.get('/:uid/history', async (req, res) => {
    const { uid } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const { data: card } = await supabase_1.supabase.from('cards').select('uid').eq('uid', uid).single();
    if (!card) {
        res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' });
        return;
    }
    const { data, count, error } = await supabase_1.supabase
        .from('tap_events')
        .select('event_id, vendor_id, event_type, metadata, server_timestamp, vendors(business_name)', { count: 'exact' })
        .eq('card_uid', uid)
        .order('server_timestamp', { ascending: false })
        .range(offset, offset + limit - 1);
    if (error)
        throw error;
    const history = (data ?? []).map((e) => ({
        event_id: e.event_id,
        vendor_name: e.vendors?.business_name ?? null,
        event_type: e.event_type,
        food_name: e.metadata?.food_name ?? null,
        calories: e.metadata?.calories ?? null,
        final_cost: e.metadata?.final_cost ?? null,
        server_timestamp: e.server_timestamp
    }));
    res.json({ success: true, data: { uid, total: count ?? 0, limit, offset, history } });
});
// GET /api/cards/:uid/vouchers
router.get('/:uid/vouchers', async (req, res) => {
    const { uid } = req.params;
    const { status } = req.query;
    let query = supabase_1.supabase
        .from('vouchers')
        .select('*, campaigns(name)')
        .eq('card_uid', uid)
        .order('issued_at', { ascending: false });
    if (status)
        query = query.eq('status', status);
    const { data, error } = await query;
    if (error)
        throw error;
    res.json({ success: true, data: data ?? [] });
});
// PATCH /api/cards/:uid/calorie-limit
router.patch('/:uid/calorie-limit', (0, validate_1.validate)(calorieLimitSchema), async (req, res) => {
    const { uid } = req.params;
    const { calorie_limit } = req.body;
    const { data, error } = await supabase_1.supabase
        .from('cards')
        .update({ calorie_limit })
        .eq('uid', uid)
        .select()
        .single();
    if (error || !data) {
        res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' });
        return;
    }
    res.json({ success: true, data });
});
// POST /api/cards/:uid/topup
router.post('/:uid/topup', (0, validate_1.validate)(topupSchema), async (req, res) => {
    const { uid } = req.params;
    const { amount } = req.body;
    const { data: card, error: fetchError } = await supabase_1.supabase
        .from('cards')
        .select('uid, points_balance')
        .eq('uid', uid)
        .single();
    if (fetchError || !card) {
        res.status(404).json({ success: false, error: 'CARD_NOT_FOUND', message: 'Card not found.' });
        return;
    }
    const new_balance = Number(card.points_balance) + amount;
    const { error: updateError } = await supabase_1.supabase
        .from('cards')
        .update({ points_balance: new_balance })
        .eq('uid', uid);
    if (updateError)
        throw updateError;
    await supabase_1.supabase.from('points_log').insert({
        card_uid: uid,
        delta: amount,
        reason: 'TOPUP'
    });
    res.json({ success: true, data: { uid, points_balance: new_balance } });
});
exports.default = router;
