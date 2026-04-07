# MASTER.md — Smart Night Market System
# Claude Code Project Brief — Version 2.3

This document is the single source of truth for the Smart Night Market System.
Read this entire file before writing any code. All architectural decisions are final.
Do not deviate from the stack, schema, or API contracts defined here.
If a decision is not specified, ask before assuming.

---

## 0. READING GUIDE

Build in this exact order:

1. Database — create schema in Supabase first
2. Backend API — build and test all routes before touching frontend
3. Frontend Phase 1 — points, tap, calories, vendor registration
4. Frontend Phase 2 — campaigns, vouchers
5. Frontend Phase 3 — grid map, vendor portal
6. Firmware — Arduino + ESP8266 last

---

---

# SECTION 1 — README

## What This Is

A unified night market platform with three physical surfaces and one cloud backend.
Consumers use a physical NFC card to tap at vendor stalls, spend points, track calories,
and earn campaign vouchers. Vendors register their business, upload food items,
participate in campaigns, and claim government subsidies.
There is no functional payment gateway in this prototype.
The prepaid top-up flow is UI-only — points balance is adjusted directly.

## User Roles

| Role | Interface | Primary Actions |
|---|---|---|
| Consumer | Website, Kiosk | Register card, top up points (UI only), activate campaigns, view calories, view map, redeem vouchers |
| Vendor | Web app | Register business, upload food items, set prices, join campaigns, view subsidy dashboard |
| Guest | Website | Browse vendors and map only — no NFC features |

## Registration Flows

### Consumer Registration (apps/web → /register)

```
1. User visits /register on the consumer web app
2. Fills form:
   - Card UID (printed on NFC card)
   - Full Name (as per IC)
   - Email Address
   - Phone Number (Malaysian mobile, e.g. 01X-XXXXXXX)
   - Password (min 8 characters)
   - Confirm Password
3. Frontend validates: passwords match, min length
4. POST /api/cards/register
   → password is bcrypt-hashed (10 rounds) server-side before storage
   → password_hash is NEVER returned in any API response
5. On success: auto sign-in via POST /api/auth/consumer/login
6. Redirects to /dashboard with card session active
7. On duplicate UID: error "Card already registered — sign in instead"
```

**Sign-in flow (/ Landing page):**
```
1. User enters Email + Password (NOT Card UID — changed in v2.3)
2. POST /api/auth/consumer/login → bcrypt.compare (looks up by owner_email)
3. On success: uid stored in localStorage → GET /api/cards/:uid for full profile
4. Redirects to /dashboard
5. Session persists across page refreshes (uid in localStorage, no re-auth on reload)
```

---

### Vendor Registration (apps/vendor → /register → /onboarding)

> Note: /register page has a Consumer/Vendor slide toggle at the top. Vendor mode reveals additional Business Information fields on the same form.

**Step 1 — Account creation (/register):**
```
1. Vendor visits /register on the vendor portal
2. Fills form:
   - Card UID (vendor NFC card)
   - Full Name (as per IC / Passport)
   - Email Address
   - Phone Number (Malaysian mobile)
   - Password (min 8 characters)
   - Confirm Password
3. POST /api/cards/register (same endpoint as consumer — role starts as CONSUMER)
4. On success: auto sign-in → redirects to /onboarding
```

**Step 2 — Business registration (/onboarding):**
```
1. Vendor fills stall details:
   - Business Name
   - SSM Registration Number (Malaysia ROB / ROC format, e.g. 001234567-X)
     → Validated as unique — duplicate SSM returns 409 SSM_ALREADY_REGISTERED
   - Business Phone Number
   - Category (optional, e.g. Nasi Lemak, Satay)
   - Description (optional)
   - Grid Position X/Y (optional — can be set by admin later)
2. POST /api/vendors/register
   → card role upgraded to VENDOR in cards table
3. On success: vendor_id stored in localStorage → redirects to /menu
```

**Sign-in flow (/ Login page):**
```
1. Vendor enters Card UID + Password
2. POST /api/auth/vendor/login → bcrypt.compare → checks role = VENDOR
3. Returns card profile + vendor_id + business_name
4. If role is CONSUMER (stall not registered): error "Complete stall registration first"
5. Session persists across page refreshes
```

---

### SSM Registration Number Format (Malaysia)
- **ROB (Registration of Businesses Act 1956)** — Sole Proprietorship / Partnership:
  Format: `XXXXXXXXX-X` e.g. `001234567-A` or `SA0012345-T`
- **ROC (Companies Act 2016)** — Sdn Bhd / Bhd:
  Format: `XXXXXXX-X` e.g. `1234567-A`
- Field is stored as VARCHAR(50), unique constraint enforced at DB level
- No regex enforcement at API layer — format varies; uniqueness is the enforced invariant

---

## Three Physical Surfaces

| Surface | Hardware | Purpose |
|---|---|---|
| Consumer website | Any browser | Card registration, points top-up UI, campaign tracking, calorie dashboard |
| Digital directory kiosk | Raspberry Pi 4 + PN532 + LCD | Tap card to check balance, activate campaigns, get location path to vendor |
| Vendor terminal | Arduino UNO R3 + ESP8266 + PN532 | Consumer taps to purchase — deducts points, logs calories, redeems vouchers |

## Build Phases

### Phase 1 — Core
- Points balance on card
- Food items per vendor with point price and calories
- POST /api/tap — deduct points, log calories, check calorie limit
- Consumer dashboard — balance, calories today, tap history
- Vendor registration and food item upload

### Phase 2 — Campaigns
- Campaign engine — three condition types
- Campaign progress tracking per card
- Voucher issuance on campaign completion
- Voucher discount applied on tap
- Digital directory rebate tap

### Phase 3 — Map and Portal
- Grid-based vendor map
- Vendor picks grid position in app
- Consumer locates themselves via kiosk tap
- Pathfinding highlight between consumer and vendor on grid
- Full vendor portal — subsidy claims, sales summary

## Repository Structure

```
nightmarket/
├── apps/
│   ├── web/                        # Consumer website — React + TypeScript + Vite
│   │   └── src/
│   │       ├── context/CardContext.tsx
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── Landing.tsx         # Sign-in (email + password)
│   │           ├── Register.tsx        # Consumer/Vendor toggle + registration
│   │           ├── Dashboard.tsx       # Points, top-up, calories, history
│   │           ├── Calories.tsx        # Macro breakdown, BMR, limit adjust
│   │           ├── Campaigns.tsx       # Programs, vouchers collected, enrol
│   │           ├── Vendors.tsx         # Search, menu with macros + photos
│   │           ├── Map.tsx             # Interactive grid map
│   │           ├── NfcConnect.tsx      # Card status, points, promotions, taps
│   │           └── Settings.tsx        # Profile, sign out
│   ├── kiosk/                      # Kiosk UI — React + TypeScript + Vite (runs on Pi)
│   └── vendor/                     # Vendor portal — React + TypeScript + Vite
│       └── src/
│           ├── context/VendorContext.tsx
│           ├── lib/api.ts
│           └── pages/
│               ├── Login.tsx           # Sign-in (UID + password)
│               ├── Register.tsx        # Step 1 — card account creation
│               ├── Onboarding.tsx      # Step 2 — business + SSM registration
│               ├── Home.tsx            # Dashboard — subsidies, quick actions
│               ├── Information.tsx     # Stall map + food items + macros + photos
│               ├── VendorCampaigns.tsx # Campaign list + enrol button
│               ├── Summary.tsx         # Subsidy breakdown
│               ├── Claim.tsx           # Submit subsidy claims
│               └── Settings.tsx        # Profile, sign out (no switch portal)
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts             # POST /api/auth/consumer/login + /vendor/login
│   │   │   ├── cards.ts
│   │   │   ├── tap.ts
│   │   │   ├── vendors.ts
│   │   │   ├── campaigns.ts
│   │   │   └── map.ts
│   │   ├── middleware/
│   │   │   ├── validate.ts         # Zod middleware wrapper
│   │   │   └── errors.ts           # Centralised error handler
│   │   └── lib/
│   │       └── supabase.ts         # Supabase client (service role)
│   ├── nixpacks.toml               # Railway build configuration
│   └── package.json
├── database/
│   ├── schema.sql                  # Full schema — run first in Supabase
│   ├── seed.sql                    # Sample vendors, food items, campaigns
│   └── migrations/
│       ├── 001_add_auth_fields.sql # phone_number, password_hash, SSM columns
│       └── 002_add_macros.sql      # protein_g, carbs_g, fat_g on food_items
├── firmware/
│   └── vendor-terminal/
│       └── src/
│           ├── main.cpp            # Arduino UNO R3 main logic
│           └── wifi_bridge/
│               └── wifi_bridge.ino # ESP8266 UART-to-HTTP bridge
├── daemon/                         # Python NFC daemon for Raspberry Pi kiosk
│   └── nfc_daemon.py
└── MASTER_v2_refined.md
```

## Environment Variables

```bash
# backend/.env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3000

# apps/web/.env
VITE_API_URL=https://claudeproject-production-5b22.up.railway.app

# apps/kiosk/.env
VITE_API_URL=http://localhost:3000
VITE_NFC_DAEMON_URL=http://localhost:5001
VITE_KIOSK_ID=uuid-of-this-kiosk-unit

# apps/vendor/.env
VITE_API_URL=https://claudeproject-production-5b22.up.railway.app
```

## Setup Order

1. Create Supabase project
2. Run database/schema.sql in Supabase SQL editor
3. Run database/seed.sql for development data
4. Deploy backend to Railway:
   - Connect GitHub repo → set Root Directory to `backend`
   - Add env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT=3000
   - nixpacks.toml handles build automatically (installs devDeps, runs tsc via node)
   - Generate domain → copy Railway URL for step 5
5. Deploy web and vendor apps to Vercel:
   - Set VITE_API_URL to Railway URL from step 4
6. Run kiosk app locally on Raspberry Pi
7. Run Python NFC daemon on Raspberry Pi
8. Flash firmware to Arduino + ESP8266

---

---

# SECTION 2 — ARCHITECTURE

## Stack — Final

| Layer | Technology | Hosting |
|---|---|---|
| Consumer website | React + TypeScript + Vite + TailwindCSS | Vercel |
| Kiosk UI | React + TypeScript + Vite + TailwindCSS | Local on Raspberry Pi 4 |
| Vendor portal | React + TypeScript + Vite + TailwindCSS | Vercel |
| Backend API | Node.js + Express + TypeScript | Railway |
| Payload validation | Zod — at Express middleware layer | In Express |
| Database | PostgreSQL | Supabase |
| Auth (future) | Supabase Auth | Supabase |

## Why Express Middleware Is Retained

The API key must never leave the server. ESP8266 firmware is extractable —
if the Supabase service key were embedded in firmware, the entire database
would be exposed. Express keeps the key server-side only.
All hardware communicates with Express. Express communicates with Supabase.

## Hardware Nodes

### Vendor Terminal
- Arduino UNO R3 — main controller (2KB SRAM — keep all JSON minimal)
- PN532 NFC reader — connected via I2C to Arduino
- DS3231 RTC module — connected via I2C to Arduino (mandatory)
- E-paper display — connected to Arduino
- ESP8266 WiFi module — connected to Arduino via UART at 115200 baud

### Digital Directory Kiosk
- Raspberry Pi 4
- PN532 NFC reader via SPI or I2C
- LCD touchscreen display
- Always online — no offline queue needed

### NFC Cards
- NTAG215 — UID only stored on card
- All data (points, calories, vouchers) lives in the database
- Card UID is the lookup key for all backend operations

## Edge Architecture — Two Paths

### Path A — Vendor Terminal (Arduino + ESP8266)

```
Consumer taps NFC card on PN532
→ Arduino reads UID as hex string
→ Arduino reads ISO 8601 timestamp from DS3231 (MYT local time, UTC+8)
→ Arduino builds minimal JSON string via ArduinoJson (under 200 bytes)
→ Arduino sends JSON over UART to ESP8266
→ ESP8266 receives string, sends HTTPS POST to Express /api/tap
→ If WiFi down: ESP8266 appends event as NDJSON line to LittleFS /queue.ndjson
→ On reconnect: ESP8266 batch POSTs queue to /api/tap/sync
→ Express returns JSON result
→ ESP8266 sends result string back to Arduino via UART
→ Arduino displays result on e-paper
```

RAM constraint: Arduino UNO R3 has 2KB SRAM.
Keep JSON payload under 200 bytes. Use StaticJsonDocument with fixed size.
Do not use String class on Arduino — use char arrays only.

### Path B — Digital Directory Kiosk (Raspberry Pi)

```
Consumer taps NFC card on PN532
→ Python Flask daemon reads UID, exposes on localhost:5001
→ React kiosk app polls localhost:5001/nfc every 500ms
→ On UID detected: React calls POST /api/kiosk/tap (logs DIRECTORY_REBATE event)
→ React calls GET /api/cards/:uid for dashboard data
→ Returns card summary, active vouchers, nearby vendor locations
→ Consumer can activate campaigns from Panel 3
```

Python daemon never calls the cloud API directly.
React kiosk app owns the session and the API calls.

## Data Transit Protocol

1. Hardware to RAM: UID as C++ char array (Arduino) or Python string (Pi)
2. RAM to JSON: ArduinoJson serialises to UTF-8 JSON string
3. Network: HTTPS POST — UTF-8 bytes over TCP/IP. Network sees text only
4. Express: express.json() parses to JS object. Zod validates. Invalid returns HTTP 400
5. Supabase: Supabase JS client maps JS types to PostgreSQL types
6. Response: PostgreSQL rows to Express to JSON to React to DOM

## Timestamp Protocol

| Field | Source | Purpose |
|---|---|---|
| device_timestamp | DS3231 RTC on Arduino — ISO 8601 string (MYT UTC+8) | Event ordering for offline queue replay only |
| server_timestamp | Express — new Date() on arrival | Authoritative for all audits and business logic |

Server never trusts device_timestamp for business logic.
Drift between the two flags RTC desync or terminal tampering.

Duplicate tap check:
- Live taps: use server_timestamp::date = today
- Synced taps (synced_from_queue = true): use device_timestamp::date = device_timestamp::date
  This reflects the actual calendar day the tap occurred, not the sync arrival day.

## Payment Relationship — Prototype Only

Points represent prepaid monetary value. In the prototype, top-up is UI-only.
The relationship is: user initiates top-up in UI, points_balance increases,
points_log records a TOPUP entry.
A real payment gateway inserts at the top-up step only.
No other part of the schema changes when payment is added.

---

---

# SECTION 3 — DATABASE

## Platform
PostgreSQL on Supabase. Run schema.sql first, then seed.sql.

## Table Overview — 10 Tables

| Table | Phase | Purpose |
|---|---|---|
| cards | 1 | NFC card master record with points balance and calorie limit |
| vendors | 1 | Vendor business profile and terminal hardware mapping |
| food_items | 1 | Vendor menu — food name, calories, price in points |
| tap_events | 1 | Immutable log of every card tap |
| points_log | 1 | Immutable financial audit trail of every points movement |
| campaigns | 2 | Campaign definitions with condition type and reward |
| campaign_progress | 2 | Per-card progress toward each campaign threshold |
| vouchers | 2 | Issued vouchers — discount applied on next qualifying tap |
| kiosks | 3 | Digital directory registry with fixed grid positions |
| subsidy_claims | 3 | Finalised government subsidy claim records |

Plus one view: subsidy_summary (live calculation — never stale)

## Full Schema SQL

```sql
-- ============================================================
-- PHASE 1 TABLES
-- ============================================================

-- 1. CARDS
-- Master record for each physical NFC card.
-- points_balance is the consumer's spendable currency.
-- calorie_limit is set by consumer — default 2000 kcal per session.
-- role determines portal access: CONSUMER or VENDOR.
-- password_hash: bcrypt(password, 10) — NEVER returned in any API response.
-- phone_number: Malaysian mobile number (01X-XXXXXXX format).
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
-- grid_x and grid_y position the stall on the market map.
-- ssm_registration_number: Malaysia SSM ROB/ROC number — unique, required.
-- phone_number: business contact number.
CREATE TABLE vendors (
    vendor_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_card_uid          VARCHAR(20) REFERENCES cards(uid) ON DELETE SET NULL,
    terminal_mac_address    VARCHAR(17) UNIQUE,
    business_name           VARCHAR(100) NOT NULL,
    ssm_registration_number VARCHAR(50) UNIQUE,  -- Malaysia SSM ROB/ROC number
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
-- Replaces calories_per_serving on vendors — vendors can have multiple items.
-- photo_url stores uploaded image URL from Supabase Storage.
-- protein_g, carbs_g, fat_g added in migration 002_add_macros.sql (optional, default 0).
-- The terminal has one default food_id hardcoded per terminal.
-- If a vendor has one item, all taps use it. Multiple items require kiosk selection.
CREATE TABLE food_items (
    food_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id           UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    photo_url           TEXT,
    calories            INTEGER NOT NULL,
    price_in_points     DECIMAL(10,2) NOT NULL,
    protein_g           NUMERIC(6,2) DEFAULT 0,   -- added in migration 002
    carbs_g             NUMERIC(6,2) DEFAULT 0,   -- added in migration 002
    fat_g               NUMERIC(6,2) DEFAULT 0,   -- added in migration 002
    is_available        BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TAP_EVENTS
-- Immutable event log. One row per valid card tap.
-- ON DELETE RESTRICT prevents deletion of cards or vendors with tap history.
-- device_timestamp is from DS3231 RTC — informational only.
-- server_timestamp is set by Express — authoritative for all business logic.
-- synced_from_queue is TRUE for events that arrived via LittleFS batch sync.
-- metadata JSONB payload:
--   TAP_PURCHASE:     { "food_id": "uuid", "food_name": "Nasi Lemak",
--                       "calories": 560, "base_cost": 5.00,
--                       "voucher_applied": "uuid or null",
--                       "discount_applied": 1.50, "final_cost": 3.50 }
--   DIRECTORY_REBATE: { "kiosk_id": "uuid", "points_added": 2.00 }
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
-- reference_id links to the relevant tap_event_id or voucher_id.
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
-- Defines available campaigns. Three condition types supported.
-- condition_threshold: number to reach (e.g. 3 stalls, 20 points spent, 1 kiosk tap).
-- reward_value: points discount the issued voucher will apply to next tap.
-- applicable_vendor_ids: NULL means valid at all vendors,
--   JSONB array of vendor UUIDs restricts where the voucher can be used.
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
-- Tracks each card's progress toward completing each campaign.
-- current_value increments on qualifying events.
-- completed flips TRUE and voucher issued when current_value >= condition_threshold.
-- UNIQUE constraint prevents duplicate progress rows.
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
-- discount_value is deducted from tap cost at next qualifying purchase.
-- applicable_vendor_ids mirrors campaign setting.
-- status: ACTIVE (usable), USED (consumed on tap), EXPIRED (past expires_at).
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
-- Registry of physical digital directory units.
-- Each kiosk has a fixed grid position in the market.
-- When consumer taps at a kiosk, their position on the map is seeded
-- to the session (not persisted on card — session only).
CREATE TABLE kiosks (
    kiosk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label           VARCHAR(50) NOT NULL,
    grid_x          INTEGER NOT NULL,
    grid_y          INTEGER NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE
);

-- 10. SUBSIDY_CLAIMS
-- Written only when a vendor submits a finalised claim for government reimbursement.
-- total_amount is calculated from vouchers used within the claim period — NOT from the view.
-- status: PENDING_AUDIT → APPROVED → PAID
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
-- INDEXES — required for performance on hot query paths
-- ============================================================
CREATE INDEX ON tap_events(card_uid, server_timestamp);
CREATE INDEX ON tap_events(vendor_id);
CREATE INDEX ON tap_events(device_timestamp);
CREATE INDEX ON campaign_progress(card_uid);
CREATE INDEX ON vouchers(card_uid, status);

-- ============================================================
-- VIEWS
-- ============================================================

-- subsidy_summary: live all-time calculation. Use for vendor dashboard display ONLY.
-- Do NOT use for claim generation — claims must query vouchers for period accuracy.
CREATE VIEW subsidy_summary AS
SELECT
    v.vendor_id,
    v.business_name,
    c.campaign_id,
    c.name AS campaign_name,
    c.reward_value AS subsidy_per_redemption,
    COUNT(vou.voucher_id) AS total_redemptions,
    (COUNT(vou.voucher_id) * c.reward_value) AS total_subsidy_owed
FROM vouchers vou
JOIN campaigns c ON vou.campaign_id = c.campaign_id
JOIN vendors v ON vou.used_at_vendor_id = v.vendor_id
WHERE vou.status = 'USED'
GROUP BY v.vendor_id, v.business_name, c.campaign_id, c.name, c.reward_value;
```

## Enum Reference

```
cards.role:
  CONSUMER            — website and kiosk access
  VENDOR              — vendor portal access plus consumer features

tap_events.event_type:
  TAP_PURCHASE        — food purchase at vendor stall
  DIRECTORY_REBATE    — instant rebate claimed at kiosk

points_log.reason:
  TAP_PURCHASE        — negative delta — points spent on food
  VOUCHER_DISCOUNT    — positive delta — points saved by voucher
  TOPUP               — positive delta — prepaid top-up (UI only)
  CAMPAIGN_REWARD     — positive delta — direct points reward from campaign

campaigns.condition_type:
  VISIT_STALLS        — threshold = distinct vendor stalls to tap
  SPEND_POINTS        — threshold = total points spent in campaign period
  DIRECTORY_REBATE    — threshold = 1, single kiosk tap triggers instant reward

vouchers.status:
  ACTIVE              — issued and usable
  USED                — consumed at a tap purchase
  EXPIRED             — expires_at passed without use

subsidy_claims.status:
  PENDING_AUDIT       — submitted, awaiting government review
  APPROVED            — approved, payment pending
  PAID                — payment received
```

## Constraints to Enforce in API

- points_balance must never go below 0 — check before deducting
- Duplicate tap:
  - Live taps: card_uid + vendor_id + server_timestamp::date = today → reject 409
  - Synced taps: card_uid + vendor_id + device_timestamp::date = device_timestamp::date → reject 409
- Voucher applicable check: applicable_vendor_ids IS NULL or contains current vendor_id
- campaign_progress UNIQUE (card_uid, campaign_id) enforced at DB level
- tap_events and subsidy_claims use ON DELETE RESTRICT
- food_items.price_in_points must be greater than 0
- final_cost on tap must never be negative (minimum 0)

---

---

# SECTION 4 — API

## Base URL
Development: http://localhost:3000
Production: https://your-app.up.railway.app

## All routes prefixed /api

## Middleware on All Routes
- express.json()
- CORS — allow Vercel origins and localhost
- Zod validation per route via validate middleware wrapper

## Vendor Route Authentication
Routes under /api/vendors/:id that modify or expose sensitive data require an
`x-card-uid` header containing a card UID with role = VENDOR that owns this vendor.
Return 403 if missing, wrong role, or card does not own this vendor_id.
This is a prototype-level guard — replace with Supabase Auth before production.

Affected routes: POST /api/vendors/:id/food, GET /api/vendors/:id/summary,
POST /api/vendors/:id/claim, GET /api/vendors/:id/claims.

## Standard Response Shape

```json
{ "success": true, "data": { } }
{ "success": false, "error": "ERROR_CODE", "message": "Human readable" }
```

## Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| INVALID_PAYLOAD | 400 | Zod validation failed |
| CARD_NOT_FOUND | 404 | UID not in cards table |
| CARD_INACTIVE | 403 | cards.is_active is false |
| CARD_ALREADY_REGISTERED | 409 | UID already exists in cards table |
| VENDOR_NOT_FOUND | 404 | vendor_id not in vendors |
| FOOD_NOT_FOUND | 404 | food_id not in food_items |
| DUPLICATE_TAP | 409 | Same card + vendor tapped on same calendar day |
| INSUFFICIENT_POINTS | 402 | points_balance less than final_cost |
| VOUCHER_INVALID | 400 | Voucher not ACTIVE or wrong vendor |
| CAMPAIGN_NOT_FOUND | 404 | campaign_id not found |
| ALREADY_COMPLETED | 409 | Campaign already completed by this card |
| UNAUTHORIZED | 403 | x-card-uid header missing, wrong role, or not vendor owner |
| INVALID_CREDENTIALS | 401 | Wrong UID or password on login |
| NO_PASSWORD_SET | 401 | Card exists but has no password (registered before auth was added) |
| NOT_A_VENDOR | 403 | Card role is CONSUMER — stall registration not completed |
| ACCOUNT_DISABLED | 403 | cards.is_active is false |
| SSM_ALREADY_REGISTERED | 409 | SSM number already in use by another vendor |

---

## Auth Routes

### POST /api/auth/consumer/login
Authenticate a consumer with UID + password.
Body: `{ "uid": "04:A3:2F:B1", "password": "mypassword" }`
Logic: Fetch card → bcrypt.compare(password, password_hash) → return profile.
password_hash is NEVER included in the response.
Response data: `{ uid, owner_name, owner_email, phone_number, points_balance, calorie_limit, role, is_active }`
Errors: INVALID_CREDENTIALS, ACCOUNT_DISABLED, NO_PASSWORD_SET

---

### POST /api/auth/vendor/login
Authenticate a vendor with UID + password. Requires role = VENDOR.
Body: `{ "uid": "04:V3:ND:01", "password": "mypassword" }`
Logic: Fetch card → bcrypt.compare → check role = VENDOR → fetch linked vendor.
Response data: `{ uid, owner_name, owner_email, phone_number, role, vendor_id, business_name }`
Errors: INVALID_CREDENTIALS, ACCOUNT_DISABLED, NO_PASSWORD_SET, NOT_A_VENDOR

---

## Phase 1 Routes

### POST /api/cards/register
Register new NFC card with password.
Body:
```json
{
  "uid": "04:A3:2F:B1",
  "owner_name": "Ahmad",
  "owner_email": "ahmad@email.com",
  "phone_number": "0123456789",
  "password": "min8chars"
}
```
Logic: Check uid not already registered → bcrypt.hash(password, 10) → insert into cards with role = CONSUMER.
Returns card profile (no password_hash).
Errors: CARD_ALREADY_REGISTERED

---

### GET /api/cards/:uid
Card profile — balance, calories today, checkpoints, active vouchers.

Response data:
```json
{
  "uid": "04:A3:2F:B1",
  "owner_name": "Ahmad",
  "points_balance": 45.50,
  "calorie_limit": 2000,
  "calories_today": 890,
  "checkpoints_today": ["vendor-uuid-1", "vendor-uuid-3"],
  "active_vouchers": [
    {
      "voucher_id": "uuid",
      "discount_value": 3.00,
      "applicable_vendor_ids": null,
      "expires_at": "2024-12-31T23:59:59+08:00"
    }
  ]
}
```

---

### GET /api/cards/:uid/history
Paginated full tap history for a card.
Query params: `limit` (default 50, max 200), `offset` (default 0)

Response data:
```json
{
  "uid": "04:A3:2F:B1",
  "total": 142,
  "limit": 50,
  "offset": 0,
  "history": [
    {
      "event_id": "uuid",
      "vendor_name": "Mak Cik Nasi",
      "event_type": "TAP_PURCHASE",
      "food_name": "Nasi Lemak",
      "calories": 560,
      "final_cost": 3.50,
      "server_timestamp": "2024-03-31T14:22:09+08:00"
    }
  ]
}
```

---

### PATCH /api/cards/:uid/calorie-limit
Body: `{ "calorie_limit": 1800 }`
Update consumer's daily calorie limit.

---

### POST /api/cards/:uid/topup
UI-only top-up. No payment gateway.
Body: `{ "amount": 10.00 }`
Logic: Increment points_balance, write points_log TOPUP row.

---

### GET /api/vendors
All active vendors with grid positions and food item count.

---

### POST /api/vendors/register
Body:
```json
{
  "owner_card_uid": "04:V3:ND:01",
  "business_name": "Mak Cik Nasi Lemak",
  "ssm_registration_number": "001234567-A",
  "phone_number": "0123456789",
  "category": "Nasi Lemak",
  "description": "Optional stall description",
  "grid_x": 3,
  "grid_y": 5,
  "terminal_mac_address": "AA:BB:CC:DD:EE:FF"
}
```
Logic: Verify card exists → check SSM not already taken → update card role to VENDOR → insert vendor row.
Errors: CARD_NOT_FOUND, SSM_ALREADY_REGISTERED

---

### GET /api/vendors/:id/food
All food items for a vendor.

---

### POST /api/vendors/:id/food
Add food item. Requires x-card-uid header (vendor owner).
Body: `{ "name", "calories", "price_in_points", "photo_url" }`

---

### POST /api/tap
Core atomic handler. Build and fully test this before any other route.

**Food item selection on hardware terminal:**
The Arduino firmware has one `FOOD_ID` hardcoded per terminal (the vendor's default item).
If a vendor has only one item, all taps use it automatically.
If a vendor has multiple items, the consumer selects at the kiosk before visiting the stall —
the kiosk session stores the chosen food_id for the next tap (session only, not on card).
For hardware terminal taps, the hardcoded FOOD_ID is always used.

Request body:
```json
{
  "card_uid": "04:A3:2F:B1",
  "vendor_id": "uuid",
  "food_id": "uuid",
  "device_timestamp": "2024-03-31T14:22:09+08:00",
  "synced_from_queue": false
}
```

Atomic sequence:
```
1.  Validate with Zod → 400 if invalid
2.  Fetch card → 404 if missing, 403 if inactive
3.  Fetch vendor → 404 if missing
4.  Fetch food_item → 404 if missing, verify belongs to this vendor
5.  Check duplicate tap:
      If synced_from_queue = false: card_uid + vendor_id + server_timestamp::date = today → 409
      If synced_from_queue = true:  card_uid + vendor_id + device_timestamp::date = device_timestamp::date → 409
6.  Set server_timestamp = new Date()
7.  base_cost = food_item.price_in_points
8.  Find active voucher for this card valid at this vendor
      If found: discount_applied = voucher.discount_value
                final_cost = MAX(0, base_cost - discount_applied)
      If not:   discount_applied = 0, final_cost = base_cost
9.  Check points_balance >= final_cost → 402 if not
10. DB transaction (atomic — rollback all on failure):
      a. Decrement cards.points_balance by final_cost
      b. If voucher: update status USED, set used_at + used_at_vendor_id
      c. Insert tap_events row with full metadata
      d. Insert points_log: delta = -final_cost, reason = TAP_PURCHASE
      e. If voucher: insert points_log: delta = +discount_applied, reason = VOUCHER_DISCOUNT
11. Update campaign progress (outside main transaction — failure does not roll back tap):
      For VISIT_STALLS: increment if this vendor not yet visited today
      For SPEND_POINTS: increment by final_cost
      If threshold met and not yet completed: flip completed, issue voucher
12. Check calorie warning:
      Sum calories today + food_item.calories
      If >= calorie_limit: calorie_warning = true
13. Return response
```

Response data:
```json
{
  "event_id": "uuid",
  "food_name": "Nasi Lemak",
  "base_cost": 5.00,
  "discount_applied": 1.50,
  "final_cost": 3.50,
  "points_balance_remaining": 42.00,
  "calories_added": 560,
  "calories_today": 1450,
  "calorie_limit": 2000,
  "calorie_warning": false,
  "voucher_applied": "uuid or null",
  "campaign_completed": "campaign name or null",
  "voucher_issued": "uuid or null",
  "server_timestamp": "2024-03-31T14:22:09+08:00"
}
```

---

### POST /api/tap/sync
Batch sync for ESP8266 offline LittleFS queue.

Body:
```json
{
  "terminal_mac": "AA:BB:CC:DD:EE:FF",
  "events": [
    { "card_uid": "...", "food_id": "uuid", "device_timestamp": "..." }
  ]
}
```

Logic:
- Resolve vendor_id from terminal_mac_address — return 404 if not found
- Inject resolved vendor_id into each event object
- Sort events by device_timestamp ascending
- Process each event through tap logic with synced_from_queue = true
- Duplicate check uses device_timestamp::date for all events in batch
- Duplicates skipped silently, not rejected

Return: `{ "processed": N, "skipped": N }`

---

## Phase 2 Routes

### GET /api/campaigns
All active campaigns. If query param `card_uid` provided, include progress for that card.

### POST /api/campaigns/:id/enrol
Enrol card in campaign.
Body: `{ "card_uid": "..." }`
Creates campaign_progress row with current_value 0.

### POST /api/kiosk/tap
Directory rebate tap at physical kiosk. Called by kiosk React app on card scan.

Body: `{ "card_uid": "...", "kiosk_id": "uuid", "device_timestamp": "..." }`

Logic:
- Fetch card — 404 if missing, 403 if inactive
- Fetch kiosk — 404 if missing
- Insert tap_events row with event_type = DIRECTORY_REBATE and metadata: { kiosk_id, points_added }
- Find active DIRECTORY_REBATE campaign — if card is enrolled and not yet completed:
  flip completed, issue voucher, write points_log CAMPAIGN_REWARD row, increment points_balance
- Return card summary + kiosk grid position for map seeding

Response includes:
```json
{
  "card_uid": "...",
  "points_balance": 47.50,
  "kiosk_grid": { "x": 3, "y": 2 },
  "campaign_completed": "campaign name or null",
  "voucher_issued": "uuid or null"
}
```

### GET /api/cards/:uid/vouchers
All vouchers for a card. Filter by `status` query param.

---

## Phase 3 Routes

### GET /api/map
Full grid data — all vendors and kiosks with positions.
Response: `{ "grid_size": { "cols": 10, "rows": 8 }, "vendors": [...], "kiosks": [...] }`

### GET /api/vendors/:id/summary
All-time subsidy summary from live view. Requires x-card-uid header (vendor owner).

Response data:
```json
{
  "vendor_id": "uuid",
  "business_name": "Mak Cik Nasi",
  "campaigns": [
    {
      "campaign_id": "uuid",
      "campaign_name": "Visit 3 Stalls",
      "subsidy_per_redemption": 3.50,
      "total_redemptions": 42,
      "total_subsidy_owed": 147.00
    }
  ],
  "grand_total_subsidy": 147.00
}
```

Note: Shows all-time totals. For period-specific amounts, use POST /api/vendors/:id/claim.

### POST /api/vendors/:id/claim
Submit finalised subsidy claim. Requires x-card-uid header (vendor owner).
Body: `{ "claim_period_start": "...", "claim_period_end": "..." }`

Logic:
- Query vouchers WHERE used_at_vendor_id = vendor_id AND status = 'USED'
  AND used_at BETWEEN claim_period_start AND claim_period_end
- Join to campaigns to get reward_value per voucher
- Calculate total_amount = sum of reward_value across all matched vouchers
- Insert into subsidy_claims with status PENDING_AUDIT
- Return created claim record

Note: total_amount is derived from vouchers (not the subsidy_summary view) to
accurately reflect only redemptions within the specified claim period.

### GET /api/vendors/:id/claims
All past subsidy claims for a vendor, ordered newest first.
Requires x-card-uid header (vendor owner).

Response data:
```json
[
  {
    "claim_id": "uuid",
    "vendor_id": "uuid",
    "total_amount": 147.00,
    "claim_period_start": "2024-03-01T00:00:00+08:00",
    "claim_period_end": "2024-03-31T23:59:59+08:00",
    "status": "PENDING_AUDIT",
    "generated_at": "2024-04-01T09:00:00+08:00"
  }
]
```

Logic: Query subsidy_claims WHERE vendor_id = :id ORDER BY generated_at DESC.

---

---

# SECTION 5 — FRONTEND

## UI Design Workflow — Figma + MCP

All UI design is done in Figma first before any React code is written.
Figma designs are connected to Claude Code via the Figma MCP integration.

This applies to all three surfaces:
- **Consumer Website** (apps/web)
- **Digital Directory Kiosk** (apps/kiosk)
- **Vendor Portal** (apps/vendor)

Design-to-code order for every screen:
1. Design the screen in Figma (layout, components, spacing, colours, states)
2. Connect via Figma MCP to extract design tokens, component specs, and assets
3. Implement the React component to match the Figma spec exactly
4. Wire up API integration to the implemented component

Do not write UI markup or choose colours/spacing by hand — pull all visual decisions from Figma via MCP.
Do not start API integration for a screen until its Figma design is finalised and approved.

---

## Shared Rules

- Stack: React + TypeScript + Vite + TailwindCSS
- All API calls go through src/lib/api.ts — no inline fetch in components
- Parse all timestamps with new Date()
- Display times in Asia/Kuala_Lumpur (UTC+8)
- Monetary values: RM prefix, 2 decimal places
- Points values: "pts" suffix
- Skeleton loaders while fetching
- Handle loading, error, empty states for every fetch

---

## App 1 — Consumer Website (apps/web)

### UI Design Source
All page layouts, components, typography, and colour tokens come from Figma via MCP.
Do not design in code — implement only what is specified in Figma.

### State
- React Context for card session (uid, owner_name, points_balance, calorie_limit)
- Persist in localStorage
- No Redux

### Pages

**/ — Landing**
Card UID input to link session. Top-up form (calls POST /api/cards/:uid/topup).
Market stats: total vendors, active campaigns.

**/#dashboard — My Card**
Points balance. Calories today vs limit (progress bar, warning if near limit).
Calorie breakdown per vendor (Recharts bar chart). Checkpoint dots.
Active vouchers with expiry.

**/#campaigns — Campaigns**
GET /api/campaigns?card_uid=uid. Condition, progress bar, reward per campaign.
Enrol button. Completed campaigns show issued voucher.

**/#vendors — Vendors and Food**
Vendor cards with food items, point prices, photos.

**/#map — Vendor Map (Phase 3)**
CSS grid or SVG grid. Vendor markers at grid_x, grid_y.
Consumer sets own position by clicking. Clicking vendor highlights path.

---

## App 2 — Kiosk UI (apps/kiosk)

### UI Design Source
All kiosk panel layouts, touch target sizes, typography, and idle/active states come from
Figma via MCP. Kiosk screens are designed at the target touchscreen resolution in Figma first.
Do not size or space elements by hand — pull all specs from Figma via MCP.

### Behaviour
Runs locally on Pi. Primary input is NFC tap. Fullscreen panel switching.
Auto-return to idle after 60 seconds.

Poll GET http://localhost:5001/nfc every 500ms.
Response: `{ "uid": "04:A3:2F:B1" }` or `{ "uid": null }`

**Panel 1 — Idle:** "Tap your card to begin"
- On UID detected:
  1. POST /api/kiosk/tap with card_uid, kiosk_id (from VITE_KIOSK_ID env), device_timestamp
  2. GET /api/cards/:uid for dashboard data
  3. Transition to Panel 2

**Panel 2 — Card Summary:** Name, balance, calories, vouchers. Buttons to Panel 3 and 4.

**Panel 3 — Campaigns:** Active campaigns, enrol button, directory rebate status.

**Panel 4 — Vendor Map (Phase 3):** Full grid, kiosk position highlighted, path to vendor on tap.

---

## App 3 — Vendor Portal (apps/vendor)

### UI Design Source
All vendor portal layouts, table designs, form components, onboarding steps, and status badge
styles come from Figma via MCP. Implement to spec — do not improvise UI decisions in code.

### Auth
Vendor logs in with their card UID. All API calls to vendor routes include
`x-card-uid: {uid}` header. If role ≠ VENDOR, redirect to registration.

### Pages

**/ — Register or Login**
Enter card UID. If role = VENDOR go to dashboard. If CONSUMER show registration form.

**/#onboarding — Setup**
Step 1: Business details. Step 2: Visual grid picker. Step 3: MAC address. Step 4: First food item.

**/#menu — Food Items**
List from GET /api/vendors/:id/food. Add item form with photo upload. Toggle availability.

**/#campaigns — Campaign Participation**
Opt stall into active campaigns (counts for VISIT_STALLS condition).

**/#summary — Subsidy Dashboard (Phase 3)**
Table from subsidy_summary view via GET /api/vendors/:id/summary.
Redemptions, subsidy per redemption, total owed (all-time).

**/#claim — Submit Claim (Phase 3)**
Date range picker, total preview, submit via POST /api/vendors/:id/claim.
Claims history loaded from GET /api/vendors/:id/claims with status badges
(PENDING_AUDIT / APPROVED / PAID).

---

---

# SECTION 6 — FIRMWARE

## Vendor Terminal — Two Microcontrollers over UART

### Arduino UNO R3
Reads NFC, reads RTC, builds payload, drives e-paper, communicates with ESP8266 via UART.

### ESP8266
WiFi only. Receives JSON from Arduino, sends HTTPS POST to API,
stores in LittleFS queue if offline, flushes queue on reconnect,
returns result to Arduino via UART.

## E-paper Display Design — Figma + MCP

All e-paper display states (idle, processing, success, error, offline) are designed in Figma first
and connected to Claude Code via MCP before firmware rendering is implemented.
The Figma designs define the exact text layout, font size, and content per state for the
specific e-paper model in use. Implement the rendering code to match those specs.

## Libraries

### Arduino UNO R3
- Adafruit PN532
- RTClib
- ArduinoJson 6.x (StaticJsonDocument)
- E-paper library for your specific display model

### ESP8266
- ESP8266WiFi.h
- ESP8266HTTPClient.h
- ArduinoJson 6.x
- LittleFS (do NOT use SPIFFS — deprecated)

## Hardware Connections

```
Arduino UNO R3:

PN532 NFC (I2C):
  SDA → A4 | SCL → A5 | VCC → 3.3V | GND → GND

DS3231 RTC (I2C — same bus):
  SDA → A4 | SCL → A5 | VCC → 3.3V | GND → GND

E-paper: per manufacturer spec

ESP8266 UART:
  Use SoftwareSerial on pins 10 (RX) and 11 (TX)
  Arduino pin 11 (TX) → ESP8266 RX
  Arduino pin 10 (RX) → ESP8266 TX
```

## Hardcoded Constants Per Terminal

```cpp
// Arduino main.cpp
const char* VENDOR_ID = "uuid-of-this-vendor";
const char* FOOD_ID   = "uuid-of-default-food-item";  // default item for this terminal

// ESP8266 wifi_bridge.ino
const char* WIFI_SSID     = "nightmarket_wifi";
const char* WIFI_PASSWORD = "password";
const char* API_URL       = "https://your-app.up.railway.app/api/tap";
const char* SYNC_URL      = "https://your-app.up.railway.app/api/tap/sync";
const char* TERMINAL_MAC  = "AA:BB:CC:DD:EE:FF";
```

## Arduino Main Loop

```
Setup:
  Init Serial, I2C, PN532, DS3231, e-paper, SoftwareSerial to ESP8266
  Display: vendor name + "Ready"

Loop:
  Poll PN532 every 200ms
  On card detected:
    Read UID as hex string "04:A3:2F:B1"
    Read DS3231 as ISO 8601 string (+08:00 suffix — DS3231 stores MYT local time)
    Build JSON under 200 bytes via StaticJsonDocument<200>
    Send over SoftwareSerial to ESP8266
    Wait for response string (timeout 10s)
    Parse response with ArduinoJson
    Display result on e-paper 4 seconds
    Return to idle
```

## ISO 8601 Timestamp

```cpp
// DS3231 stores MYT local time (UTC+8).
// NTP sync must add 28800 seconds before writing DS3231 — NTP returns UTC.
// Output format: "2024-03-31T14:22:09+08:00"
String getISO8601() {
    DateTime now = rtc.now();
    char buf[26];
    sprintf(buf, "%04d-%02d-%02dT%02d:%02d:%02d+08:00",
        now.year(), now.month(), now.day(),
        now.hour(), now.minute(), now.second());
    return String(buf);
}
```

## Minimal JSON Payload — Under 200 Bytes

```cpp
StaticJsonDocument<200> doc;
doc["card_uid"]          = uid;
doc["vendor_id"]         = VENDOR_ID;
doc["food_id"]           = FOOD_ID;
doc["device_timestamp"]  = getISO8601();
doc["synced_from_queue"] = false;
char payload[200];
serializeJson(doc, payload);
// Send payload over SoftwareSerial to ESP8266
```

## E-paper Display States

```
Idle:          "[Vendor Name] — Ready"
Processing:    "Reading..."
Success:       "Done!  -[X]pts  +[Y]kcal"
Voucher:       "Voucher applied!  -[X]pts saved"
Warning:       "Calorie limit reached!"
Duplicate:     "Already visited today"
No points:     "Insufficient points"
Offline:       "Saved — will sync"
```

## ESP8266 Bridge Logic

```
Setup:
  Init UART (115200 baud), connect WiFi
  Init LittleFS, flush /queue.ndjson if it exists

Loop:
  On data from Arduino Serial:
    Read JSON string from UART
    If WiFi connected:
      POST to API_URL
      Send response JSON back to Arduino via UART
    If WiFi not connected:
      Open /queue.ndjson in APPEND mode
      Write JSON string + newline character
      Close file
      Send "OFFLINE_SAVED" to Arduino via UART

Queue flush (on WiFi reconnect):
  Read /queue.ndjson line by line
  Parse each line as JSON object
  Collect all objects into events array
  POST batch to SYNC_URL: { terminal_mac, events }
  On success: delete /queue.ndjson
  On failure: retain file — server deduplicates on next retry
```

Note: Queue uses NDJSON (one JSON object per line, append-only).
Do NOT read-modify-write the full file on each offline tap — append only.
This prevents data corruption on power loss mid-write.

## Python NFC Daemon — Raspberry Pi

File: `daemon/nfc_daemon.py`
Purpose: Read PN532, expose UID on localhost:5001. Never calls cloud API.

```
GET /nfc
Returns: { "uid": "04:A3:2F:B1", "timestamp": "ISO8601" }
     or: { "uid": null }

Behaviour:
  Poll PN532 every 200ms
  Cache UID 2 seconds after detection then clear
  React kiosk polls every 500ms
```

Libraries: Flask, adafruit-circuitpython-pn532, datetime

---

---

# SECTION 7 — CONCERNS AND MITIGATIONS

| Concern | Mitigation |
|---|---|
| Datatype incompatibility | Zod validates at Express. ArduinoJson types correctly. TIMESTAMPTZ in PostgreSQL |
| System complexity | Phased build. Phase 1 fully functional without campaigns or map |
| Delayed response | UART adds ~100ms. Keep payload under 200 bytes. E-paper shows Processing immediately |
| Unclear storage | points_log is financial audit trail. tap_events is operational log. subsidy_summary is reporting |
| Backend not working | POST /api/tap built and tested first. Zod rejects bad payloads early. Structured error codes |
| Arduino 2KB SRAM | StaticJsonDocument fixed size. char arrays not String. Payload under 200 bytes |
| RF environment dropout | LittleFS NDJSON queue on ESP8266 — offline taps never lost, append-only prevents corruption |
| RTC accuracy offline | DS3231 battery-backed — survives reboots. NTP syncs on WiFi reconnect (add 28800s offset) |
| Timestamp tampering | device_timestamp informational only. server_timestamp set by Express — client cannot supply it |
| Stale subsidy totals | subsidy_summary is a live view — always calculated from current data |
| Synced tap duplicate check | Uses device_timestamp::date not server_timestamp::date — reflects actual tap day |
| Subsidy claim period accuracy | Claim generation queries vouchers.used_at directly — not the all-time view |

---

---

# APPENDIX — DECISIONS LOG

| Decision | Rationale |
|---|---|
| Express middleware retained | API key must stay server-side — ESP8266 firmware is extractable |
| Arduino UNO R3 + ESP8266 | Cost — Arduino already available. ESP8266 handles WiFi separately |
| TAP_EVENTS normalised event store | Decouples physical tap from business logic |
| DS3231 mandatory | Arduino has no persistent clock — offline timestamps would be wrong on reboot |
| Dual timestamp | device_timestamp for ordering, server_timestamp for audit |
| DS3231 stores MYT (UTC+8), NTP adds offset | NTP returns UTC — must add 28800s before writing DS3231 so +08:00 suffix is correct |
| points_log separate table | Financial audit trail separate from operational tap log |
| food_items replaces calories_per_serving | Multiple items per vendor, each with own calories and price |
| Hardcoded FOOD_ID per terminal | Arduino has no UI for item selection. Single default item per terminal covers most stalls |
| Voucher reduces tap cost | Points deducted on every tap — voucher reduces the deduction at point of purchase |
| Campaign progress per card per campaign | Multiple simultaneous campaigns without interference |
| subsidy_summary as live view (dashboard only) | Never stale for display. Claim generation queries vouchers.used_at for period accuracy |
| Claim generation queries vouchers not view | View has no date filter — querying vouchers.used_at gives period-accurate totals |
| Duplicate check uses device_timestamp for synced events | server_timestamp is always "today" for synced events — device_timestamp reflects actual tap day |
| NDJSON append-only queue | Full file rewrite on each offline tap risks corruption on power loss. Append is atomic |
| LittleFS not SPIFFS | SPIFFS deprecated in current ESP8266 Arduino core. LittleFS is the replacement |
| Grid map vendor-selected position | Vendor knows their own stall location |
| x-card-uid header for vendor route auth | Prototype-level guard using VENDOR role card. Replace with Supabase Auth for production |
| Figma + MCP for all UI surfaces | Consumer website, kiosk, vendor portal, and e-paper display states all designed in Figma first |
| Phase 1 / 2 / 3 build order | Core tap must be stable before campaigns. Campaigns before map |
| Payment gateway excluded | Top-up is UI only. Payment inserts at top-up step only — no schema changes needed |

---

*End of MASTER.md*
*Version: 2.2 — Auth, registration flows, and Railway deployment*
*Hardware: Arduino UNO R3 + ESP8266 + DS3231 + PN532 + E-paper | Raspberry Pi 4 + PN532*
*Stack: React + TypeScript + Express + PostgreSQL (Supabase) + Railway + Vercel*

**Changes from v2.2 to v2.3:**
- Consumer login changed from Card UID to **email + password**
- /register page has Consumer/Vendor slide toggle; vendor mode adds business fields inline
- New consumer pages: /calories (macro breakdown, BMR calculator), /nfc (card status, promotions, taps), /settings
- Dashboard updated: username greeting, top-up modal, Locate Market button
- Campaigns updated: vouchers collected section, total deduction summary
- Vendors updated: search bar, macros (protein/carbs/fat) on food items
- Vendor portal new pages: Home dashboard, Information (stall map + food + macros + photos), Settings
- Vendor Campaigns: enrol button added
- Switch Portal button removed from both Settings pages
- food_items now supports protein_g, carbs_g, fat_g — run migration 002_add_macros.sql
- Nav updated: consumer 6 tabs, vendor 5 tabs

**Changes from v2.1 to v2.2:**
- Added dedicated consumer registration page (/register) — UID + name + email + phone + password
- Added dedicated vendor registration flow — Step 1 card account, Step 2 stall + SSM number
- Added password authentication — bcrypt(10) hash stored in cards.password_hash
- Added POST /api/auth/consumer/login and POST /api/auth/vendor/login routes
- Added phone_number column to cards table
- Added phone_number and ssm_registration_number columns to vendors table
- Added database/migrations/001_add_auth_fields.sql
- Added backend/nixpacks.toml for Railway deployment (devDep install + node tsc invocation)
- Updated POST /api/cards/register — now requires phone_number and password
- Updated POST /api/vendors/register — now requires ssm_registration_number and phone_number
- Updated repository structure to reflect all current files
- Updated Setup Order step 4 with full Railway deployment instructions
- Added SSM_ALREADY_REGISTERED, INVALID_CREDENTIALS, NO_PASSWORD_SET, NOT_A_VENDOR, ACCOUNT_DISABLED error codes

**Changes from v2.0 to v2.1:**
- Added Figma + MCP UI design workflow for all three web surfaces and e-paper display
- Added daemon/ directory to repo structure
- Added VITE_KIOSK_ID env var to kiosk env block
- Fixed subsidy claim calculation — now queries vouchers.used_at for period, not all-time view
- Added GET /api/vendors/:id/claims route
- Fixed duplicate tap check for offline-synced events — uses device_timestamp::date
- Added vendor route auth via x-card-uid header
- Clarified food_id selection — hardcoded per terminal, multi-item selection via kiosk
- Completed POST /api/kiosk/tap response and kiosk Panel 1 tap flow
- Replaced full queue file rewrite with NDJSON append-only on ESP8266
- Fixed NTP → DS3231 UTC+8 offset: NTP returns UTC, add 28800s before writing DS3231
- Added CHECK constraints on all enum columns
- Added database indexes on hot query paths
- Added GET /api/cards/:uid/history with pagination
- Added UNAUTHORIZED error code
