"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const router = (0, express_1.Router)();
// GET /api/map
// Returns full grid data — all active vendors and kiosks with positions
router.get('/', async (_req, res) => {
    const [vendorsResult, kiosksResult] = await Promise.all([
        supabase_1.supabase
            .from('vendors')
            .select('vendor_id, business_name, category, grid_x, grid_y')
            .eq('is_active', true)
            .not('grid_x', 'is', null)
            .not('grid_y', 'is', null),
        supabase_1.supabase
            .from('kiosks')
            .select('kiosk_id, label, grid_x, grid_y')
            .eq('is_active', true)
    ]);
    if (vendorsResult.error)
        throw vendorsResult.error;
    if (kiosksResult.error)
        throw kiosksResult.error;
    // Derive grid size from max positions
    const allX = [
        ...(vendorsResult.data ?? []).map(v => v.grid_x),
        ...(kiosksResult.data ?? []).map(k => k.grid_x)
    ].filter(Boolean);
    const allY = [
        ...(vendorsResult.data ?? []).map(v => v.grid_y),
        ...(kiosksResult.data ?? []).map(k => k.grid_y)
    ].filter(Boolean);
    const cols = allX.length > 0 ? Math.max(...allX) + 2 : 10;
    const rows = allY.length > 0 ? Math.max(...allY) + 2 : 8;
    res.json({
        success: true,
        data: {
            grid_size: { cols, rows },
            vendors: vendorsResult.data ?? [],
            kiosks: kiosksResult.data ?? []
        }
    });
});
exports.default = router;
