-- ============================================================
-- Smart Night Market System — Database Schema
-- Version: 2.1
-- Run this entire file in the Supabase SQL editor before anything else.
-- ============================================================

-- ============================================================
-- PHASE 1 TABLES
-- ============================================================

-- 1. CARDS
-- Master record for each physical NFC card.
-- points_balance is the consumer's spendable currency.
-- calorie_limit is set by consumer — default 2000 kcal per day.
-- role determines portal access: CONSUMER or VENDOR.
CREATE TABLE cards (
    uid                 VARCHAR(20) PRIMARY KEY,
    owner_name          VARCHAR(100),
    owner_email         VARCHAR(255) UNIQUE,
    phone_number        VARCHAR(20),
    password_hash       VARCHAR(255),          -- bcrypt hash, set on registration
    points_balance      DECIMAL(10,2) DEFAULT 0,
    calorie_limit       INTEGER DEFAULT 2000,
    role                VARCHAR(20) DEFAULT 'CONSUMER'
                        CHECK (role IN ('CONSUMER', 'VENDOR')),
    registered_at       TIMESTAMPTZ DEFAULT NOW(),
    is_active           BOOLEAN DEFAULT TRUE
);

-- 2. VENDORS
-- One row per stall. Registered by vendor through the vendor portal.
-- terminal_mac_address links the physical ESP8266 to this vendor.
-- grid_x and grid_y position the stall on the market map (Phase 3).
CREATE TABLE vendors (
    vendor_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_card_uid          VARCHAR(20) REFERENCES cards(uid) ON DELETE SET NULL,
    terminal_mac_address    VARCHAR(17) UNIQUE,
    business_name           VARCHAR(100) NOT NULL,
    ssm_registration_number VARCHAR(50) UNIQUE,  -- Malaysia SSM business registration number
    phone_number            VARCHAR(20),
    category                VARCHAR(50),
    description             TEXT,
    grid_x                  INTEGER,
    grid_y                  INTEGER,
    is_active               BOOLEAN DEFAULT TRUE,
    registered_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FOOD_ITEMS
-- Vendor menu items. Each has its own calorie count and point price.
-- The terminal has one default food_id hardcoded per terminal.
-- photo_url stores uploaded image URL from Supabase Storage.
CREATE TABLE food_items (
    food_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    photo_url           TEXT,
    calories            INTEGER NOT NULL,
    price_in_points     DECIMAL(10,2) NOT NULL CHECK (price_in_points > 0),
    is_available        BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TAP_EVENTS
-- Immutable event log. One row per valid card tap.
-- ON DELETE RESTRICT prevents deletion of cards or vendors with tap history.
-- device_timestamp is from DS3231 RTC — informational only.
-- server_timestamp is set by Express on arrival — authoritative for all business logic.
-- synced_from_queue is TRUE for events that arrived via LittleFS batch sync.
-- metadata JSONB:
--   TAP_PURCHASE:     { food_id, food_name, calories, base_cost,
--                       voucher_applied, discount_applied, final_cost }
--   DIRECTORY_REBATE: { kiosk_id, points_added }
CREATE TABLE tap_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid            VARCHAR(20) REFERENCES cards(uid) ON DELETE RESTRICT,
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
    event_type          VARCHAR(50) NOT NULL
                        CHECK (event_type IN ('TAP_PURCHASE', 'DIRECTORY_REBATE')),
    device_timestamp    TIMESTAMPTZ NOT NULL,
    server_timestamp    TIMESTAMPTZ DEFAULT NOW(),
    synced_from_queue   BOOLEAN DEFAULT FALSE,
    metadata            JSONB
);

-- 5. POINTS_LOG
-- Immutable financial audit trail for every points movement.
-- delta is positive for top-ups and rewards, negative for purchases.
-- reference_id links to tap_event_id or voucher_id.
CREATE TABLE points_log (
    log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid        VARCHAR(20) REFERENCES cards(uid) ON DELETE RESTRICT,
    delta           DECIMAL(10,2) NOT NULL,
    reason          VARCHAR(50) NOT NULL
                    CHECK (reason IN ('TAP_PURCHASE', 'VOUCHER_DISCOUNT', 'TOPUP', 'CAMPAIGN_REWARD')),
    reference_id    UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHASE 2 TABLES
-- ============================================================

-- 6. CAMPAIGNS
-- Three condition types: VISIT_STALLS, SPEND_POINTS, DIRECTORY_REBATE.
-- applicable_vendor_ids: NULL = valid at all vendors; JSONB array = restricted vendors.
CREATE TABLE campaigns (
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

-- 7. CAMPAIGN_PROGRESS
-- Per-card progress toward each campaign threshold.
-- completed flips TRUE and voucher is issued when current_value >= condition_threshold.
CREATE TABLE campaign_progress (
    progress_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_uid        VARCHAR(20) REFERENCES cards(uid) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    current_value   DECIMAL(10,2) DEFAULT 0,
    completed       BOOLEAN DEFAULT FALSE,
    completed_at    TIMESTAMPTZ,
    UNIQUE (card_uid, campaign_id)
);

-- 8. VOUCHERS
-- Issued automatically when campaign_progress.completed flips TRUE.
-- discount_value deducted from tap cost at next qualifying purchase.
-- final_cost on tap = MAX(0, base_cost - discount_value).
CREATE TABLE vouchers (
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

-- ============================================================
-- PHASE 3 TABLES
-- ============================================================

-- 9. KIOSKS
-- Registry of physical digital directory kiosk units.
-- Each kiosk has a fixed grid position in the market.
-- Consumer kiosk tap seeds their grid position into the React session (not persisted on card).
CREATE TABLE kiosks (
    kiosk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label           VARCHAR(50) NOT NULL,
    grid_x          INTEGER NOT NULL,
    grid_y          INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE
);

-- 10. SUBSIDY_CLAIMS
-- Written only when a vendor submits a finalised claim.
-- total_amount is calculated from vouchers.used_at within the period — NOT from the view.
CREATE TABLE subsidy_claims (
    claim_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE RESTRICT,
    total_amount        DECIMAL(10,2) NOT NULL,
    claim_period_start  TIMESTAMPTZ NOT NULL,
    claim_period_end    TIMESTAMPTZ NOT NULL,
    status              VARCHAR(30) DEFAULT 'PENDING_AUDIT'
                        CHECK (status IN ('PENDING_AUDIT', 'APPROVED', 'PAID')),
    generated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX ON tap_events(card_uid, server_timestamp);
CREATE INDEX ON tap_events(vendor_id);
CREATE INDEX ON tap_events(device_timestamp);
CREATE INDEX ON campaign_progress(card_uid);
CREATE INDEX ON vouchers(card_uid, status);
CREATE INDEX ON points_log(card_uid, created_at);

-- ============================================================
-- VIEWS
-- ============================================================

-- subsidy_summary: live all-time totals. Use for dashboard display ONLY.
-- Do NOT use for claim generation — query vouchers.used_at for period accuracy.
CREATE VIEW subsidy_summary AS
SELECT
    v.vendor_id,
    v.business_name,
    c.campaign_id,
    c.name                  AS campaign_name,
    c.reward_value          AS subsidy_per_redemption,
    COUNT(vou.voucher_id)   AS total_redemptions,
    (COUNT(vou.voucher_id) * c.reward_value) AS total_subsidy_owed
FROM vouchers vou
JOIN campaigns c   ON vou.campaign_id      = c.campaign_id
JOIN vendors v     ON vou.used_at_vendor_id = v.vendor_id
WHERE vou.status = 'USED'
GROUP BY v.vendor_id, v.business_name, c.campaign_id, c.name, c.reward_value;
