# Smart Night Market — Master Overview
**Version 2.3** · [Technical specs → TECHNICAL.md](TECHNICAL.md) · [Setup → README.md](README.md)

A unified night market platform: consumers tap a physical NFC card at vendor stalls to spend points, track calories, and earn campaign vouchers. Vendors register, upload food, and claim government subsidies. A kiosk acts as a digital directory.

---

## Build Progress

```mermaid
flowchart LR
    subgraph P1["✅ PHASE 1 — CORE"]
        direction TB
        DB["🗄️ Database\n10 tables live"]
        BE["⚙️ Backend API\nRailway — all routes"]
        FE["🌐 Web App\nVercel — 13 pages"]
        HW["⚡ ESP32 Firmware\nRC522 + Bearer auth"]
    end
    subgraph P2["✅ PHASE 2 — CAMPAIGNS"]
        direction TB
        CE["🎯 Campaign Engine\n3 condition types"]
        VP["📊 Voucher Pipeline\nauto-issue on completion"]
        CP["📈 Consumer Progress\nper-card tracking"]
    end
    subgraph P3["✅ PHASE 3 — MAP & PORTAL"]
        direction TB
        GM["🗺️ Grid Map\nvendor positions"]
        VP2["🏪 Vendor Portal\nclaims + subsidy"]
    end
    subgraph PK["🟡 KIOSK — IN PROGRESS"]
        direction TB
        KUI["🖥️ Kiosk UI\n4 panels — not built"]
        KDM["🐍 NFC Daemon\nscaffolded only"]
    end

    P1 --> P2 --> P3
    P3 -.->|next| PK

    style P1 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style P2 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style P3 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style PK fill:#fff4cc,stroke:#b08800,color:#7a5c00
```

---

## Component Status

| Component | Status | Live URL |
|---|---|---|
| 🗄️ Database (Supabase) | ✅ Live | — |
| ⚙️ Backend API (Railway) | ✅ Live | `claudeproject-production-5b22.up.railway.app` |
| 🌐 Consumer + Vendor Web App | ✅ Live | `nightmarket-web.vercel.app` |
| ⚡ ESP32 Vendor Terminal | ✅ Tested end-to-end | On-device |
| 🖥️ Kiosk App (Raspberry Pi) | 🟡 Scaffolded | Runs locally on Pi |

---

## Three Physical Surfaces

| Surface | Hardware | Status |
|---|---|---|
| Consumer website | Any browser | ✅ Live |
| Vendor portal | Any browser (same URL) | ✅ Live |
| Vendor terminal | ESP32 DevKit v1 + RC522 RFID | ✅ Active |
| Digital directory kiosk | Raspberry Pi 4 + PN532 NFC | 🟡 Not built yet |

---

## User Roles

| Role | Access | Key Actions |
|---|---|---|
| 🧑 Consumer | `nightmarket-web.vercel.app` | Register card · top up points · tap at vendors · track calories · join campaigns · redeem vouchers |
| 🏪 Vendor | Same URL (mode toggle) | Register stall + SSM · upload food items · join campaigns · view subsidy dashboard · submit claims |
| 👤 Guest | Same URL | Browse vendors and map only |

---

## Diagram 1 — Website Setup

End-to-end view of the four website-side pieces (database, backend, frontend, network).
🟢 = done · 🟡 = scaffolded · 🔴 = not started

```mermaid
flowchart TB
    subgraph Clients["CLIENTS"]
        direction LR
        Phone["📱 Consumer phone / browser ✅"]
        VendorBrowser["💻 Vendor browser ✅"]
        ESP32["⚡ ESP32 vendor terminal ✅\nBearer token auth"]
        PiKiosk["🖥️ Raspberry Pi kiosk 🟡\nscaffolded only"]
    end

    subgraph Frontend["FRONTEND ✅ Live on Vercel"]
        direction TB
        Web["apps/web\nConsumer + Vendor (mode toggle)\nnightmarket-web.vercel.app\n13 pages"]
        Kiosk["apps/kiosk 🟡\nnot built — 4 panels planned"]
    end

    subgraph Backend["BACKEND ✅ Live on Railway"]
        direction TB
        Mid["Middleware\nexpress.json · CORS · Zod validate · errors"]
        Routes["Routes /api/*\nauth · cards · vendors · tap · campaigns · map · kiosk"]
        Auth1["Auth checks ✅\nx-card-uid (vendor routes)\nBearer token (POST /api/tap)"]
    end

    subgraph Database["DATABASE ✅ Live on Supabase"]
        direction TB
        DB[("PostgreSQL\n10 tables\n+ subsidy_summary view")]
        Migrations["schema.sql + 2 migrations"]
    end

    Phone -->|HTTPS| Web
    VendorBrowser -->|HTTPS| Web
    ESP32 -->|"HTTPS POST /api/tap\nAuthorization: Bearer token"| Routes
    PiKiosk -.->|HTTPS planned| Kiosk
    Web -->|fetch /api/*| Mid
    Kiosk -.-> Mid
    Mid --> Routes
    Routes --> Auth1
    Auth1 -->|service role key| DB
    Migrations --- DB

    style Frontend fill:#d4f4dd,stroke:#2d8a4f
    style Backend fill:#d4f4dd,stroke:#2d8a4f
    style Database fill:#d4f4dd,stroke:#2d8a4f
    style Kiosk fill:#fff4cc,stroke:#b08800
    style PiKiosk fill:#fff4cc,stroke:#b08800
```

---

## Diagram 2 — User Journey & Features

Click-by-click flow showing what each step does, what API it calls, and completion status.

### Consumer Journey (apps/web) ✅

```mermaid
flowchart LR
    Start(["User opens\nnightmarket-web.vercel.app"])
    Start --> Land["/\nLanding — email + password ✅"]
    Land -->|New user| Reg["/register\nConsumer/Vendor toggle ✅"]
    Land -->|Sign in| AuthCheck{"POST /api/auth/\nconsumer/login"}
    Reg -->|POST /api/cards/register| AuthCheck
    AuthCheck -->|❌ wrong creds| Land
    AuthCheck -->|✅| Dash["/dashboard ✅\nbalance · calories · history"]

    Dash -->|tab| Cal["/calories ✅\nmacros · BMR · limit"]
    Dash -->|tab| Camp["/campaigns ✅\nprograms · vouchers"]
    Dash -->|tab| Vend["/vendors ✅\nsearch · macros · photos"]
    Dash -->|tab| Map["/map ✅\ngrid layout"]
    Dash -->|tab| NFC["/nfc ✅\ncard status"]
    Dash -->|tab| Set["/settings ✅"]

    Dash -.->|"Top-up button"| Topup[/"POST /api/cards/:uid/topup"/]
    Camp -.->|"Enrol button"| Enrol[/"POST /api/campaigns/:id/enrol"/]
    Cal -.->|"Update limit"| Limit[/"PATCH /api/cards/:uid/calorie-limit"/]
    Vend -.->|"View menu"| VFood[/"GET /api/vendors/:id/food"/]
    Set -->|Sign out| Land
```

### Vendor Journey (apps/web — vendor mode) ✅

```mermaid
flowchart LR
    Start(["Vendor login"]) --> AuthV["POST /api/auth/\nvendor/login ✅"]
    AuthV -->|role=VENDOR| Toggle["Mode toggle appears ✅"]
    Toggle -->|Vendor mode| VDash["/vendor/dashboard ✅\nbusiness · subsidies"]

    VDash -->|tab| VInfo["/vendor/information ✅\ngrid + food list + add form"]
    VDash -->|tab| VCamp["/vendor/campaigns ✅"]
    VDash -->|tab| VClaim["/vendor/claim ✅\ndate range submit"]
    VDash -->|tab| VSum["/vendor/summary ✅\nall-time subsidy"]

    VInfo -.->|"Add food item"| AddFood[/"POST /api/vendors/:id/food\nx-card-uid header"/]
    VClaim -.->|"Submit claim"| Claim[/"POST /api/vendors/:id/claim\nx-card-uid header"/]
    VSum -.->|"Load summary"| Sum[/"GET /api/vendors/:id/summary\nx-card-uid header"/]
    VDash -->|Switch back| CDash["Consumer mode\n(/dashboard)"]
```

### Kiosk Journey (apps/kiosk) 🟡 Planned

```mermaid
flowchart LR
    Idle["Panel 1 — Idle 🟡\nTap your card to begin"]
    Idle -->|"NFC tap detected\n(daemon → /nfc poll)"| KTap[/"POST /api/kiosk/tap ✅ backend ready"/]
    KTap --> P2["Panel 2 — Card Summary 🟡\nname · balance · calories · vouchers"]
    P2 -->|button| P3["Panel 3 — Campaigns 🟡\nlist · enrol"]
    P2 -->|button| P4["Panel 4 — Map 🟡\ngrid + path to vendor"]
    P3 -.->|enrol| Enrol2[/"POST /api/campaigns/:id/enrol ✅"/]
    P2 -->|60s idle| Idle
    P3 -->|60s idle| Idle
    P4 -->|60s idle| Idle

    style Idle fill:#fff4cc,stroke:#b08800
    style P2 fill:#fff4cc,stroke:#b08800
    style P3 fill:#fff4cc,stroke:#b08800
    style P4 fill:#fff4cc,stroke:#b08800
```

> Backend route `POST /api/kiosk/tap` is implemented. The React UI panels and Python NFC daemon are not yet built.

---

## Diagram 3 — Hardware Setup (ESP32 Vendor Terminal)

Two views: physical hardware architecture and the firmware code path on every card tap.

### Hardware Architecture ✅

```mermaid
flowchart TB
    Card["💳 NFC Card\n(NTAG215 — UID only) ✅"]

    subgraph Terminal["VENDOR TERMINAL ✅"]
        direction TB
        subgraph RC522["RC522 RFID Reader (SPI) ✅"]
            Reader["Reads card UID"]
        end
        subgraph ESP32["ESP32 DevKit v1 ✅"]
            FW["main.cpp\nsetup() + loop()"]
            NVS[("NVS storage ✅\nwifi_ssid · wifi_pass\nvendor_id · food_id\napi_url · auth_token")]
            WiFi["WiFi + HTTPS ✅\n(mbedTLS hardware TLS)"]
        end
        Serial["📺 USB Serial\n115200 baud\n(Serial monitor output)"]
    end

    Backend[/"Backend POST /api/tap ✅\nrequireTerminalAuth →\nZod validate → tap logic"/]
    Supabase[("Supabase\nPostgreSQL ✅")]

    Card -.tap.-> Reader
    Reader -->|"SS=21 · MOSI=23\nMISO=19 · SCK=18 · RST=22"| FW
    NVS -->|"prefs.getString()"| FW
    FW --> WiFi
    WiFi -->|"HTTPS\nAuthorization: Bearer authToken"| Backend
    Backend --> Supabase
    Supabase -->|"row data"| Backend
    Backend -->|"200 + balance/calories\nor 401/402/409"| WiFi
    FW --> Serial

    style Terminal fill:#d4f4dd,stroke:#2d8a4f
    style Backend fill:#d4f4dd,stroke:#2d8a4f
    style Supabase fill:#d4f4dd,stroke:#2d8a4f
```

### Card Tap — Firmware Code Path ✅

```mermaid
sequenceDiagram
    actor User as 👤 Consumer
    participant Card as 💳 NFC Card
    participant RC522 as 📡 RC522
    participant ESP32 as ⚡ ESP32 main.cpp
    participant API as 🌐 Backend /api/tap
    participant DB as 🗄️ Supabase

    Note over ESP32: setup() — load NVS,<br/>connect WiFi, NTP sync
    User->>Card: Tap on terminal
    Card-->>RC522: UID broadcast (RF)
    RC522-->>ESP32: PICC_IsNewCardPresent()<br/>+ PICC_ReadCardSerial()
    ESP32->>ESP32: readUID() → "333F6C08"
    ESP32->>ESP32: getTimestamp() (NTP MYT)
    ESP32->>ESP32: Build JSON payload<br/>StaticJsonDocument<256>

    ESP32->>+API: POST /api/tap<br/>Authorization: Bearer authToken
    API->>API: requireTerminalAuth<br/>(401 if invalid)
    API->>API: Zod validate (400 if invalid)
    API->>+DB: SELECT card · vendor · food
    DB-->>-API: rows
    API->>API: Check duplicate · voucher · balance
    API->>+DB: UPDATE balance<br/>INSERT tap_event<br/>INSERT points_log<br/>UPDATE campaign_progress
    DB-->>-API: ok
    API-->>-ESP32: 200 + JSON response

    ESP32->>ESP32: Parse StaticJsonDocument<1024>
    ESP32-->>User: Serial.println<br/>"OK  -5.0pts  +560kcal"

    Note over ESP32: PICC_HaltA()<br/>delay(2000) — debounce
```

---

## Diagram 4 — Tech Stack & Tool Relationships

### Layer Architecture

How each technology is positioned in the stack — from device hardware up to cloud hosting.

```mermaid
flowchart TB
    subgraph Devices["DEVICES"]
        direction LR
        Browser["🌐 Browser\n(any device)"]
        ESP32HW["⚡ ESP32 DevKit v1\n240MHz · 520KB SRAM"]
        PiHW["🖥️ Raspberry Pi 4\n(kiosk)"]
    end

    subgraph Firmware["FIRMWARE  (ESP32)"]
        direction LR
        PIO["PlatformIO\nbuild system"]
        ArduinoFW["Arduino C++\nframework"]
        MFRC522Lib["MFRC522 lib\nRC522 SPI driver"]
        AJson["ArduinoJson v6\nStaticJsonDocument"]
        mbedTLS["mbedTLS\nhardware TLS (built-in)"]
    end

    subgraph Frontend["FRONTEND  (Vercel)"]
        direction LR
        Vite["Vite\nbundler + dev server"]
        React["React 19\ncomponent tree"]
        TS["TypeScript\ntype safety"]
        Tailwind["TailwindCSS\nstyle utilities"]
        RR["React Router\nclient-side routing"]
        Context["Context API\nglobal card session"]
        Recharts["Recharts\ncalorie bar chart"]
    end

    subgraph BackendLayer["BACKEND  (Railway)"]
        direction LR
        Express["Express\nHTTP server"]
        Zod["Zod\npayload validation"]
        Bcrypt["bcryptjs\npassword hashing"]
        SupaJS["@supabase/supabase-js\nDB client"]
    end

    subgraph Storage["DATABASE  (Supabase)"]
        direction LR
        PG["PostgreSQL\n10 tables + view"]
        Auth["Supabase Auth\n(future)"]
    end

    subgraph Hosting["HOSTING"]
        direction LR
        Vercel["Vercel\napps/web"]
        Railway["Railway\nbackend"]
        SupaCloud["Supabase Cloud\nDB + storage"]
    end

    Browser -->|HTTPS| Frontend
    ESP32HW --> Firmware
    PiHW -.-> Frontend

    Firmware -->|"HTTPS + Bearer token\nmbedTLS"| BackendLayer
    Frontend -->|"fetch() /api/*"| BackendLayer
    BackendLayer -->|"service role key"| Storage

    Frontend --- Vercel
    BackendLayer --- Railway
    Storage --- SupaCloud

    style Devices fill:#f0f0f0,stroke:#888
    style Firmware fill:#e8f4fd,stroke:#2980b9,color:#1a4a6b
    style Frontend fill:#fdebd0,stroke:#e67e22,color:#7d3c00
    style BackendLayer fill:#e8f8f0,stroke:#27ae60,color:#1a5c33
    style Storage fill:#f5eef8,stroke:#8e44ad,color:#4a1a6b
    style Hosting fill:#fdfefe,stroke:#aaa,color:#555
```

---

### How the Tools Connect

Which tool talks to which, and what role each plays.

```mermaid
flowchart LR
    subgraph Build["Build Tools"]
        PIO2["PlatformIO"] -->|compiles| CPP["Arduino C++\nmain.cpp"]
        Vite2["Vite"] -->|bundles| TSX["React + TSX\ncomponents"]
    end

    subgraph Firmware2["Firmware Runtime"]
        CPP -->|SPI bus| RC522["RC522\nreads UID"]
        CPP -->|calls| AJ["ArduinoJson\nbuild payload"]
        AJ -->|serialised JSON| TLS["mbedTLS\nencrypt + send"]
    end

    subgraph WebApp["Web App Runtime"]
        TSX --> CTX["CardContext\n(uid, balance, role)"]
        CTX --> API2["api.ts\nall fetch() calls"]
        API2 -->|"Content-Type: json\nx-card-uid (vendor routes)"| EXP
    end

    subgraph API["Backend Runtime"]
        TLS -->|"POST /api/tap\nAuthorization: Bearer"| EXP["Express\nrouter"]
        EXP --> ZOD["Zod middleware\nvalidate body"]
        ZOD --> BC["bcryptjs\npassword compare"]
        ZOD --> SB["supabase-js\nclient"]
        SB -->|"SQL"| PG2["PostgreSQL\nread + write"]
    end

    style Build fill:#f0f0f0,stroke:#999
    style Firmware2 fill:#e8f4fd,stroke:#2980b9
    style WebApp fill:#fdebd0,stroke:#e67e22
    style API fill:#e8f8f0,stroke:#27ae60
```

---

### Hosting & Deployment Map

Where each piece lives and how deployments are triggered.

```mermaid
flowchart LR
    GH["🐙 GitHub\nclaude_project repo"]

    GH -->|"push to main\nauto-deploy"| Vercel2["☁️ Vercel\napps/web\nnightmarket-web.vercel.app"]
    GH -->|"push to main\nauto-deploy"| Railway2["🚂 Railway\nbackend/\nclaudeproject-production-5b22.up.railway.app"]
    Railway2 -->|"service role key\n(server-side only)"| Supa2["🐘 Supabase\nPostgreSQL\nschema + migrations run manually"]

    Dev["💻 Local Dev"] -->|"USB flash\nPlatformIO"| ESP322["⚡ ESP32\nfirmware\nnightmarket-web → Railway → Supabase"]
    Dev -->|"SD card\nnpm run dev"| Pi2["🖥️ Raspberry Pi\napps/kiosk\n(local only)"]

    style GH fill:#f0f0f0,stroke:#555
    style Vercel2 fill:#fdebd0,stroke:#e67e22
    style Railway2 fill:#e8f8f0,stroke:#27ae60
    style Supa2 fill:#f5eef8,stroke:#8e44ad
    style ESP322 fill:#e8f4fd,stroke:#2980b9
    style Pi2 fill:#fff4cc,stroke:#b08800
```

---

## Data Model Overview

```mermaid
erDiagram
    cards ||--o{ tap_events : "taps"
    cards ||--o{ points_log : "transactions"
    cards ||--o{ campaign_progress : "enrolled in"
    cards ||--o{ vouchers : "holds"
    cards ||--o| vendors : "owns"

    vendors ||--o{ food_items : "menu"
    vendors ||--o{ tap_events : "receives"
    vendors ||--o{ subsidy_claims : "submits"

    campaigns ||--o{ campaign_progress : "tracked by"
    campaigns ||--o{ vouchers : "rewards"

    cards {
        varchar uid PK
        decimal points_balance
        integer calorie_limit
        varchar role
    }
    tap_events {
        uuid event_id PK
        varchar event_type
        jsonb metadata
        timestamptz server_timestamp
    }
    vouchers {
        uuid voucher_id PK
        decimal discount_value
        varchar status
    }
```

---

## Future / Parked Features

```mermaid
flowchart LR
    Now["✅ Current\nESP32 + RC522\nOnline-only\nSerial output\nBearer token auth"]
    Next["🟡 Next\nKiosk app\n(4 panels + NFC daemon)"]
    Parked["🔵 Parked\nMarket Selfie\nCamera on kiosk\nPhoto stored per card"]
    Future["⬜ Future\nAI Nutrition Advisor\nVendor Analytics Chat\nThermal printer receipt"]

    Now --> Next --> Parked --> Future

    style Now fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style Next fill:#fff4cc,stroke:#b08800,color:#7a5c00
    style Parked fill:#dce8ff,stroke:#3366cc,color:#1a3a7a
    style Future fill:#f0f0f0,stroke:#999,color:#444
```

### Market Selfie — Parked

Camera module on the Raspberry Pi kiosk captures a photo after each card tap. Stored as a "market memory" linked to the card UID. Could be displayed in the consumer app or emailed.

**Status:** Concept only — revisit when basic kiosk UI is complete.
**Hardware needed:** Pi Camera Module v3 (CSI) · Supabase Storage pipeline · optional thermal printer for printed photo ticket.

---

## Where to Find the Details

| Need | Document |
|---|---|
| Database schema (full SQL) | [TECHNICAL.md → Database](TECHNICAL.md) |
| API contracts + request/response shapes | [TECHNICAL.md → API](TECHNICAL.md) |
| Firmware loop + Serial states + provisioning | [TECHNICAL.md → Firmware](TECHNICAL.md) |
| Architecture decisions and trade-offs | [TECHNICAL.md → Decisions Log](TECHNICAL.md) |
| Setup, deployment, env vars | [README.md](README.md) |

---

*v2.3 · React + TypeScript + Express + PostgreSQL (Supabase) + Railway + Vercel + ESP32*
