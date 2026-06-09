-- ============================================================
-- Migration 010: Link positioning beacons to vendor stalls
-- ============================================================
-- Each BLE positioning beacon is mounted AT a vendor's stall, so a beacon
-- now "belongs to" a vendor. The vendor's grid_x/grid_y is the single source
-- of truth for where the beacon sits (the phone uses this both to trilaterate
-- and to tell the user which stall they're standing at — strongest beacon).
--
-- Safe to run multiple times (idempotent).
-- Requires migration 008 (positioning_anchors) — but this file self-seeds the
-- 3 demo beacons too, so it works even if 008's seed was skipped.
-- ============================================================

-- 1. Add the beacon -> vendor link. ON DELETE SET NULL: removing a vendor just
--    unlinks its beacon, it doesn't delete positioning data.
ALTER TABLE positioning_anchors
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_positioning_anchors_vendor ON positioning_anchors(vendor_id);

-- 2. Link beacons to real vendor stalls; each beacon's coordinates + label are
--    snapped to its stall (beacon position = vendor location). The ESP32 mounted
--    at each stall must be flashed with the matching ANCHOR_MINOR.
--      beacon 1 -> Wan Ali Kacang Putih  (8,5)  — MAIN store
--      beacon 2 -> Mee Goreng Siti       (2,8)
--      beacon 3 -> Nasi Lemak Pak Razif  (1,1)
--    Insert the beacon row if it doesn't exist yet; otherwise update the link.
--    rssi_at_1m / path_loss_n keep their existing (or default) calibration.
INSERT INTO positioning_anchors (beacon_minor, vendor_id, label, grid_x, grid_y)
SELECT m.beacon_minor, v.vendor_id, v.business_name, v.grid_x, v.grid_y
FROM (VALUES
    (1, '43fcda5f-214f-457b-8bd4-ee43971dc79d'::uuid),  -- Wan Ali Kacang Putih (main)
    (2, 'a1000000-0000-0000-0000-000000000002'::uuid),  -- Mee Goreng Siti
    (3, 'a1000000-0000-0000-0000-000000000001'::uuid)   -- Nasi Lemak Pak Razif
) AS m(beacon_minor, vendor_id)
JOIN vendors v ON v.vendor_id = m.vendor_id
ON CONFLICT (beacon_minor) DO UPDATE
    SET vendor_id = EXCLUDED.vendor_id,
        label     = EXCLUDED.label,
        grid_x    = EXCLUDED.grid_x,
        grid_y    = EXCLUDED.grid_y;
