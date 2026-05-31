import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// GET /api/map
// Returns full grid data — all active vendors and kiosks with positions
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const [vendorsResult, kiosksResult, anchorsResult] = await Promise.all([
    supabase
      .from('vendors')
      .select('vendor_id, business_name, category, grid_x, grid_y')
      .eq('is_active', true)
      .not('grid_x', 'is', null)
      .not('grid_y', 'is', null),
    supabase
      .from('kiosks')
      .select('kiosk_id, label, grid_x, grid_y')
      .eq('is_active', true),
    // BLE positioning beacons — the browser uses these to trilaterate the user's
    // live position (see apps/web/src/lib/useLivePosition.ts).
    supabase
      .from('positioning_anchors')
      .select('anchor_id, label, beacon_minor, grid_x, grid_y, rssi_at_1m, path_loss_n')
      .eq('is_active', true)
  ])

  if (vendorsResult.error) throw vendorsResult.error
  if (kiosksResult.error) throw kiosksResult.error
  // Anchors are optional (table may not exist yet on older DBs) — degrade gracefully.
  const anchors = anchorsResult.error ? [] : (anchorsResult.data ?? [])

  // Derive grid size from max positions
  const allX = [
    ...(vendorsResult.data ?? []).map(v => v.grid_x),
    ...(kiosksResult.data ?? []).map(k => k.grid_x)
  ].filter(Boolean)
  const allY = [
    ...(vendorsResult.data ?? []).map(v => v.grid_y),
    ...(kiosksResult.data ?? []).map(k => k.grid_y)
  ].filter(Boolean)

  const cols = allX.length > 0 ? Math.max(...allX) + 2 : 10
  const rows = allY.length > 0 ? Math.max(...allY) + 2 : 8

  res.json({
    success: true,
    data: {
      grid_size: { cols, rows },
      vendors: vendorsResult.data ?? [],
      kiosks: kiosksResult.data ?? [],
      anchors
    }
  })
})

export default router
