# WarungTek — Smart Night Market System

> Previously named "NightMarket" — rebranded to WarungTek in Phase 1 of the Figma-driven redesign (May 2026).

A unified night market platform connecting consumers, vendors, and authority admins through NFC card technology, indoor Bluetooth positioning, and a cloud backend.

---

## What This Is

Consumers use a physical NFC card to tap at vendor stalls, spend points, track calories, and earn campaign vouchers. Vendors register their business, upload menu items (with load-cell weight-based pricing), participate in voucher campaigns, track compliance documents, and claim government subsidies. Authority admins approve vendor applications, manage stall allocation, and review compliance. A Raspberry Pi kiosk acts as a digital directory, and an ESP32 vendor terminal handles on-site NFC tap transactions.

> No live payment gateway — prepaid top-up adjusts points balance directly.

---

## Current Progress

| Component | Status | URL |
|---|---|---|
| Database (Supabase) | ✅ Live | — |
| Backend API (Render) | ✅ Live | `https://warungtek-backend.onrender.com` |
| Consumer + Vendor Web App | ✅ Live | `https://nightmarket-web.vercel.app` |
| Vendor Onboarding App | ✅ Built | `apps/vendor` — deploy separately |
| ESP32 Vendor Terminal | ✅ Tested end-to-end | On-device (RC522 + Load Cell) |
| Kiosk App (Raspberry Pi) | ✅ 8 panels built | Runs locally on Pi |
| NFC Daemon (Raspberry Pi) | ✅ Complete | `localhost:5001` on Pi |
| AI Features | ✅ Live | Chat assistant + Meal advisor (Gemini 2.0 Flash) |

---

## Deployment Architecture

```
nightmarket-web.vercel.app          ← consumer + vendor web app (mode toggle)
apps/vendor (deploy separately)     ← vendor onboarding app
        │
        ▼
Render Backend API                  ← all devices talk to this
warungtek-backend.onrender.com
        │
        ▼
Supabase Database                   ← single source of truth
```

| Device | Type | Connection |
|---|---|---|
| Customer phone / browser | Web app | `nightmarket-web.vercel.app` |
| Kiosk screen (Raspberry Pi) | React app | Runs locally — `localhost` |
| Vendor terminal (ESP32) | Firmware | Calls Render API directly over WiFi |

---

## Project Structure

```
claude_project/
├── apps/
│   ├── web/                        # Consumer + Vendor web app (single app, mode toggle)
│   │   └── src/
│   │       ├── components/
│   │       │   └── AiChat.tsx              # Floating AI assistant (Chat + Meal Advisor tabs)
│   │       ├── context/CardContext.tsx
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── Landing.tsx             # Sign-in (email + password)
│   │           ├── Register.tsx            # Consumer / Vendor toggle registration
│   │           ├── Dashboard.tsx           # Points, calories, top-up, history
│   │           ├── Calories.tsx            # Calorie tracker + macros + BMR
│   │           ├── Campaigns.tsx           # Programs, vouchers, enrol
│   │           ├── Vendors.tsx             # Search, menu, macros
│   │           ├── Map.tsx                 # Grid market map
│   │           ├── NfcConnect.tsx          # Card status, points, promotions, taps
│   │           ├── Settings.tsx            # Profile, sign out
│   │           ├── VendorDashboard.tsx     # Vendor home — subsidies, quick actions
│   │           ├── VendorInformation.tsx   # Stall map + food items + macros
│   │           ├── VendorClaim.tsx         # Submit subsidy claims
│   │           └── VendorSummary.tsx       # Subsidy breakdown per campaign
│   ├── vendor/                     # Vendor onboarding app (separate React app)
│   │   └── src/pages/
│   │       ├── Login.tsx / Register.tsx    # Card UID + password sign-in / registration
│   │       ├── Onboarding.tsx              # Step 2: register stall (SSM, category, grid)
│   │       ├── Home.tsx                    # Vendor dashboard
│   │       ├── Information.tsx             # Stall details + food menu
│   │       ├── Menu.tsx                    # Food item management
│   │       ├── Claim.tsx                   # Submit subsidy claims
│   │       ├── Summary.tsx                 # Subsidy breakdown
│   │       ├── VendorCampaigns.tsx         # Campaign management
│   │       └── Settings.tsx
│   └── kiosk/                      # Kiosk UI — React + TypeScript + Vite (Raspberry Pi)
│       └── src/
│           ├── context/KioskContext.tsx    # Global kiosk state + NFC tap handlers
│           ├── lib/api.ts                  # Backend + NFC daemon API calls
│           └── panels/
│               ├── HomePanel.tsx           # Idle — NFC polling + quick nav + emergency
│               ├── CardPanel.tsx           # Card summary: balance, calories, promotions
│               ├── CalorieSetPanel.tsx     # Set daily calorie limit + get AI suggestions
│               ├── MealSuggestionPanel.tsx # AI-generated meal picks with stall navigation
│               ├── FoodBrowserPanel.tsx    # Search all food, navigate to stall on map
│               ├── MapPanel.tsx            # Interactive grid map — vendors + kiosks
│               ├── CampaignsPanel.tsx      # Browse + enrol campaigns
│               ├── TopUpPanel.tsx          # QR code top-up (wiring in progress)
│               └── EmergencyModal.tsx      # Manager contact + call button
├── backend/
│   └── src/routes/
│       ├── auth.ts                 # POST /api/auth/consumer/login + /vendor/login
│       ├── cards.ts                # Register, profile, history, top-up, calorie limit
│       ├── vendors.ts              # Register, food items (with macros), summary, claims
│       ├── tap.ts                  # NFC tap processing + offline sync
│       ├── campaigns.ts            # Campaign list, enrol, progress, kiosk tap, kiosk foods
│       ├── map.ts                  # Grid map data
│       └── ai.ts                   # Gemini 2.0 Flash — chat assistant + meal advisor
├── database/
│   ├── schema.sql                  # Full schema — run first in Supabase
│   ├── seed.sql                    # Sample vendors, food items, campaigns, test cards
│   └── migrations/
│       ├── 001_add_auth_fields.sql # phone_number, password_hash, SSM columns
│       └── 002_add_macros.sql      # protein_g, carbs_g, fat_g on food_items
├── firmware/
│   └── vendor-terminal/            # ESP32 firmware — tested end-to-end
│       ├── platformio.ini          # Board: esp32dev, libs: MFRC522 + ArduinoJson
│       └── src/
│           └── main.cpp            # WiFi + NTP + RC522 poll loop + load cell (ADC GPIO34)
├── daemon/                         # Python NFC daemon for Raspberry Pi kiosk
│   └── nfc_daemon.py               # Flask — GET /nfc polls PN532 via I2C, returns UID
├── ml/
│   └── train_calibration.py        # Load cell calibration training script
├── docs/
│   ├── embedded-architecture_vendor.md
│   └── system-architecture.md
├── MASTER_v2_refined.md            # Visual overview — diagrams, phase progress, status
└── TECHNICAL.md                    # Deep technical specs — schema, API, firmware, decisions
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | Supabase (PostgreSQL) |
| Auth | bcryptjs (hashed passwords, no JWT) |
| AI | Google Gemini 2.0 Flash (chat assistant + meal advisor) |
| Vendor Terminal | ESP32 + RC522 RFID (SPI) + Load Cell (ADC), WiFi + HTTPS, Bearer token auth |
| Kiosk | Raspberry Pi 4 + PN532 NFC (I2C), Python NFC daemon, React kiosk app |
| Charts | Recharts |

---

## User Roles

| Role | Interface | Primary Actions |
|---|---|---|
| Consumer | `nightmarket-web.vercel.app` | Register card, top up points, tap at vendors, track calories, join campaigns, redeem vouchers |
| Vendor | `nightmarket-web.vercel.app` (mode toggle) or `apps/vendor` | Register business + SSM, upload food items with macros, join campaigns, view subsidy dashboard, submit claims |
| Guest | `nightmarket-web.vercel.app` | Browse vendors and map only |

---

## Single Web App — Two Modes

`apps/web` is one React app at one URL. The mode toggle appears at the top only when a VENDOR role card is signed in.

```
Consumer logs in  →  consumer navigation only
Vendor logs in    →  mode toggle appears
                       ├── Consumer mode → consumer pages
                       └── Vendor mode   → vendor pages (dashboard, info, claims, summary)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- A Google Gemini API key (for AI features)

### 1. Clone the repo
```bash
git clone https://github.com/GILZ3103/claude_project.git
cd claude_project
```

### 2. Set up the database
Run in Supabase SQL Editor in this order:
```
database/schema.sql
database/migrations/001_add_auth_fields.sql
database/migrations/002_add_macros.sql
database/seed.sql
```

### 3. Backend
Deployed on Render. To run locally:
```bash
cd backend
cp .env.example .env   # fill in values below
npm install
npm run dev            # http://localhost:3000
```

### 4. Consumer + Vendor web app
```bash
cd apps/web
npm install
npm run dev            # http://localhost:5173
```

### 5. Vendor onboarding app
```bash
cd apps/vendor
npm install
npm run dev            # http://localhost:5174
```

### 6. Kiosk app (Raspberry Pi)
```bash
cd apps/kiosk
npm install
npm run dev            # http://localhost:5175

# Also start the NFC daemon (on the Pi):
pip install flask adafruit-circuitpython-pn532
python daemon/nfc_daemon.py   # listens on port 5001
```

### 7. Environment files

```bash
# backend/.env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TERMINAL_AUTH_TOKEN=<random secret — same value flashed to ESP32 NVS>
GEMINI_API_KEY=AIza...
PORT=3000

# apps/web/.env
VITE_API_URL=https://warungtek-backend.onrender.com

# apps/vendor/.env
VITE_API_URL=https://warungtek-backend.onrender.com

# apps/kiosk/.env
VITE_API_URL=https://warungtek-backend.onrender.com
VITE_NFC_DAEMON_URL=http://localhost:5001
VITE_KIOSK_ID=<uuid of this kiosk from the kiosks table>
```

### 8. Test login credentials (seed data)
| Role | Email / UID | Password |
|---|---|---|
| Consumer | `ahmad.farid@email.com` | `password123` |
| Vendor 1 | UID `VENDOR001` | `password123` |
| Vendor 2 | UID `VENDOR002` | `password123` |

---

## Consumer Web App — Pages

| Page | Route | Features |
|---|---|---|
| Login | `/` | Email + password sign-in |
| Register | `/register` | Toggle Consumer / Vendor; vendor adds Business Name, SSM, Category |
| Dashboard | `/dashboard` | Points balance, top-up modal, calorie bar, tap history |
| Calories | `/calories` | Daily intake vs limit, macronutrient breakdown, BMR calculator |
| Campaigns | `/campaigns` | Program list with progress, enrol button, vouchers collected |
| Vendors | `/vendors` | Search bar, food menu with macros |
| Map | `/map` | Interactive grid market map |
| NFC Card | `/nfc` | Card status, points balance, active promotions, previous taps |
| Settings | `/settings` | Profile view, sign out |

AI assistant (chat + meal advisor) is a floating widget available on all pages.

---

## Vendor Pages (inside apps/web — vendor mode)

| Page | Route | Features |
|---|---|---|
| Vendor Home | `/vendor/dashboard` | Business name, total subsidies, quick actions |
| Information | `/vendor/information` | Stall grid position, food items + macros, add food form |
| Campaigns | `/vendor/campaigns` | Campaign list + enrol |
| Claim | `/vendor/claim` | Submit subsidy claim by date range, claim history |
| Summary | `/vendor/summary` | Subsidy breakdown per campaign |

---

## Kiosk App — Panels

The kiosk runs on a Raspberry Pi 4 touch screen. NFC is read by a PN532 module (I2C) via a Python daemon that the React app polls every 1.5 seconds.

| Panel | Triggered By | Features |
|---|---|---|
| Home | Default | NFC polling, quick-nav buttons (Food, Calorie, Map, Campaigns), Emergency |
| Card | Card tap | Name, points balance, calorie bar, active promotions, action grid |
| Calorie Limit | Button | Set daily calorie limit (±100 kcal), save to card, get AI suggestions |
| Meal Suggestion | AI call | 3 AI-picked dishes with calories, price, reason, navigate-to-stall button |
| Food Browser | Button | Search all food items across stalls, tap to navigate on map |
| Map | Button | Interactive grid — green = vendor, blue = kiosk, yellow = selected destination |
| Campaigns | Button | Browse active campaigns, enrol with card |
| Top Up | Button | QR code scan flow (backend ready, QR wiring in progress) |
| Emergency | Any panel | Manager phone number + one-tap call |

---

## API Overview

Base URL: `https://warungtek-backend.onrender.com/api`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | API status check |
| POST | `/auth/consumer/login` | Login with email + password |
| POST | `/auth/vendor/login` | Login with card UID + password |
| POST | `/cards/register` | Register new NFC card |
| GET | `/cards/:uid` | Full card profile |
| GET | `/cards/:uid/history` | Tap transaction history |
| GET | `/cards/:uid/vouchers` | Card vouchers |
| POST | `/cards/:uid/topup` | Add points balance |
| PATCH | `/cards/:uid/calorie-limit` | Update daily calorie limit |
| GET | `/vendors` | List all active vendors |
| POST | `/vendors/register` | Register vendor stall + SSM |
| GET | `/vendors/:id/food` | Food menu with macros |
| POST | `/vendors/:id/food` | Add food item |
| GET | `/vendors/:id/summary` | Subsidy summary |
| POST | `/vendors/:id/claim` | Submit subsidy claim |
| GET | `/vendors/:id/claims` | Claim history |
| POST | `/tap` | Process NFC tap (ESP32 vendor terminal) |
| GET | `/campaigns` | List campaigns + optional card progress |
| POST | `/campaigns/:id/enrol` | Enrol card in campaign |
| POST | `/kiosk/tap` | Kiosk directory tap + rebate |
| GET | `/kiosk/foods` | All available food items with vendor + grid position |
| GET | `/map` | Grid map — vendors + kiosks |
| POST | `/ai/chat` | AI chat assistant (Gemini 2.0 Flash) |
| POST | `/ai/meal-advisor` | AI meal suggestions by calorie budget |

---

## Embedded System — ESP32 Vendor Terminal

The vendor terminal communicates directly with the Render API over WiFi. Output is via Serial monitor (115200 baud). No browser or URL is involved.

| Hardware | Role | Protocol |
|---|---|---|
| RC522 RFID reader | Reads customer card UID | SPI |
| Load Cell (ADC GPIO34) | Measures serving weight in grams | Analog |
| ESP32 WiFi | Sends tap events to Render API | HTTPS + Bearer auth |

**RC522 pin wiring:**

| RC522 Pin | ESP32 Pin |
|---|---|
| SS (SDA) | GPIO 21 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| SCK | GPIO 18 |
| RST | GPIO 22 |
| VCC | 3.3V |
| GND | GND |

**Load cell:** Connect to GPIO34 (ADC1 — safe with WiFi active). Calibration values (`scale_factor`, `tare_offset`) are stored in NVS alongside WiFi credentials. Flash `provision.cpp` once to set them, then flash `main.cpp` for normal operation.

**Tap payload includes `weight_g`** — allows the backend to calculate per-gram cost for food items priced by weight.

**Provisioning workflow:**
1. Edit `provision.cpp.txt` with: `wifi_ssid`, `wifi_pass`, `vendor_id`, `food_id`, `api_url`, `auth_token`, `scale_factor`, `tare_offset`
2. Rename to `main.cpp`, flash to device — confirm "Provisioning complete" in Serial monitor
3. Restore `main.cpp` (real firmware) and flash again

Config stored in ESP32 NVS — survives reboots. NTP time sync uses `time.google.com` + `time.cloudflare.com` (UTC+8 / MYT).

**Authentication:** Every `POST /api/tap` includes `Authorization: Bearer <auth_token>`. Generate a strong secret with `openssl rand -hex 32` — same value goes in Render env vars and ESP32 NVS.

---

## Raspberry Pi — NFC Daemon

The kiosk React app cannot access hardware directly. A Python process sits alongside it and exposes a local HTTP API:

```
GET http://localhost:5001/nfc  →  { "uid": "04:AB:CD:EF" | null, "timestamp": "..." }
GET http://localhost:5001/health
```

The daemon polls the PN532 NFC module via I2C, keeps the last-seen UID for 3 seconds, then returns null. The React kiosk polls this every 1.5 seconds. Gracefully degrades to stub mode if the PN532 library is unavailable (dev machine).

```bash
pip install flask adafruit-circuitpython-pn532
python daemon/nfc_daemon.py
```

---

## Development Notes

- `password_hash` is **never** returned in any API response
- Consumer login uses **email**, vendor login uses **Card UID**
- Session stored in `localStorage` (uid only) — no JWT
- NFC card stores only the UID — all data lives in the database
- Vendor terminal never writes back to the card
- Load cell is optional — firmware skips weight detection if `scale_factor == 1.0` (default) or `tare_offset == 0`

---

## Version

**v2.4** — See `MASTER_v2_refined.md` for full visual specification and `TECHNICAL.md` for deep technical specs.
