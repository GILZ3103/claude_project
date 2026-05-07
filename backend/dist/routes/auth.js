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
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1)
});
const vendorLoginSchema = zod_1.z.object({
    uid: zod_1.z.string().min(4).max(20),
    password: zod_1.z.string().min(1)
});
// POST /api/auth/consumer/login
// Validates email + password, returns card profile (no password_hash in response)
router.post('/consumer/login', (0, validate_1.validate)(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    const { data: card, error } = await supabase_1.supabase
        .from('cards')
        .select('uid, owner_name, owner_email, phone_number, points_balance, calorie_limit, role, is_active, password_hash')
        .eq('owner_email', email)
        .single();
    if (error || !card) {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Card not found.' });
        return;
    }
    if (!card.is_active) {
        res.status(403).json({ success: false, error: 'ACCOUNT_DISABLED', message: 'This card has been deactivated.' });
        return;
    }
    if (!card.password_hash) {
        res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'This card has no password. Please register again.' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, card.password_hash);
    if (!valid) {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Incorrect password.' });
        return;
    }
    const { password_hash: _, ...safeCard } = card;
    // If VENDOR role, also return vendor_id + business_name + ssm
    let vendorData = {};
    if (card.role === 'VENDOR') {
        const { data: vendor } = await supabase_1.supabase
            .from('vendors')
            .select('vendor_id, business_name, ssm_registration_number')
            .eq('owner_card_uid', safeCard.uid)
            .eq('is_active', true)
            .single();
        vendorData = {
            vendor_id: vendor?.vendor_id ?? null,
            business_name: vendor?.business_name ?? null,
            ssm_registration_number: vendor?.ssm_registration_number ?? null,
        };
    }
    res.json({ success: true, data: { ...safeCard, ...vendorData } });
});
// POST /api/auth/vendor/login
// Validates UID + password, checks VENDOR role, returns card + vendor_id
router.post('/vendor/login', (0, validate_1.validate)(vendorLoginSchema), async (req, res) => {
    const { uid, password } = req.body;
    const { data: card, error } = await supabase_1.supabase
        .from('cards')
        .select('uid, owner_name, owner_email, phone_number, role, is_active, password_hash')
        .eq('uid', uid)
        .single();
    if (error || !card) {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Card not found.' });
        return;
    }
    if (!card.is_active) {
        res.status(403).json({ success: false, error: 'ACCOUNT_DISABLED', message: 'This card has been deactivated.' });
        return;
    }
    if (!card.password_hash) {
        res.status(401).json({ success: false, error: 'NO_PASSWORD_SET', message: 'This card has no password. Please register again.' });
        return;
    }
    const valid = await bcryptjs_1.default.compare(password, card.password_hash);
    if (!valid) {
        res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Incorrect password.' });
        return;
    }
    if (card.role !== 'VENDOR') {
        res.status(403).json({ success: false, error: 'NOT_A_VENDOR', message: 'This card is not registered as a vendor. Complete stall registration first.' });
        return;
    }
    // Fetch linked vendor
    const { data: vendor } = await supabase_1.supabase
        .from('vendors')
        .select('vendor_id, business_name, ssm_registration_number')
        .eq('owner_card_uid', uid)
        .eq('is_active', true)
        .single();
    const { password_hash: _, ...safeCard } = card;
    res.json({ success: true, data: { ...safeCard, vendor_id: vendor?.vendor_id ?? null, business_name: vendor?.business_name ?? null } });
});
exports.default = router;
