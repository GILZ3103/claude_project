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
| Consumer Web App | Functional locally (`localhost:5173`) |
| Vendor Portal | Functional locally (`localhost:5174`) |
| Kiosk App | Scaffolded — not deployed |
| Arduino Firmware | Not yet started — awaiting hardware setup |
| Vercel Deployment | Pending |

---

## Project Structure

```
claude_project/
├── apps/
│   ├── web/                        # Consumer web app (React + TypeScript + Vite)
│   │   └── src/
│   │       ├── context/CardContext.tsx
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── Landing.tsx         # Sign-in (email + password)
│   │           ├── Register.tsx        # Consumer/Vendor toggle registration
│   │           ├── Dashboard.tsx       # Points, calories, top-up, history
│   │           ├── Calories.tsx        # Calorie tracker + macros + BMR
│   │           ├── Campaigns.tsx       # Programs, vouchers, enrol
│   │           ├── Vendors.tsx         # Search, menu, macros
│   │           ├── Map.tsx             # Grid market map
│   │           ├── NfcConnect.tsx      # Card status, points, promotions, taps
│   │           └── Settings.tsx        # Profile, sign out
│   ├── vendor/                     # Vendor portal (React + TypeScript + Vite)
│   │   └── src/
│   │       ├── context/VendorContext.tsx
│   │       ├── lib/api.ts
│   │       └── pages/
│   │           ├── Login.tsx           # Sign-in (UID + password)
│   │           ├── Register.tsx        # Step 1 — card account
│   │           ├── Onboarding.tsx      # Step 2 — business + SSM
│   │           ├── Home.tsx            # Dashboard — subsidies, quick actions
│   │           ├── Information.tsx     # Stall map + food items + macros + photos
│   │           ├── VendorCampaigns.tsx # Campaigns + enrol button
│   │           ├── Summary.tsx         # Subsidy breakdown
│   │           ├── Claim.tsx           # Submit subsidy claims
│   │           └── Settings.tsx        # Profile, sign out
│   └── kiosk/                      # Physical kiosk interface (React + TypeScript + Vite)
├── backend/
│   ├── src/routes/
│   │   ├── auth.ts                 # POST /api/auth/consumer/login (email) + /vendor/login
│   │   ├── cards.ts                # Register, profile, history, top-up, calorie limit
│   │   ├── vendors.ts              # Register, food items (with macros), summary, claims
│   │   ├── tap.ts                  # NFC tap processing
│   │   ├── campaigns.ts            # Campaign list, enrol, progress
│   │   └── map.ts                  # Grid map data
│   └── nixpacks.toml               # Railway build configuration
├── database/
│   ├── schema.sql                  # Full schema — run first in Supabase
│   ├── seed.sql                    # Sample data
│   └── migrations/
│       ├── 001_add_auth_fields.sql # phone_number, password_hash, SSM columns
│       └── 002_add_macros.sql      # protein_g, carbs_g, fat_g on food_items
├── firmware/                       # Arduino + ESP8266 vendor terminal (not yet implemented)
├── daemon/                         # Python NFC daemon for Raspberry Pi kiosk
│   └── nfc_daemon.py
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
| Firmware | Arduino + ESP8266 (not yet implemented) |
| Charts | Recharts (consumer dashboard) |

---

## User Roles

| Role | Interface | Primary Actions |
|---|---|---|
| Consumer | `apps/web` | Register card, top up points (UI only), tap at vendors, track calories, join campaigns, redeem vouchers |
| Vendor | `apps/vendor` | Register business + SSM, upload food items with macros, join campaigns, view subsidy dashboard, submit claims |
| Guest | `apps/web` | Browse vendors and map only |

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
database/seed.sql
database/migrations/001_add_auth_fields.sql
database/migrations/002_add_macros.sql
```

### 3. Backend
Already deployed on Railway. To run locally:
```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev            # runs on http://localhost:3000
```

**Railway deployment:**
- Set **Root Directory** to `backend` in Railway service settings
- Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=3000`
- `nixpacks.toml` handles build automatically

### 4. Run frontend apps
```bash
# Consumer web app — http://localhost:5173
cd apps/web && npm run dev

# Vendor portal — http://localhost:5174
cd apps/vendor && npm run dev
```

### 5. Environment files
```bash
# apps/web/.env
VITE_API_URL=https://claudeproject-production-5b22.up.railway.app

# apps/vendor/.env
VITE_API_URL=https://claudeproject-production-5b22.up.railway.app
```

---

## Consumer Web App — Pages

| Page | Route | Features |
|---|---|---|
| Login | `/` | Email + password sign-in, link to register |
| Register | `/register` | Toggle Consumer / Vendor at top; vendor adds Business Name, SSM, Category |
| Dashboard | `/dashboard` | Username greeting, points balance, top-up modal (RM 10/20/50/custom), Locate Market button, calorie bar, vouchers, tap history |
| Calories | `/calories` | Daily intake vs limit, macronutrient breakdown (protein/carbs/fat), adjust calorie limit, weight + height BMR calculator |
| Campaigns | `/campaigns` | Program list with progress bars, enrol button, vouchers collected section, total deduction summary |
| Vendors | `/vendors` | Search bar, vendor list, drill into food menu with macros and photos |
| Map | `/map` | Interactive grid map, click stall for tooltip |
| NFC Card | `/nfc` | Card connected status, points balance, active promotions notifications, previous taps |
| Settings | `/settings` | Profile view (name, email, phone, UID), sign out |

---

## Vendor Portal — Pages

| Page | Route | Features |
|---|---|---|
| Login | `/` | Card UID + password |
| Register | `/register` | Step 1 — card account (same fields as consumer) |
| Onboarding | `/onboarding` | Step 2 — Business Name, SSM No., Phone, Category, Grid position |
| Home | `/home` | Business name, total subsidies available, quick action grid |
| Information | `/information` | Stall location on map grid, food items list with photo URL + calories + macros |
| Campaigns | `/campaigns` | Campaign list + enrol button |
| Summary | `/summary` | Subsidy breakdown per campaign |
| Claim | `/claim` | Submit subsidy claim by date range, claim history |
| Settings | `/settings` | Profile view, sign out |

---

## API Overview

Base URL: `https://claudeproject-production-5b22.up.railway.app/api`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/consumer/login` | Login with email + password |
| POST | `/auth/vendor/login` | Login with card UID + password (requires VENDOR role) |
| POST | `/cards/register` | Register new NFC card with phone + password |
| GET | `/cards/:uid` | Get full card profile |
| GET | `/cards/:uid/history` | Tap history |
| GET | `/cards/:uid/vouchers` | Active vouchers |
| POST | `/cards/:uid/topup` | Add points balance |
| PATCH | `/cards/:uid/calorie-limit` | Update daily calorie limit |
| GET | `/vendors` | List all active vendors |
| POST | `/vendors/register` | Register vendor stall + SSM |
| GET | `/vendors/:id/food` | Food menu with macros |
| POST | `/vendors/:id/food` | Add food item (name, calories, price, macros, photo) |
| GET | `/vendors/:id/summary` | Subsidy summary |
| POST | `/vendors/:id/claim` | Submit subsidy claim |
| GET | `/campaigns` | List campaigns (with progress if card_uid provided) |
| POST | `/campaigns/:id/enrol` | Enrol card in campaign |
| POST | `/tap` | Process NFC tap at vendor terminal |
| GET | `/map` | Grid map with vendor + kiosk positions |

> See `MASTER_v2_refined.md` for full API contracts and data schemas.

---

## Key Flows

**Consumer registration:**
1. Visit `/register` → select Consumer tab
2. Fill: Card UID, name, email, phone, password
3. Auto sign-in → `/dashboard`

**Vendor registration:**
1. Visit `/register` → select Vendor tab → fills card account fields + business info
2. Step 2 (Onboarding): Business Name, SSM No., grid position
3. Auto sign-in → `/home` dashboard

**Consumer login:**
- Email + password (not Card UID)

**NFC tap at vendor:**
1. Consumer taps NFC card at vendor terminal (Arduino + ESP8266)
2. Firmware sends Card UID + food item to `POST /api/tap`
3. Points deducted, calories logged, transaction recorded

---

## Development Notes

- `password_hash` is **never** returned in any API response
- Consumer login uses **email**, vendor login uses **Card UID**
- Session stored in `localStorage` (uid only) — no re-auth on page reload
- Macros (protein/carbs/fat) on food items require migration `002_add_macros.sql`
- Build order: Database → Backend → Frontend → Firmware

---

## Version

**v2.3** — See `MASTER_v2_refined.md` for full specification and changelog.
