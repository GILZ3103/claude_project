-- ============================================================
-- NightMarket — Complete Database Setup
-- Run this ENTIRE file once in Supabase SQL Editor.
-- It is safe to re-run (uses IF NOT EXISTS + ON CONFLICT DO NOTHING).
-- ============================================================


-- ============================================================
-- STEP 1 — CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS cards (
    uid                 VARCHAR(20) PRIMARY KEY,
    owner_name          VARCHAR(100),
    owner_email         VARCHAR(255) UNIQUE,
    phone_number        VARCHAR(20),
    password_hash       VARCHAR(255),
    points_balance      DECIMAL(10,2) DEFAULT 0,
    calorie_limit       INTEGER DEFAULT 2000,
    role                VARCHAR(20) DEFAULT 'CONSUMER'
                        CHECK (role IN ('CONSUMER', 'VENDOR', 'ADMIN')),
    photo_url           TEXT,
    has_physical_card   BOOLEAN DEFAULT FALSE,
    face_enrolled_at    TIMESTAMPTZ,
    face_consent        BOOLEAN DEFAULT FALSE,
    authority_id        VARCHAR(50),
    department          VARCHAR(100),
    registered_at       TIMESTAMPTZ DEFAULT NOW(),
    is_active           BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vendors (
    vendor_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_card_uid          VARCHAR(20) REFERENCES cards(uid) ON DELETE SET NULL,
    terminal_mac_address    VARCHAR(17) UNIQUE,
    business_name           VARCHAR(100) NOT NULL,
    ssm_registration_number VARCHAR(50) UNIQUE,
    phone_number            VARCHAR(20),
    category                VARCHAR(50),
    description             TEXT,
    grid_x                  INTEGER,
    grid_y                  INTEGER,
    is_active               BOOLEAN DEFAULT TRUE,
    application_status      VARCHAR(20) DEFAULT 'PENDING_REVIEW'
                            CHECK (application_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
    business_license_url    TEXT,
    typhoid_cert_url        TEXT,
    food_handling_cert_url  TEXT,
    rejection_reason        TEXT,
    approved_at             TIMESTAMPTZ,
    approved_by             VARCHAR(20),
    registered_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_items (
    food_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    photo_url           TEXT,
    calories            INTEGER,
    price_in_points     DECIMAL(10,2),
    is_available        BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tap_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid            VARCHAR(20) REFERENCES cards(uid) ON DELETE RESTRICT,
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
    event_type          VARCHAR(50) NOT NULL
                        CHECK (event_type IN ('TAP_PURCHASE', 'DIRECTORY_REBATE')),
    device_timestamp    TIMESTAMPTZ NOT NULL,
    server_timestamp    TIMESTAMPTZ DEFAULT NOW(),
    synced_from_queue   BOOLEAN DEFAULT FALSE,
    weight_g            NUMERIC(8,2),
    metadata            JSONB
);

CREATE TABLE IF NOT EXISTS points_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid        VARCHAR(20) REFERENCES cards(uid) ON DELETE RESTRICT,
    delta           DECIMAL(10,2) NOT NULL,
    reason          VARCHAR(50) NOT NULL
                    CHECK (reason IN ('TAP_PURCHASE', 'VOUCHER_DISCOUNT', 'TOPUP', 'CAMPAIGN_REWARD')),
    reference_id    UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(100) NOT NULL,
    description             TEXT,
    condition_type          VARCHAR(30) NOT NULL
                            CHECK (condition_type IN ('VISIT_STALLS', 'SPEND_POINTS', 'DIRECTORY_REBATE')),
    condition_threshold     DECIMAL(10,2) NOT NULL,
    reward_value            DECIMAL(10,2) NOT NULL,
    applicable_vendor_ids   JSONB,
    is_active               BOOLEAN DEFAULT TRUE,
    starts_at               TIMESTAMPTZ,
    ends_at                 TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_progress (
    progress_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid        VARCHAR(20) REFERENCES cards(uid) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    current_value   DECIMAL(10,2) DEFAULT 0,
    completed       BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    UNIQUE (card_uid, campaign_id)
);

CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid                VARCHAR(20) REFERENCES cards(uid) ON DELETE CASCADE,
    campaign_id             UUID REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    discount_value          DECIMAL(10,2) NOT NULL,
    applicable_vendor_ids   JSONB,
    status                  VARCHAR(20) DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'USED', 'EXPIRED')),
    issued_at               TIMESTAMPTZ DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    used_at                 TIMESTAMPTZ,
    used_at_vendor_id       UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS kiosks (
    kiosk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label           VARCHAR(50) NOT NULL,
    grid_x          INTEGER NOT NULL,
    grid_y          INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS subsidy_claims (
    claim_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
    total_amount        DECIMAL(10,2) NOT NULL,
    claim_period_start  TIMESTAMPTZ NOT NULL,
    claim_period_end    TIMESTAMPTZ NOT NULL,
    status              VARCHAR(30) DEFAULT 'PENDING_AUDIT'
                        CHECK (status IN ('PENDING_AUDIT', 'APPROVED', 'PAID')),
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terminal_calibration (
    calibration_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id       UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    scale_factor    NUMERIC(12,6) NOT NULL,
    tare_offset     INTEGER NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (vendor_id)
);

CREATE TABLE IF NOT EXISTS compliance_records (
    record_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id        UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    record_type      VARCHAR(30) NOT NULL CHECK (record_type IN ('INCOME_TAX','ELECTRIC_BILL','BUSINESS_TAX','OTHER')),
    period_label     VARCHAR(50) NOT NULL,
    amount_rm        NUMERIC(12,2),
    reference_number VARCHAR(100),
    submitted_at     DATE NOT NULL,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- STEP 2 — ADD COLUMNS (safe on existing tables too)
-- ============================================================

ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS protein_g        NUMERIC(6,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carbs_g          NUMERIC(6,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fat_g            NUMERIC(6,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calories_per_100g NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS price_per_100g   NUMERIC(10,2);

ALTER TABLE tap_events
  ADD COLUMN IF NOT EXISTS weight_g NUMERIC(8,2);

-- cards: add new columns for existing tables set up with old schema
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS photo_url         TEXT,
  ADD COLUMN IF NOT EXISTS has_physical_card BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS face_enrolled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_consent      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS authority_id      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS department        VARCHAR(100);

-- cards: expand role check to include ADMIN
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_role_check;
ALTER TABLE cards ADD CONSTRAINT cards_role_check
  CHECK (role IN ('CONSUMER', 'VENDOR', 'ADMIN'));

-- vendors: add application workflow columns for existing tables
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS application_status      VARCHAR(20) DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS business_license_url    TEXT,
  ADD COLUMN IF NOT EXISTS typhoid_cert_url         TEXT,
  ADD COLUMN IF NOT EXISTS food_handling_cert_url   TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason         TEXT,
  ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by              VARCHAR(20);

ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_application_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_application_status_check
  CHECK (application_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));

UPDATE vendors SET application_status = 'APPROVED', approved_at = NOW()
  WHERE application_status IS NULL;


CREATE TABLE IF NOT EXISTS campaign_applications (
    application_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID NOT NULL REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    period_start        DATE,
    period_end          DATE,
    condition_type      VARCHAR(30) NOT NULL DEFAULT 'SPEND_POINTS'
                        CHECK (condition_type IN ('VISIT_STALLS','SPEND_POINTS','DIRECTORY_REBATE')),
    condition_threshold NUMERIC(10,2) NOT NULL DEFAULT 1,
    point_deduction     NUMERIC(10,2),
    reward_value        NUMERIC(10,2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    rejection_reason    TEXT,
    reviewed_by         VARCHAR(20) REFERENCES cards(uid),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positioning_anchors (
    anchor_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label         VARCHAR(100),
    beacon_minor  INTEGER NOT NULL,
    grid_x        NUMERIC(6,2) NOT NULL,
    grid_y        NUMERIC(6,2) NOT NULL,
    rssi_at_1m    INTEGER      NOT NULL DEFAULT -59,
    path_loss_n   NUMERIC(4,2) NOT NULL DEFAULT 2.5,
    is_active     BOOLEAN      DEFAULT TRUE,
    -- Beacon is mounted at a vendor stall; the vendor's grid_x/grid_y is the
    -- authoritative position. See migration 010.
    vendor_id     UUID REFERENCES vendors(vendor_id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (beacon_minor)
);


-- ============================================================
-- STEP 3 — INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tap_card_ts   ON tap_events(card_uid, server_timestamp);
CREATE INDEX IF NOT EXISTS idx_tap_vendor    ON tap_events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_tap_device_ts ON tap_events(device_timestamp);
CREATE INDEX IF NOT EXISTS idx_cp_card       ON campaign_progress(card_uid);
CREATE INDEX IF NOT EXISTS idx_voucher_card  ON vouchers(card_uid, status);
CREATE INDEX IF NOT EXISTS idx_points_card   ON points_log(card_uid, created_at);
CREATE INDEX IF NOT EXISTS idx_compliance    ON compliance_records(vendor_id, submitted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS vendors_ssm_unique
  ON vendors (ssm_registration_number)
  WHERE ssm_registration_number IS NOT NULL;


-- ============================================================
-- STEP 4 — VIEW
-- ============================================================

CREATE OR REPLACE VIEW subsidy_summary AS
SELECT
    v.vendor_id,
    v.business_name,
    c.campaign_id,
    c.name                  AS campaign_name,
    c.reward_value          AS subsidy_per_redemption,
    COUNT(vou.voucher_id)   AS total_redemptions,
    (COUNT(vou.voucher_id) * c.reward_value) AS total_subsidy_owed
FROM vouchers vou
JOIN campaigns c   ON vou.campaign_id       = c.campaign_id
JOIN vendors v     ON vou.used_at_vendor_id = v.vendor_id
WHERE vou.status = 'USED'
GROUP BY v.vendor_id, v.business_name, c.campaign_id, c.name, c.reward_value;


-- ============================================================
-- STEP 5 — SEED DATA (test accounts, all passwords = password123)
-- ============================================================

-- Vendor cards
INSERT INTO cards (uid, owner_name, owner_email, phone_number, password_hash, points_balance, calorie_limit, role, is_active)
VALUES
  ('VENDOR001', 'Ahmad Razif',   'ahmad.razif@nightmarket.my',   '0123456789', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 50.00, 2000, 'VENDOR',   true),
  ('VENDOR002', 'Siti Hajar',    'siti.hajar@nightmarket.my',    '0187654321', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 80.00, 2000, 'VENDOR',   true),
  ('VENDOR003', 'Ramu Krishnan', 'ramu.krishnan@nightmarket.my', '0112345678', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 30.00, 2000, 'VENDOR',   true),
  ('TESTCARD001','Ahmad Farid',  'ahmad.farid@email.com',        '0198765432', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVwES7RvA.', 50.00, 2000, 'CONSUMER', true)
ON CONFLICT (uid) DO NOTHING;

-- Vendors
INSERT INTO vendors (vendor_id, owner_card_uid, business_name, ssm_registration_number, phone_number, category, description, grid_x, grid_y, is_active)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'VENDOR001', 'Nasi Lemak Pak Razif', '001234567-A', '0123456789', 'Rice',   'Best nasi lemak in town',    1, 1, true),
  ('a1000000-0000-0000-0000-000000000002', 'VENDOR002', 'Mee Goreng Siti',      '007654321-B', '0187654321', 'Noodle', 'Spicy mee goreng specialist', 3, 1, true),
  ('a1000000-0000-0000-0000-000000000003', 'VENDOR003', 'Roti Canai Ramu',      '009988776-C', '0112345678', 'Bread',  'Traditional roti canai',     5, 2, true)
ON CONFLICT (vendor_id) DO NOTHING;

-- Positioning beacons — one per demo vendor stall (beacon coords = vendor location).
INSERT INTO positioning_anchors (beacon_minor, vendor_id, label, grid_x, grid_y)
SELECT m.beacon_minor, v.vendor_id, v.business_name, v.grid_x, v.grid_y
FROM (VALUES
    (1, 'a1000000-0000-0000-0000-000000000001'::uuid),
    (2, 'a1000000-0000-0000-0000-000000000002'::uuid),
    (3, 'a1000000-0000-0000-0000-000000000003'::uuid)
) AS m(beacon_minor, vendor_id)
JOIN vendors v ON v.vendor_id = m.vendor_id
ON CONFLICT (beacon_minor) DO NOTHING;

-- Food items — Vendor 1
INSERT INTO food_items (vendor_id, name, calories, price_in_points, protein_g, carbs_g, fat_g, is_available)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Ayam',      620, 8.00, 32, 65, 18, true),
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Telur',     480, 5.50, 18, 62, 14, true),
  ('a1000000-0000-0000-0000-000000000001', 'Nasi Lemak Ikan Bilis', 520, 6.00, 22, 68, 12, true);

-- Food items — Vendor 2
INSERT INTO food_items (vendor_id, name, calories, price_in_points, protein_g, carbs_g, fat_g, is_available)
VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Mee Goreng Udang',  580, 7.50, 28, 72, 16, true),
  ('a1000000-0000-0000-0000-000000000002', 'Mee Goreng Biasa',  520, 6.00, 18, 75, 12, true),
  ('a1000000-0000-0000-0000-000000000002', 'Kuey Teow Goreng',  560, 7.00, 20, 78, 14, true);

-- Food items — Vendor 3
INSERT INTO food_items (vendor_id, name, calories, price_in_points, protein_g, carbs_g, fat_g, is_available)
VALUES
  ('a1000000-0000-0000-0000-000000000003', 'Roti Canai', 310, 2.50, 8,  48,  8, true),
  ('a1000000-0000-0000-0000-000000000003', 'Roti Telur', 380, 3.50, 12, 52, 12, true),
  ('a1000000-0000-0000-0000-000000000003', 'Teh Tarik',  150, 2.00, 4,  28,  4, true),
  ('a1000000-0000-0000-0000-000000000003', 'Milo Ais',   180, 2.50, 5,  32,  4, true);

-- Kiosks
INSERT INTO kiosks (kiosk_id, label, grid_x, grid_y, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Main Entrance Kiosk', 0, 0, true),
  ('b2000000-0000-0000-0000-000000000002', 'Centre Kiosk',        3, 3, true)
ON CONFLICT (kiosk_id) DO NOTHING;

-- Campaigns
INSERT INTO campaigns (campaign_id, name, description, condition_type, condition_threshold, reward_value, is_active)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Jelajah Bazaar',  'Visit 3 different stalls to earn a voucher', 'VISIT_STALLS', 3,  5.00, true),
  ('c1000000-0000-0000-0000-000000000002', 'Selera Rakyat',   'Spend 20 points to earn a voucher',          'SPEND_POINTS', 20, 3.00, true)
ON CONFLICT (campaign_id) DO NOTHING;


-- ============================================================
-- DONE — verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- ============================================================
