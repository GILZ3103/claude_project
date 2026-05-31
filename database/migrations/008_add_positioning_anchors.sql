-- ============================================================
-- Migration 008: BLE Positioning Anchors (indoor navigation)
-- ============================================================
-- Fixed BLE beacons the phone scans (via Web Bluetooth) to
-- trilaterate its own position on the existing vendor grid.
-- Safe to run multiple times (idempotent with IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS positioning_anchors (
    anchor_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label         VARCHAR(100),
    beacon_minor  INTEGER NOT NULL,
    grid_x        NUMERIC(6,2) NOT NULL,
    grid_y        NUMERIC(6,2) NOT NULL,
    rssi_at_1m    INTEGER      NOT NULL DEFAULT -59,
    path_loss_n   NUMERIC(4,2) NOT NULL DEFAULT 2.5,
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (beacon_minor)
);

CREATE INDEX IF NOT EXISTS idx_positioning_anchors_active ON positioning_anchors(is_active);

-- Seed 3 sample anchors (placeholder coords + calibration). Replace grid_x/grid_y
-- with real mounted positions and re-calibrate rssi_at_1m / path_loss_n on site.
INSERT INTO positioning_anchors (label, beacon_minor, grid_x, grid_y, rssi_at_1m, path_loss_n) VALUES
    ('Anchor A - Entrance',   1, 1.0, 1.0, -59, 2.5),
    ('Anchor B - Food Court', 2, 5.0, 4.0, -59, 2.5),
    ('Anchor C - Beverages',  3, 8.0, 6.0, -59, 2.5)
ON CONFLICT (beacon_minor) DO NOTHING;
