# NightMarket — Smart Night Market System

A unified night market platform connecting consumers, vendors, and physical kiosks through NFC card technology and a cloud backend.

---

## What This Is

Consumers use a physical NFC card to tap at vendor stalls, spend points, track calories, and earn campaign vouchers. Vendors register their business, upload food items, participate in campaigns, and claim government subsidies. A physical kiosk and vendor terminal handle on-site interactions.

> No functional payment gateway in this prototype. The prepaid top-up flow is UI-only — points balance is adjusted directly.

---

## Project Structure

```
claude_project/
├── apps/
│   ├── web/                        # Consumer web app (React + TypeScript + Vite)
│   │   └── src/pages/
│   │       ├── Landing.tsx         # Sign-in page
│   │       ├── Register.tsx        # Consumer registration
│   │       ├── Dashboard.tsx
│   │       ├── Campaigns.tsx
│   │       ├── Vendors.tsx
│   │       └── Map.tsx
│   ├── vendor/                     # Vendor portal (React + TypeScript + Vite)
│   │   └── src/pages/
│   │       ├── Login.tsx
│   │       ├── Register.tsx        # Step 1 — card account creation
│   │       ├── Onboarding.tsx      # Step 2 — business + SSM registration
│   │       ├── Menu.tsx
│   │       ├── Claim.tsx
│   │       └── Summary.tsx
│   └── kiosk/                      # Physical kiosk interface (React + TypeScript + Vite)
├── backend/
│   ├── src/routes/
│   │   ├── auth.ts                 # POST /api/auth/consumer/login + /vendor/login
│   │   ├── cards.ts
│   │   ├── vendors.ts
│   │   ├── tap.ts
│   │   ├── campaigns.ts
│   │   └── map.ts
│   └── nixpacks.toml               # Railway build configuration
├── database/
│   ├── schema.sql                  # Full schema — run first in Supabase
│   ├── seed.sql                    # Sample data
│   └── migrations/
│       └── 001_add_auth_fields.sql # Adds phone_number, password_hash, SSM columns
├── firmware/                       # Arduino + ESP8266 vendor terminal firmware
├── daemon/                         # Python NFC daemon for Raspberry Pi kiosk
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
| Firmware | Arduino + ESP8266 (NFC reader) |
| Charts | Recharts (consumer dashboard) |

---

## User Roles

| Role | Interface | Primary Actions |
|---|---|---|
| Consumer | `apps/web`, `apps/kiosk` | Register NFC card, top up points (UI only), tap at vendors, track calories, activate campaigns, redeem vouchers |
| Vendor | `apps/vendor` | Register business, upload food items, set prices, join campaigns, view subsidy dashboard |
| Guest | `apps/web` | Browse vendors and map only — no NFC features |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (for the database)

### 1. Clone the repo
```bash
git clone https://github.com/GILZ3103/claude_project.git
cd claude_project
```

### 2. Set up the database
Run the SQL files in Supabase's SQL editor in this order:
```
database/schema.sql
database/seed.sql
```

### 3. Set up the backend
```bash
cd backend
cp .env.example .env   # fill in your Supabase URL and keys
npm install
npm run dev            # runs on http://localhost:3000
```

**Deploying to Railway:**
- Set **Root Directory** to `backend` in Railway service settings
- Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=3000`
- `nixpacks.toml` is already configured — Railway will build and start automatically
- Build uses `node node_modules/typescript/bin/tsc` to avoid binary permission issues

### 4. Run a frontend app
```bash
# Consumer web app
cd apps/web
npm install
npm run dev

# Vendor portal
cd apps/vendor
npm install
npm run dev

# Kiosk
cd apps/kiosk
npm install
npm run dev
```

---

## API Overview

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/cards/register` | Register a new NFC card (consumer) |
| POST | `/auth/consumer/login` | Consumer login |
| POST | `/auth/vendor/login` | Vendor login |
| GET | `/cards/:uid` | Get consumer profile by card UID |

> See `MASTER_v2_refined.md` for the full API contract and data schemas.

---

## Key Flows

**Consumer registration:**
1. User visits `/register` on the web app
2. Submits Card UID, name, email, phone, password
3. Password is bcrypt-hashed (10 rounds) server-side
4. Auto sign-in → redirected to `/dashboard`

**NFC tap at vendor:**
1. Consumer taps NFC card at vendor terminal (Arduino + ESP8266)
2. Firmware sends Card UID to backend
3. Points deducted, calories logged, transaction recorded

---

## Development Notes

- `password_hash` is **never** returned in any API response
- Session is stored in `localStorage` (uid only) — no re-auth on page reload
- Build order: Database → Backend → Frontend (web, vendor, kiosk) → Firmware
- Full architectural decisions are documented in `MASTER_v2_refined.md`

---

## Version

**v2.2** — See `MASTER_v2_refined.md` for the full system specification and changelog.
