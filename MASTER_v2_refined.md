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
| 🧑 Consumer | nightmarket-web.vercel.app | Register card · top up points · tap at vendors · track calories · join campaigns · redeem vouchers |
| 🏪 Vendor | Same URL — vendor mode toggle | Register stall + SSM · upload food items · join campaigns · view subsidy dashboard · submit claims |
| 👤 Guest | Same URL | Browse vendors and map only |

---

## Diagram 1 — Website Setup

End-to-end view of the four website-side pieces (database, backend, frontend, network).
🟢 = done · 🟡 = scaffolded · 🔴 = not started

```mermaid
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

### Kiosk Journey (apps/kiosk) 🟡 Planned

```mermaid
flowchart LR
    Idle["🖥️ Idle Screen 🟡\nTap your card to begin"]
    Idle -->|"Card tapped"| KTap[/"📡 Record Visit  ✅ backend ready"/]
    KTap --> P2["👤 Card Summary 🟡\nname · balance · calories · vouchers"]
    P2 -->|button| P3["🎯 Campaigns 🟡\nview · join programs"]
    P2 -->|button| P4["🗺️ Market Map 🟡\nfind your stall"]
    P3 -.->|"Join button"| Enrol2[/"🎯 Join Campaign  ✅"/]
    P2 -->|"60 seconds no action"| Idle
    P3 -->|"60 seconds no action"| Idle
    P4 -->|"60 seconds no action"| Idle

    style Idle fill:#fff4cc,stroke:#b08800
    style P2 fill:#fff4cc,stroke:#b08800
    style P3 fill:#fff4cc,stroke:#b08800
    style P4 fill:#fff4cc,stroke:#b08800
```

> Backend route `POST /api/kiosk/tap` is implemented. The React UI panels and Python NFC daemon are not yet built.

---

## Diagram 3 — Hardware Setup (ESP32 Vendor Terminal)

### System Flow — From Power On to Card Tap Result

```mermaid
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
flowchart LR
    Card["💳 NFC Card\nCarries unique ID only"]

    subgraph Terminal["VENDOR TERMINAL ✅"]
        direction LR
        subgraph Reader["📡 RFID Reader"]
            RC["Detects card\nwirelessly"]
        end
        subgraph Controller["⚡ ESP32 Microcontroller"]
            FW["🧠 Firmware\nruns the system flow above"]
            NVS[("💾 On-device Config\nWiFi · Vendor · Auth token")]
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
flowchart LR
    GH["🐙 GitHub\nSource Code Repository"]

    GH -->|"Code push\nauto deploys"| Vercel2["☁️ Vercel\nWeb App\nnightmarket-web.vercel.app"]
    GH -->|"Code push\nauto deploys"| Railway2["🚂 Railway\nBackend API\nclaudeproject-production-5b22.up.railway.app"]
    Railway2 -->|"Secure connection\nserver side only"| Supa2["🐘 Supabase\nCloud Database\nschema applied manually"]

    Dev["💻 Developer Machine"] -->|"USB cable\nflash firmware"| ESP322["⚡ ESP32\nVendor Terminal\nconnects to Railway + Supabase"]
    Dev -->|"SD card setup\nruns locally"| Pi2["🖥️ Raspberry Pi\nKiosk — local only"]

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
flowchart LR
    Now["✅ Completed\nVendor Terminal\nOnline tap & pay\nSecure authentication"]
    Next["🟡 Next Up\nDirectory Kiosk\n4 screen panels\nNFC card reader"]
    Parked["🔵 On Hold\nMarket Selfie\nCamera at kiosk\nPhoto memory per visit"]
    Future["⬜ Ideas\nAI Nutrition Advisor\nVendor Sales Chat\nPrinted receipt"]

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
