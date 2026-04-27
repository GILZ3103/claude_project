# NightMarket — Smart Night Market System

A unified night market platform connecting consumers, vendors, and physical kiosks through NFC card technology and a cloud backend.

---

## What This Is

Consumers use a physical NFC card to tap at vendor stalls, spend points, track calories, and earn campaign vouchers. Vendors register their business, upload food items, participate in campaigns, and claim government subsidies. A physical kiosk and vendor terminal handle on-site interactions.

> No functional payment gateway in this prototype. The prepaid top-up flow is UI-only — points balance is adjusted directly.

---

## Current Progress

| Component | Status |
|---|---|
| Database (Supabase) | Live |
| Backend API (Railway) | Live — `https://claudeproject-production-5b22.up.railway.app` |
| Consumer + Vendor Web App | Live — `https://nightmarket-web.vercel.app` |
| Kiosk App | Scaffolded — runs locally on Raspberry Pi |
| ESP32 Vendor Terminal Firmware | Active — ESP32 + RC522 RFID, WiFi + HTTPS, Bearer token auth, Serial monitor output |

---

## Deployment Architecture

```
nightmarket-web.vercel.app          ← single URL — consumer + vendor (mode toggle)
        │
        ▼
Railway Backend API                 ← all devices talk to this
claudeproject-production-5b22.up.railway.app
        │
        ▼
Supabase Database                   ← single source of truth
```

| Device | Type | URL / Connection |
|---|---|---|
| Customer phone / browser | Web app | `nightmarket-web.vercel.app` |
| Kiosk screen (Raspberry Pi) | Web app | Runs locally from SD card — `localhost` |
| Vendor terminal (ESP32) | Firmware | No URL — calls Railway API directly over WiFi |

All three connect to the same Railway backend and same Supabase database.

---

## Project Structure

```
claude_project/
├── apps/
│   ├── web/                        # Consumer + Vendor web app (single app, mode toggle)
│   │   └── src/
│   │       ├── context/CardContext.tsx
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── Landing.tsx             # Sign-in (email + password)
│   │           ├── Register.tsx            # Consumer/Vendor toggle registration
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
│   ├── vendor/                     # Legacy standalone vendor portal (superseded by apps/web)
│   └── kiosk/                      # Kiosk UI — React + TypeScript + Vite (runs on Raspberry Pi)
├── backend/
│   ├── src/routes/
│   │   ├── auth.ts                 # POST /api/auth/consumer/login + /vendor/login
│   │   ├── cards.ts                # Register, profile, history, top-up, calorie limit
│   │   ├── vendors.ts              # Register, food items (with macros), summary, claims
│   │   ├── tap.ts                  # NFC tap processing + offline sync
│   │   ├── campaigns.ts            # Campaign list, enrol, progress, kiosk tap
│   │   └── map.ts                  # Grid map data
│   └── nixpacks.toml               # Railway build configuration
├── database/
│   ├── schema.sql                  # Full schema — run first in Supabase
│   ├── seed.sql                    # Sample vendors, food items, campaigns, test cards
│   └── migrations/
│       ├── 001_add_auth_fields.sql # phone_number, password_hash, SSM columns
│       └── 002_add_macros.sql      # protein_g, carbs_g, fat_g on food_items
├── firmware/
│   └── vendor-terminal/            # ESP32 firmware — active, tested end-to-end
│       ├── platformio.ini          # Board: esp32dev, lib: MFRC522 + ArduinoJson
│       └── src/
│           ├── main.cpp            # Real firmware (loads NVS, WiFi, NTP, RC522 poll loop)
│           └── main.cpp.bak        # Backup of real firmware
├── daemon/                         # Python NFC daemon for Raspberry Pi kiosk
│   └── nfc_daemon.py
├── docs/
│   ├── embedded-architecture_vendor.md   # ESP32 firmware architecture + flow diagrams
│   ├── embedded-system-diagram.svg       # Hardware block diagram
│   └── system-architecture.md           # Full deployment overview
└── MASTER_v2_refined.md            # Full system specification
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | Supabase (PostgreSQL) |
| Auth | bcryptjs (hashed passwords, no JWT) |
| Vendor Terminal | ESP32 + RC522 RFID (SPI), WiFi + HTTPS, NVS config, Bearer token auth, Serial output |
| Kiosk | Raspberry Pi 4 + PN532 + Python NFC daemon |
| Charts | Recharts |

---

## User Roles

| Role | Interface | Primary Actions |
|---|---|---|
| Consumer | `nightmarket-web.vercel.app` | Register card, top up points, tap at vendors, track calories, join campaigns, redeem vouchers |
| Vendor | `nightmarket-web.vercel.app` (mode toggle) | Register business + SSM, upload food items with macros, join campaigns, view subsidy dashboard, submit claims |
| Guest | `nightmarket-web.vercel.app` | Browse vendors and map only |

---

## Single App — Two Modes

`apps/web` is one React app deployed to one URL. The mode toggle appears at the top only when a VENDOR role card is logged in.

```
Consumer logs in  →  consumer navigation only
Vendor logs in    →  mode toggle appears at top
                       ├── Consumer mode → consumer pages
                       └── Vendor mode   → vendor pages
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project

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
Already deployed on Railway. To run locally:
```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev            # runs on http://localhost:3000
```

### 4. Run web app locally
```bash
cd apps/web
npm install
npm run dev            # http://localhost:5173
```

### 5. Environment files
```bash
# apps/web/.env
VITE_API_URL=https://claudeproject-production-5b22.up.railway.app

# backend/.env (Railway)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TERMINAL_AUTH_TOKEN=<random secret — same value flashed to ESP32 NVS as auth_token>
PORT=3000
```

### 6. Test login credentials (seed data)
| Role | Email | Password |
|---|---|---|
| Consumer | `ahmad.farid@email.com` | `password123` |
| Vendor 1 | Login with UID `VENDOR001` | `password123` |
| Vendor 2 | Login with UID `VENDOR002` | `password123` |

---

## Consumer Web App — Pages

| Page | Route | Features |
|---|---|---|
| Login | `/` | Email + password sign-in |
| Register | `/register` | Toggle Consumer / Vendor; vendor adds Business Name, SSM, Category |
| Dashboard | `/dashboard` | Points balance, top-up modal, calorie bar, tap history |
| Calories | `/calories` | Daily intake vs limit, macronutrient breakdown, BMR calculator |
| Campaigns | `/campaigns` | Program list with progress, enrol button, vouchers collected |
| Vendors | `/vendors` | Search bar, food menu with macros and photos |
| Map | `/map` | Interactive grid map |
| NFC Card | `/nfc` | Card status, points balance, active promotions, previous taps |
| Settings | `/settings` | Profile view, sign out |

---

## Vendor Pages (inside same app)

| Page | Route | Features |
|---|---|---|
| Vendor Home | `/vendor/dashboard` | Business name, total subsidies, quick actions |
| Information | `/vendor/information` | Stall grid position, food items + macros + photos, add food form |
| Campaigns | `/vendor/campaigns` | Campaign list + enrol |
| Claim | `/vendor/claim` | Submit subsidy claim by date range, claim history |
| Summary | `/vendor/summary` | Subsidy breakdown per campaign |

---

## API Overview

Base URL: `https://claudeproject-production-5b22.up.railway.app/api`

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
| POST | `/tap` | Process NFC tap (vendor terminal) |
| GET | `/campaigns` | List campaigns + optional card progress |
| POST | `/campaigns/:id/enrol` | Enrol card in campaign |
| POST | `/kiosk/tap` | Kiosk directory tap + rebate |
| GET | `/map` | Grid map — vendors + kiosks |

---

## Embedded System

The vendor terminal (ESP32) communicates directly with the Railway API over WiFi — no browser, no URL. Output is via Serial monitor (115200 baud).

| Hardware | Role | Protocol |
|---|---|---|
| RC522 RFID reader | Reads customer card UID | SPI |
| ESP32 WiFi | Sends tap events to Railway | HTTPS |

**Pin wiring (RC522 → ESP32):**

| RC522 Pin | ESP32 Pin |
|---|---|
| SS (SDA) | GPIO 21 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| SCK | GPIO 18 |
| RST | GPIO 22 |
| VCC | 3.3V |
| GND | GND |

**Provisioning workflow:**
1. Edit `provision.cpp.txt` with your `wifi_ssid`, `wifi_pass`, `vendor_id`, `food_id`, `api_url`, `auth_token`
2. Rename to `main.cpp`, flash to device — confirm "Provisioning complete" in Serial monitor
3. Rename back to `provision.cpp.txt`, restore `main.cpp.bak` → `main.cpp`, flash real firmware

Config is stored in ESP32 NVS (non-volatile storage) — survives reboots.

**Authentication:** Every `POST /api/tap` from the terminal includes `Authorization: Bearer <auth_token>`. The backend rejects with `401 UNAUTHORIZED` if the header is missing or the token does not match the `TERMINAL_AUTH_TOKEN` environment variable. Generate a strong secret with e.g. `openssl rand -hex 32` — the same value is set in Railway and flashed into ESP32 NVS.

NTP time sync uses `time.google.com` + `time.cloudflare.com` (UTC+8 / MYT). If NTP fails, backend timestamps via `NOW()` are used instead.

Full architecture and flow diagrams: `docs/embedded-architecture_vendor.md`

---

## Development Notes

- `password_hash` is **never** returned in any API response
- Consumer login uses **email**, vendor login uses **Card UID**
- Session stored in `localStorage` (uid only) — no JWT
- NFC card stores only the UID — all data lives in the database
- Vendor terminal never writes back to the card

---

## Version

**v2.3** — See `MASTER_v2_refined.md` for full specification and changelog.
