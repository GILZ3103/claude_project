# WarungTek Kiosk

The customer-facing digital directory terminal for the WarungTek night market platform. Touch-screen app that runs on a Raspberry Pi 5 at the market entrance — guides visitors to stalls, manages NFC card wallets, recognises returning customers via their face, and tracks active campaign participation.

---

## What it does

| Feature | Description |
|---|---|
| **Stall directory** | Browse all active stalls with food categories, dietary filters, distance, and vouchers |
| **Smart navigation** | Visual grid map (A1–C3 zones) with animated path from kiosk to selected stall |
| **NFC card wallet** | Tap RC522 reader → see balance, vouchers, calorie tracker; +5 pts per kiosk tap |
| **Face recognition** | Auto-recognise returning customers via webcam; show personalised UserBar without requiring card tap |
| **Dual navigator** | Guest sees standard header; recognised users see a personalised top bar (name, points, calories, active campaigns) |
| **Multi-language** | English / Bahasa Malaysia / 中文 toggle |
| **Emergency call** | One-tap red button → modal with PIC phone number |

---

## Tech Stack

### Frontend (this directory)
- **React 19** + **TypeScript 5**
- **Vite 8** (Rolldown-powered, sub-3s production builds)
- **Tailwind CSS 4** with custom theme tokens
- **lucide-react** for icons
- **react-hot-toast** for notifications

### Backend (../../backend/)
- **Node.js** + **Express** + **TypeScript**
- **Supabase** (PostgreSQL + Auth)
- Deployed on **Render** at `https://warungtek-backend.onrender.com`
- Endpoints used by kiosk:
  - `GET /api/cards/:uid` — card profile + balance + calorie info
  - `GET /api/cards/:uid/vouchers` — active vouchers
  - `POST /api/kiosk/tap` — log directory tap, award +5 pts
  - `GET /api/vendors` — stall list
  - `GET /api/kiosk/foods` — menu items per vendor

### Daemons (../../daemon/)
- **`nfc_daemon.py`** — Flask HTTP service on `:5001`, reads RC522 RFID tags via SPI
- **`face/face_daemon.py`** — Flask HTTP service on `:5002`, runs RetinaFace + ArcFace via insightface for face recognition

---

## Hardware

| Component | Purpose | Connection |
|---|---|---|
| **Raspberry Pi 5** | Kiosk host running labwc Wayland compositor | — |
| **7" touch display** | Customer UI | HDMI + USB |
| **RC522 RFID reader** | Reads NFC cards | SPI (GPIO 8/9/10/11/25) |
| **Arducam (planned)** | Face capture camera | CSI ribbon cable |
| **Laptop webcam** (current) | Prototype face capture during development | USB (over WiFi to Pi) |

### RC522 SPI wiring
```
SDA (SS)  → GPIO 8   (Pin 24)
SCK       → GPIO 11  (Pin 23)
MOSI      → GPIO 10  (Pin 19)
MISO      → GPIO 9   (Pin 21)
RST       → GPIO 25  (Pin 22)
3.3V      → Pin 1   (NEVER 5V)
GND       → Pin 6
```

---

## Tools used (dev environment)

- **Node 20+** + **npm** — build/dev
- **Python 3.12+** — daemon runtimes
- **`mfrc522` + `rpi-lgpio`** — Pi 5 RC522 GPIO library
- **`insightface`, `mediapipe`, `opencv-python`, `onnxruntime`** — face recognition pipeline
- **systemd** — services on Pi (`nfc-daemon.service`, `kiosk-web.service`)
- **scp / ssh** — deployment from laptop to Pi
- **Render** — backend host (auto-deploys from `main` branch)
- **Supabase Studio** — DB schema + manual inserts

---

## High-level Data Flow

```
                 ┌────────────────────────────────────────┐
                 │           KIOSK (Pi 5)                 │
                 │                                        │
  RC522 NFC ─────►  nfc_daemon.py (:5001)                 │
                 │       ↓ GET /nfc                       │
                 │   React App (Chromium kiosk mode)      │
                 │       ↑ GET /face/recognized           │
  Webcam ────────►  face_daemon.py (:5002)                │
                 │                                        │
                 └──────────────────┬─────────────────────┘
                                    │ HTTPS
                                    ▼
                 ┌────────────────────────────────────────┐
                 │      Backend (Render)                  │
                 │  Express + Supabase REST adapter       │
                 └──────────────────┬─────────────────────┘
                                    │ Postgres
                                    ▼
                 ┌────────────────────────────────────────┐
                 │      Supabase (PostgreSQL)             │
                 │  cards, vendors, foods, tap_events,    │
                 │  vouchers, campaigns, kiosks           │
                 └────────────────────────────────────────┘
```

### NFC tap flow
1. Customer holds card on RC522 → `nfc_daemon` reads UID, stores with 3s TTL
2. React app polls `/nfc` every 1.5s → detects new UID
3. App calls `GET /api/cards/:uid` → loads owner name, balance, calories, vouchers
4. App calls `POST /api/kiosk/tap` → logs directory tap, awards +5 pts
5. NFC login animation plays → WalletPanel opens

### Face recognition flow
1. Camera frame captured → quality pre-filter (blur, brightness)
2. RetinaFace detects face → ArcFace generates 512-dim embedding
3. Cosine similarity match against `faces.db` (local SQLite, embeddings only)
4. Temporal smoothing (3-of-5 frames) → confirmed match
5. React polls `/face/recognized` every 1s → calls `GET /api/cards/:uid` on match
6. `has_physical_card=true` → modal: "Tap card to earn 5 pts"
7. `has_physical_card=false` → modal: "Visit counter to get a card"

---

## Source Layout

```
apps/kiosk/
├── src/
│   ├── App.tsx                    Main app — state, polling, routing between overlays
│   ├── main.tsx                   React entry point
│   ├── app/
│   │   ├── data.ts                Stall/MenuItem types, MOCK_STALLS, CATEGORIES, VOUCHERS
│   │   ├── translations.ts        en/ms/zh strings
│   │   └── components/
│   │       ├── Header.tsx         WarungTek logo + search + icon row
│   │       ├── UserBar.tsx        Orange strip below Header (user mode only)
│   │       ├── Intro.tsx          Category pill row
│   │       ├── FilterPanel.tsx    Left sidebar filters
│   │       ├── StallGrid.tsx      Stall card grid
│   │       ├── StallCard.tsx      Individual stall card
│   │       ├── StallDetails.tsx   Modal — menu + nutrition + voucher
│   │       ├── SmartNav.tsx       Map overlay with animated path
│   │       ├── WalletPanel.tsx    Balance + vouchers + loyalty
│   │       ├── HelpAndEmergency.tsx Help drawer + emergency call modal
│   │       ├── SettingsModal.tsx  Calorie target, preferences, logout
│   │       └── FaceRecognizedModal.tsx Pops up on face match (with/without card branches)
│   ├── lib/
│   │   └── transforms.ts          Backend Vendor → Figma Stall mapping
│   └── styles/
│       ├── index.css              Entry — imports the three below
│       ├── tailwind.css           Tailwind directives
│       ├── theme.css              CSS variables (colours, radii)
│       └── fonts.css              Font imports
├── .env                           VITE_API_URL, VITE_NFC_DAEMON_URL, VITE_FACE_DAEMON_URL, VITE_KIOSK_ID
└── package.json
```

---

## Build & Deploy

### Local dev (laptop)
```powershell
cd apps/kiosk
npm install
npm run dev          # → http://localhost:5173
```

### Production build → Pi
```powershell
# Laptop
cd apps/kiosk
npm run build
scp -r dist\* hokahheng11@hokahheng11.local:/home/hokahheng11/kiosk-web/
```

```bash
# Pi SSH — restart browser to pick up new build
pkill -f chromium
DISPLAY=:0 chromium --kiosk --noerrdialogs --disable-infobars http://localhost:8080 &
```

The Pi serves the built `dist/` via a simple Python `http.server` on port 8080 (`kiosk-web.service`).

### Environment variables (`.env`)
| Key | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `https://warungtek-backend.onrender.com` | Render backend |
| `VITE_NFC_DAEMON_URL` | `http://localhost:5001` | Pi-local NFC daemon |
| `VITE_FACE_DAEMON_URL` | `http://localhost:5002` | Pi-local face daemon (change to laptop LAN IP for prototype cross-device testing) |
| `VITE_KIOSK_ID` | `d0000001-0001-0001-0001-000000000001` | Supabase `kiosks.kiosk_id` for this terminal |

---

## What was built

| Phase | What changed | Status |
|---|---|---|
| **NFC integration** | RC522 SPI rewrite, CORS, daemon as systemd service | ✅ |
| **Figma UI swap** | Replaced dark panel-based UI with WarungTek light theme; 11 new components | ✅ |
| **Backend wiring** | `transforms.ts` maps real Supabase vendors to UI Stall type; vouchers + tap log live | ✅ |
| **Dual top navigator** | UserBar slides in for recognised users with name/points/calories/campaigns | ✅ |
| **Face recognition** | InsightFace pipeline + Flask daemon + React polling + modal branches | ✅ |
| **Backend CORS fix** | `localhost:8080` added to allowlist for Pi-hosted kiosk | ✅ |
| **API extension** | `has_physical_card` exposed by `GET /api/cards/:uid` | ✅ |
| **Cleanup** | 19 dead files removed across two passes (old panels + template assets + KioskContext) | ✅ |

---

## Known constraints / future work

- **Render cold starts** — free tier sleeps after inactivity; first card tap after a quiet period takes 20–30s. Fix: paid tier or self-host.
- **Face thresholds are laptop-tuned** — `PROXIMITY_BBOX_RATIO=0.10`, `THRESHOLD_CONFIRMED=0.40`, `QUALITY_BLUR_THRESHOLD=20`. Restore to defaults (0.25 / 0.65 / 100) when Arducam arrives.
- **NFC card write cycle** — not yet implemented. Plan exists for writing balance back to card block 8 after each tap.
- **Faces.db is local** — embeddings live only on the Pi, never synced to cloud (privacy by design). Sync service (`SYNC_INTERVAL_SECONDS=300`) downloads enrollment photos from backend `/api/face/photos`.

---

## Related services

- **Backend**: [`../../backend/`](../../backend/) — Express API
- **Admin web**: [`../web/`](../web/) — Vendor management portal
- **Vendor terminal**: [`../vendor/`](../vendor/) — POS app for stalls
- **NFC daemon**: [`../../daemon/nfc_daemon.py`](../../daemon/nfc_daemon.py)
- **Face daemon**: [`../../daemon/face/`](../../daemon/face/)
