# WarungTek (Smart Night Market) — Master Overview
**Version 3.0 (WarungTek Phase 1)** · [Technical specs → TECHNICAL.md](TECHNICAL.md) · [Setup → README.md](README.md)

> Project renamed from NightMarket → **WarungTek** in May 2026 as part of a Figma-driven redesign. Three roles now supported: Consumer, Vendor, Admin (Authority).

A unified night market platform: consumers tap a physical NFC card at vendor stalls to spend points, track calories, and earn campaign vouchers. Vendors register their stall (with admin approval), upload menu items with load-cell weight-based pricing, manage compliance documents, and claim government subsidies. Authority admins approve vendor applications, manage stall allocation, and review compliance. A kiosk acts as a digital directory.

---

## Build Progress

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    subgraph P1["✅ PHASE 1 — CORE"]
        direction TB
        DB["🗄️ Database\n10 tables live"]
        BE["⚙️ Backend API\nRender — all routes"]
        FE["🌐 Web App\nVercel — 13 pages"]
        HW["⚡ ESP32 Firmware\nRC522 + Load Cell + Bearer auth"]
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
        VPA["📱 Vendor App\nseparate onboarding app"]
    end
    subgraph P4["✅ PHASE 4 — AI & KIOSK"]
        direction TB
        AI["🤖 AI Features\nChat + Meal Advisor\nGemini 2.0 Flash"]
        KUI["🖥️ Kiosk UI\n8 panels built\nNFC polling"]
        KDM["🐍 NFC Daemon\nPN532 I2C — complete"]
    end

    P1 --> P2 --> P3 --> P4

    style P1 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style P2 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style P3 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style P4 fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
```

---

## Component Status

| Component | Status | Live URL |
|---|---|---|
| 🗄️ Database (Supabase) | ✅ Live | — |
| ⚙️ Backend API (Render) | ✅ Live | `warungtek-backend.onrender.com` |
| 🌐 Consumer + Vendor Web App | ✅ Live | `nightmarket-web.vercel.app` |
| 📱 Vendor Onboarding App | ✅ Built | `apps/vendor` — local / to be deployed |
| ⚡ ESP32 Vendor Terminal | ✅ Tested end-to-end | On-device |
| 🖥️ Kiosk App (Raspberry Pi) | 🟢 8 panels built | Runs locally on Pi |
| 🐍 NFC Daemon (Raspberry Pi) | ✅ Complete | `localhost:5001` on Pi |
| 🤖 AI Features | ✅ Chat + Meal Advisor | Via Gemini 2.0 Flash |

---

## Physical Surfaces

| Surface | Hardware | Status |
|---|---|---|
| Consumer website | Any browser | ✅ Live |
| Vendor portal (web mode toggle) | Any browser (same URL) | ✅ Live |
| Vendor onboarding app | Any browser (`apps/vendor`) | ✅ Built |
| Vendor terminal | ESP32 DevKit v1 + RC522 RFID + Load Cell | ✅ Active |
| Digital directory kiosk | Raspberry Pi 4 + PN532 NFC | 🟢 Panels built — needs QR top-up + UID normalization |

---

## User Roles

| Role | Access | Key Actions |
|---|---|---|
| 🧑 Consumer | nightmarket-web.vercel.app | Register card · top up points · tap at vendors · track calories · join campaigns · redeem vouchers |
| 🏪 Vendor | Same URL — vendor mode toggle | Register stall + SSM · upload food items · join campaigns · view subsidy dashboard · submit claims |
| 👤 Guest | Same URL | Browse vendors and map only |

---

## Diagram 1 — Website Setup

End-to-end view of the four website-side pieces (database, backend, frontend, network).
🟢 = done · 🟡 = scaffolded · 🔴 = not started

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart TB
    subgraph Clients["DEVICES"]
        direction LR
        Phone["📱 Consumer\nPhone / Browser ✅"]
        VendorBrowser["💻 Vendor\nBrowser ✅"]
        ESP32["⚡ ESP32\nVendor Terminal ✅"]
        PiKiosk["🖥️ Raspberry Pi 4\nKiosk 🟡"]
    end

    subgraph Frontend["FRONTEND ✅  —  Vercel"]
        direction TB
        Web["🌐 Consumer + Vendor Web App ✅\nnightmarket-web.vercel.app  ·  13 pages"]
        Kiosk["🖥️ Directory Kiosk App 🟡\n4 panels — not yet built"]
    end

    subgraph Backend["BACKEND ✅  —  Railway"]
        direction TB
        Mid["🔀 Request Handler\nvalidation · security · routing"]
        Auth1["🔒 Access Control ✅\nvendor identity · terminal token"]
    end

    subgraph Database["DATABASE ✅  —  Supabase"]
        direction TB
        DB[("🗄️ PostgreSQL\n10 tables  ·  live report view")]
    end

    Phone -->|"Secure HTTPS"| Web
    VendorBrowser -->|"Secure HTTPS"| Web
    ESP32 -->|"Secure HTTPS\n+ Auth Token"| Mid
    PiKiosk -.->|"Planned"| Kiosk
    Web -->|"API requests"| Mid
    Kiosk -.-> Mid
    Mid --> Auth1
    Auth1 -->|"Secure connection"| DB

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
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    Start(["🌐 Open Web App"])
    Start --> Land["🏠 Landing Page ✅\nSign in with email + password"]
    Land -->|New user| Reg["📝 Register ✅\nConsumer or Vendor toggle"]
    Land -->|Sign in| AuthCheck{"🔐 Login Check"}
    Reg -->|Create account| AuthCheck
    AuthCheck -->|❌ Wrong credentials| Land
    AuthCheck -->|✅ Success| Dash["📊 My Dashboard ✅\npoints balance · calories · history"]

    Dash -->|tab| Cal["🥗 Calorie Tracker ✅\nmacros · BMR calculator · daily limit"]
    Dash -->|tab| Camp["🎯 Campaigns ✅\nprograms · vouchers collected"]
    Dash -->|tab| Vend["🏪 Vendors ✅\nsearch · food items · macros"]
    Dash -->|tab| Map["🗺️ Market Map ✅\nstall grid layout"]
    Dash -->|tab| NFC["💳 My Card ✅\ncard status · active promotions"]
    Dash -->|tab| Set["⚙️ Settings ✅"]

    Dash -.->|"Top Up button"| Topup[/"💰 Add Points"/]
    Camp -.->|"Enrol button"| Enrol[/"🎯 Join Campaign"/]
    Cal -.->|"Save limit"| Limit[/"✏️ Update Daily Limit"/]
    Vend -.->|"View stall"| VFood[/"🍽️ View Food Menu"/]
    Set -->|Sign out| Land
```

### Vendor Journey (apps/web — vendor mode) ✅

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    Start(["🏪 Vendor Sign In"]) --> AuthV["🔐 Vendor Login ✅\ncard UID + password"]
    AuthV -->|Vendor account| Toggle["🔀 Mode Toggle Appears ✅"]
    Toggle -->|Switch to vendor| VDash["🏠 Vendor Home ✅\nbusiness info · total subsidies"]

    VDash -->|tab| VInfo["📋 Stall Information ✅\nlocation on map · food menu"]
    VDash -->|tab| VCamp["🎯 Campaigns ✅\njoin programs"]
    VDash -->|tab| VClaim["📄 Submit Claim ✅\nselect date range · submit"]
    VDash -->|tab| VSum["💰 Subsidy Summary ✅\nearnings per campaign"]

    VInfo -.->|"Add item button"| AddFood[/"🍽️ Add Food Item"/]
    VClaim -.->|"Submit button"| Claim[/"📤 Submit Subsidy Claim"/]
    VSum -.->|"Page load"| Sum[/"📊 Load Earnings Summary"/]
    VDash -->|Switch back| CDash["👤 Consumer Mode"]
```

### Kiosk Journey (apps/kiosk) ✅ Built

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    Home["🖥️ Home Screen ✅\nNFC polling · quick nav · emergency"]
    Home -->|"Card tapped (NFC daemon)"| NfcTap[/"📡 GET /api/cards/:uid · GET /api/campaigns"/]
    NfcTap --> Card["👤 Card Panel ✅\nname · balance · calorie bar · promotions"]
    Card -->|button| Camp["🎯 Campaigns ✅\nenrol programs"]
    Card -->|button| Map["🗺️ Market Map ✅\nstall grid · kiosk markers"]
    Card -->|button| Cal["🥗 Calorie Limit ✅\nset limit · get AI meal suggestions"]
    Card -->|button| Food["🍛 Food Browser ✅\nsearch food · navigate to stall"]
    Card -->|button| TopUp["💳 Top Up ⚠️\nQR placeholder — wiring pending"]
    Cal -->|"AI call"| Meal["🤖 Meal Suggestions ✅\n3 AI picks · navigate to stall"]
    Card -->|"Directory Rebate button"| Rebate[/"📡 POST /api/kiosk/tap"/]
    Card -->|"60 s idle"| Home
    Camp -->|"60 s idle"| Home

    Camp -.->|"Join button"| Enrol[/"📡 POST /api/campaigns/:id/enrol"/]

    style Home fill:#d4f4dd,stroke:#2d8a4f
    style Card fill:#d4f4dd,stroke:#2d8a4f
    style Camp fill:#d4f4dd,stroke:#2d8a4f
    style Map fill:#d4f4dd,stroke:#2d8a4f
    style Cal fill:#d4f4dd,stroke:#2d8a4f
    style Food fill:#d4f4dd,stroke:#2d8a4f
    style Meal fill:#d4f4dd,stroke:#2d8a4f
    style TopUp fill:#fff4cc,stroke:#b08800
```

> All panels built. Three open items: (1) TopUpPanel QR code needs a real URL, (2) MealSuggestionPanel stall navigation needs vendor_id in AI response, (3) NFC UID format from daemon (colon-separated) must be normalized to match cards stored via ESP32 (no colons).

---

## Diagram 3 — Hardware Setup (ESP32 Vendor Terminal)

### System Flow — From Power On to Card Tap Result

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    S([▶ Start]) --> INIT[System\nInitialisation]
    INIT --> SCAN[Card Read\nCycle]
    SCAN --> PROC[Microcontroller\nMain Loop]
    PROC --> DISP[Update\nResult]
    DISP --> RESET[Reset\nCycle]
    RESET -->|loop back| SCAN

    %% ── Initialisation branch ──────────────────────────────
    INIT --> D1{Settings\nready?}
    D1 -->|no| HALT(["⛔ System Halt\nRe-provision device"])
    D1 -->|yes| D2{WiFi\nconnected?}
    D2 -->|no| RETRY(["↺ Retry\nconnection"])
    RETRY --> D2
    D2 -->|yes| SCAN

    %% ── Card scan branch ───────────────────────────────────
    SCAN --> D3{Card\ndetected?}
    D3 -->|no| SCAN
    D3 -->|yes| PROC

    %% ── Main loop branch ───────────────────────────────────
    PROC --> D4{Terminal\nauthorised?}
    D4 -->|no| E1(["🔴 Access Denied\ninvalid token"])
    D4 -->|yes| D5{Card active\n& has points?}
    D5 -->|no| E2(["🔴 Show Error\nno points · already visited\ncard not found"])
    D5 -->|yes| SAVE["Save Transaction\ndeduct points · log calories\nupdate campaign"]

    SAVE --> DISP

    %% ── Result branch ──────────────────────────────────────
    DISP --> D6{Success?}
    D6 -->|yes| OK(["🟢 Show Result\npoints spent · calories added\nnew balance"])
    D6 -->|no| FAIL(["🔴 Show Reason\nspecific error message"])

    OK --> RESET
    FAIL --> RESET
    E1 --> RESET
    E2 --> RESET

    style S fill:#d4f4dd,stroke:#2d8a4f
    style INIT fill:#e8f4fd,stroke:#2980b9
    style SCAN fill:#e8f4fd,stroke:#2980b9
    style PROC fill:#e8f4fd,stroke:#2980b9
    style DISP fill:#e8f4fd,stroke:#2980b9
    style RESET fill:#e8f4fd,stroke:#2980b9
    style SAVE fill:#d4f4dd,stroke:#2d8a4f
    style OK fill:#d4f4dd,stroke:#2d8a4f
    style HALT fill:#fde8e8,stroke:#c0392b
    style E1 fill:#fde8e8,stroke:#c0392b
    style E2 fill:#fde8e8,stroke:#c0392b
    style FAIL fill:#fde8e8,stroke:#c0392b
    style RETRY fill:#fff4cc,stroke:#b08800
```

### What Each Stage Does

| Stage | What Happens |
|---|---|
| **System Initialisation** | Load saved settings (WiFi, vendor ID, auth token), connect to WiFi, sync clock |
| **Card Read Cycle** | Continuously poll the RFID reader — wait until a card is tapped |
| **Microcontroller Main Loop** | Read card ID, verify with backend, check balance, save the transaction |
| **Update Result** | Show success or reason for failure |
| **Reset Cycle** | Clear the reader, wait 2 seconds to prevent double-taps, then scan again |

### Hardware Communication Path ✅

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    Card["💳 NFC Card\nCarries unique ID only"]

    subgraph Terminal["VENDOR TERMINAL ✅"]
        direction LR
        subgraph Reader["📡 RFID Reader"]
            RC["Detects card\nwirelessly"]
        end
        subgraph Scale["⚖️ Load Cell (GPIO34)"]
            LC["Measures serving weight\n(grams) before tap"]
        end
        subgraph Controller["⚡ ESP32 Microcontroller"]
            FW["🧠 Firmware\nruns the system flow above"]
            NVS[("💾 On-device Config\nWiFi · Vendor · Auth token\nscale_factor · tare_offset")]
            WiFi["📶 Secure WiFi\nencryption built into chip"]
        end
    end

    Backend[/"☁️ Backend API ✅\nVerify · Process · Respond"/]
    Supabase[("🗄️ Cloud Database ✅")]

    Card -.->|"Tap"| RC
    RC -->|"Wired"| FW
    NVS -->|"Loaded on boot"| FW
    FW --> WiFi
    WiFi -->|"Authenticated request"| Backend
    Backend <--> Supabase
    Backend -->|"Points · calories · status"| WiFi

    style Terminal fill:#d4f4dd,stroke:#2d8a4f
    style Backend fill:#d4f4dd,stroke:#2d8a4f
    style Supabase fill:#d4f4dd,stroke:#2d8a4f
    style Reader fill:#e8f4fd,stroke:#2980b9
    style Controller fill:#e8f8f0,stroke:#27ae60
```

---

## Diagram 4 — Tech Stack & Tool Relationships

### Layer Architecture

How each technology is positioned in the stack — from device hardware up to cloud hosting.

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart TB
    subgraph Devices["DEVICES"]
        direction LR
        Browser["🌐 Browser\nany device"]
        ESP32HW["⚡ ESP32 DevKit v1\nVendor Terminal"]
        PiHW["🖥️ Raspberry Pi 4\nKiosk"]
    end

    subgraph Firmware["FIRMWARE  —  ESP32"]
        direction LR
        PIO["PlatformIO\nBuild System"]
        ArduinoFW["Arduino Framework\nC++ Language"]
        MFRC522Lib["RFID Library\nCard Reader Driver"]
        AJson["JSON Library\nData Serialiser"]
        mbedTLS["Encryption Library\nBuilt into Chip"]
    end

    subgraph Frontend["FRONTEND  —  Vercel"]
        direction LR
        Vite["Vite\nBuild & Dev Server"]
        React["React 19\nUI Framework"]
        TS["TypeScript\nType Safety"]
        Tailwind["Tailwind CSS\nStyling"]
        RR["React Router\nPage Navigation"]
        Context["Card Session\nGlobal State"]
        Recharts["Charts\nCalorie Graph"]
    end

    subgraph BackendLayer["BACKEND  —  Railway"]
        direction LR
        Express["Express\nHTTP Server"]
        Zod["Zod\nInput Validation"]
        Bcrypt["Bcrypt\nPassword Security"]
        SupaJS["Supabase Client\nDatabase Connector"]
    end

    subgraph Storage["DATABASE  —  Supabase"]
        direction LR
        PG["PostgreSQL\n10 tables  ·  live view"]
        Auth["Supabase Auth\nFuture upgrade"]
    end

    subgraph Hosting["HOSTING"]
        direction LR
        Vercel["☁️ Vercel\nWeb App"]
        Railway["🚂 Railway\nBackend"]
        SupaCloud["🐘 Supabase Cloud\nDatabase"]
    end

    Browser -->|"Secure HTTPS"| Frontend
    ESP32HW --> Firmware
    PiHW -.-> Frontend

    Firmware -->|"Secure HTTPS\nwith Auth Token"| BackendLayer
    Frontend -->|"API requests"| BackendLayer
    BackendLayer -->|"Secure connection"| Storage

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
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    subgraph Build["Build Tools"]
        PIO2["PlatformIO\nFirmware Builder"] -->|compiles| CPP["Firmware Code\nC++ Language"]
        Vite2["Vite\nWeb Builder"] -->|bundles| TSX["Web Components\nReact + TypeScript"]
    end

    subgraph Firmware2["Firmware  —  On Device"]
        CPP -->|"hardware wire"| RC522["RFID Reader\nreads card ID"]
        CPP -->|"calls"| AJ["JSON Builder\nformats data"]
        AJ -->|"prepared data"| TLS["Encryption Layer\nsecures & sends"]
    end

    subgraph WebApp["Web App  —  In Browser"]
        TSX --> CTX["Card Session\nstores identity · balance · role"]
        CTX --> API2["API Client\nhandles all server requests"]
        API2 -->|"secure headers"| EXP
    end

    subgraph API["Backend  —  Railway"]
        TLS -->|"authenticated tap request"| EXP["HTTP Server\nroutes requests"]
        EXP --> ZOD["Input Validator\nchecks all incoming data"]
        ZOD --> BC["Password Checker\nverifies login"]
        ZOD --> SB["Database Client\nreads & writes data"]
        SB -->|"database query"| PG2["PostgreSQL\nstores everything"]
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
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    GH["🐙 GitHub\nSource Code Repository"]

    GH -->|"Code push\nauto deploys"| Vercel2["☁️ Vercel\nWeb App\nnightmarket-web.vercel.app"]
    GH -->|"Code push\nauto deploys"| Render2["🎨 Render\nBackend API\nwarungtek-backend.onrender.com"]
    Render2 -->|"Secure connection\nserver side only"| Supa2["🐘 Supabase\nCloud Database\nschema applied manually"]

    Dev["💻 Developer Machine"] -->|"USB cable\nflash firmware"| ESP322["⚡ ESP32\nVendor Terminal\nconnects to Railway + Supabase"]
    Dev -->|"SD card setup\nruns locally"| Pi2["🖥️ Raspberry Pi\nKiosk — local only"]

    style GH fill:#f0f0f0,stroke:#555
    style Vercel2 fill:#fdebd0,stroke:#e67e22
    style Render2 fill:#e8f8f0,stroke:#27ae60
    style Supa2 fill:#f5eef8,stroke:#8e44ad
    style ESP322 fill:#e8f4fd,stroke:#2980b9
    style Pi2 fill:#fff4cc,stroke:#b08800
```

---

## Data Model Overview

```mermaid
erDiagram
    CARD ||--o{ TAP_EVENT : "makes"
    CARD ||--o{ POINTS_LOG : "recorded in"
    CARD ||--o{ CAMPAIGN_PROGRESS : "enrolled in"
    CARD ||--o{ VOUCHER : "holds"
    CARD ||--o| VENDOR : "owns"

    VENDOR ||--o{ FOOD_ITEM : "sells"
    VENDOR ||--o{ TAP_EVENT : "receives"
    VENDOR ||--o{ SUBSIDY_CLAIM : "submits"

    CAMPAIGN ||--o{ CAMPAIGN_PROGRESS : "tracked by"
    CAMPAIGN ||--o{ VOUCHER : "rewards"

    CARD {
        string Card_ID PK
        number Points_Balance
        number Daily_Calorie_Limit
        string Role
    }
    TAP_EVENT {
        string Event_ID PK
        string Type
        number Calories
        number Cost
        datetime When
    }
    VOUCHER {
        string Voucher_ID PK
        number Discount_Value
        string Status
    }
```

---

## Future / Parked Features

```mermaid
%%{init: {"flowchart": {"curve": "linear"}} }%%
flowchart LR
    Now["✅ Completed\nVendor Terminal + Load Cell\nKiosk 8 panels\nAI Chat + Meal Advisor\nVendor Onboarding App"]
    Fix["🟡 Fix Needed\nKiosk TopUp QR code\nMeal → stall navigation\nUID format normalization"]
    Parked["🔵 On Hold\nMarket Selfie\nCamera at kiosk\nPhoto memory per visit"]
    Future["⬜ Ideas\nVendor Sales Chat\nPrinted receipt\nLoad cell auto-calibration UI"]

    Now --> Fix --> Parked --> Future

    style Now fill:#d4f4dd,stroke:#2d8a4f,color:#1a5c33
    style Fix fill:#fff4cc,stroke:#b08800,color:#7a5c00
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

*v2.4 · React + TypeScript + Express + PostgreSQL (Supabase) + Render + Vercel + ESP32 + Raspberry Pi + Gemini 2.0 Flash*
