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
    // live position and to name the stall they're standing at (strongest beacon).
    // Each beacon is mounted at a vendor stall (vendor_id), so its position comes
    // from that vendor. See apps/web/src/lib/useLivePosition.ts.
    supabase
      .from('positioning_anchors')
      .select('anchor_id, label, beacon_minor, grid_x, grid_y, rssi_at_1m, path_loss_n, vendor_id')
      .eq('is_active', true)
  ])

  if (vendorsResult.error) throw vendorsResult.error
  if (kiosksResult.error) throw kiosksResult.error
  // Anchors are optional (table/column may not exist yet on older DBs) — degrade gracefully.
  // Beacon position = its linked vendor's grid_x/grid_y (single source of truth); fall
  // back to the anchor's own coords/label when it isn't linked to a vendor.
  const vendorById = new Map(
    (vendorsResult.data ?? []).map(v => [v.vendor_id, v])
  )
  const anchors = (anchorsResult.error ? [] : (anchorsResult.data ?? [])).map(a => {
    const vendor = a.vendor_id ? vendorById.get(a.vendor_id) : undefined
    return {
      anchor_id: a.anchor_id,
      beacon_minor: a.beacon_minor,
      rssi_at_1m: a.rssi_at_1m,
      path_loss_n: a.path_loss_n,
      vendor_id: a.vendor_id ?? null,
      business_name: vendor?.business_name ?? null,
      label: vendor?.business_name ?? a.label,
      grid_x: vendor?.grid_x ?? a.grid_x,
      grid_y: vendor?.grid_y ?? a.grid_y,
    }
  })

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
