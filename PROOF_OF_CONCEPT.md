# Smart Night Market — Proof of Engineering Concept
**What this document covers:** How the hardware and software communicate, how data moves through the system, and why the design choices are sound.

> For full specs → [TECHNICAL.md](TECHNICAL.md) · For visual overview → [MASTER_v2_refined.md](MASTER_v2_refined.md)

---

## 1. The Core Idea

A physical NFC card carries **only a UID** (unique identifier). All data — points, calories, vouchers — lives in the cloud database. The card is just a key.

```mermaid
flowchart LR
    Card["💳 Physical Card\nNTAG215\nStores: UID only\ne.g. '333F6C08'"]
    DB[("☁️ Cloud Database\nStores everything else:\npoints · calories\nvouchers · history")]
    Card <-->|"UID = lookup key"| DB

    style Card fill:#fdebd0,stroke:#e67e22
    style DB fill:#f5eef8,stroke:#8e44ad
```

**Why this works:**
- Card can never be corrupted (no writable data)
- Lost card = block the UID in the database, issue a new card
- Any card reader anywhere in the world works — no pairing, no sync

---

## 2. Hardware Communication — SPI Bus

The ESP32 reads the NFC card's UID through the RC522 reader using the **SPI (Serial Peripheral Interface)** protocol — a high-speed, 4-wire synchronous communication bus.

```mermaid
flowchart LR
    subgraph SPI["SPI Bus — 4 wires + RST"]
        ESP32["⚡ ESP32\n(SPI Master)"]
        RC522["📡 RC522\n(SPI Slave)"]

        ESP32 -->|"SCK GPIO18\nclock signal"| RC522
        ESP32 -->|"MOSI GPIO23\nmaster → slave data"| RC522
        RC522 -->|"MISO GPIO19\nslave → master data"| ESP32
        ESP32 -->|"SS GPIO21\nselect this device"| RC522
        ESP32 -->|"RST GPIO22\nhardware reset"| RC522
    end

    Card2["💳 NFC Card"] -.->|"13.56 MHz RF\n~4cm range"| RC522

    style ESP32 fill:#e8f4fd,stroke:#2980b9
    style RC522 fill:#d4f4dd,stroke:#2d8a4f
```

**What SPI gives us:**
- Full-duplex (send and receive at the same time)
- ~10 MHz clock — fast enough that a UID read takes ~50ms
- Deterministic timing — no bus contention on a single-device SPI bus

**How a card read works:**
```mermaid
sequenceDiagram
    participant ESP32
    participant RC522
    participant Card as 💳 NFC Card

    ESP32->>RC522: PICC_IsNewCardPresent()\n(polls via SPI)
    RC522->>Card: 13.56 MHz RF field\nISO 14443-A REQA command
    Card-->>RC522: ATQA response (card present)
    RC522-->>ESP32: true

    ESP32->>RC522: PICC_ReadCardSerial()
    RC522->>Card: Anti-collision + SELECT sequence
    Card-->>RC522: UID bytes (4–7 bytes)
    RC522-->>ESP32: uid.uidByte[] array

    ESP32->>ESP32: Convert bytes → uppercase hex\n"333F6C08"
```

---

## 3. Network Communication — HTTPS over WiFi

Once the UID is read, the ESP32 sends it to the cloud backend over **HTTPS** (HTTP with TLS encryption).

```mermaid
flowchart TD
    subgraph ESP32Side["ESP32 side"]
        UID["UID: '333F6C08'"] --> JSON["Serialise to JSON\nArduinoJson\nStaticJsonDocument&lt;256&gt;"]
        JSON --> TLS["Encrypt with mbedTLS\n(built into ESP32 silicon)"]
        TLS --> WIFI["WiFi radio\n802.11 b/g/n 2.4GHz"]
    end

    subgraph Internet["Network"]
        WIFI -->|"TCP/IP packets\nHTTPS port 443"| RAIL["Railway cloud server\nTLS termination"]
    end

    subgraph BackendSide["Backend side"]
        RAIL --> EXP["Express.js\nparse JSON body"]
        EXP --> ZOD["Zod schema\nvalidate + type-check"]
        ZOD --> LOGIC["Tap logic\nbusiness rules"]
        LOGIC --> SB["Supabase client\nSQL writes"]
    end

    style ESP32Side fill:#e8f4fd,stroke:#2980b9
    style Internet fill:#f0f0f0,stroke:#888
    style BackendSide fill:#d4f4dd,stroke:#2d8a4f
```

**Why HTTPS (not plain HTTP):**
- TLS encrypts everything — the Bearer token and card UID are never visible on the network
- ESP32 has **hardware TLS acceleration** (mbedTLS baked into the chip) — no performance cost
- Railway provides the server certificate automatically

**The request payload:**
```json
{
  "card_uid":         "333F6C08",
  "vendor_id":        "72f92f7e-efea-4e84-9eff-d916455d8e85",
  "food_id":          "7efa1b7c-3e54-4f8f-b8e0-37accb2263e5",
  "device_timestamp": "2026-04-28T14:32:01+08:00",
  "synced_from_queue": false
}
```
Total payload size: ~200 bytes — well within the StaticJsonDocument<256> buffer.

---

## 4. Full Data Journey — Tap to Response

End-to-end trace of what happens in the ~500ms between card tap and Serial output.

```mermaid
sequenceDiagram
    actor User as 👤 Consumer
    participant Card as 💳 Card
    participant ESP32 as ⚡ ESP32
    participant Backend as 🌐 Backend (Railway)
    participant DB as 🗄️ Supabase DB

    User->>Card: Physical tap (~4cm)
    Card-->>ESP32: UID via 13.56MHz RF → SPI

    Note over ESP32: ~50ms — SPI read

    ESP32->>ESP32: Build JSON payload
    ESP32->>+Backend: HTTPS POST /api/tap\nAuthorization: Bearer {token}

    Note over Backend: ~5ms — auth + validate

    Backend->>Backend: Check Bearer token ✅
    Backend->>Backend: Zod validate payload ✅
    Backend->>+DB: SELECT card, vendor, food_item
    DB-->>-Backend: rows

    Note over Backend,DB: ~30ms — DB reads

    Backend->>Backend: Check: duplicate? voucher? balance?
    Backend->>+DB: UPDATE balance\nINSERT tap_event\nINSERT points_log
    DB-->>-Backend: committed

    Note over Backend,DB: ~40ms — atomic writes

    Backend-->>-ESP32: 200 OK\n{ balance, calories, voucher, campaign }

    Note over ESP32: ~5ms — JSON parse

    ESP32-->>User: Serial.println\n"OK  -5.0pts  +560kcal\nBalance: 42.5pts"

    Note over User,ESP32: Total: ~300–600ms
```

---

## 5. Security Model

Three independent security layers protect the system.

```mermaid
flowchart TD
    subgraph L1["Layer 1 — Transport Security"]
        TLS2["TLS 1.2/1.3\nAll traffic encrypted in transit\nCard UID + token never visible on network"]
    end

    subgraph L2["Layer 2 — Terminal Authentication"]
        BT["Bearer Token\nPre-shared secret in ESP32 NVS\nVerified before any tap logic runs\n401 if missing or wrong"]
    end

    subgraph L3["Layer 3 — User Authentication"]
        BC["bcrypt (10 rounds)\nPasswords hashed server-side\nHash never returned in API response\nSlows brute-force attacks"]
        XV["x-card-uid header\nVendor routes require VENDOR role\nCard must own the vendor record"]
    end

    ATTACKER["🔴 Attacker"] -->|"sniff network"| L1
    ATTACKER -->|"fake tap POST"| L2
    ATTACKER -->|"impersonate user"| L3

    L1 -->|"protected by"| SAFE1["✅ Encrypted — unreadable"]
    L2 -->|"protected by"| SAFE2["✅ Rejected — 401"]
    L3 -->|"protected by"| SAFE3["✅ Rejected — 401/403"]

    style L1 fill:#e8f4fd,stroke:#2980b9
    style L2 fill:#d4f4dd,stroke:#2d8a4f
    style L3 fill:#fdebd0,stroke:#e67e22
    style ATTACKER fill:#fde8e8,stroke:#c0392b
    style SAFE1 fill:#d4f4dd,stroke:#2d8a4f
    style SAFE2 fill:#d4f4dd,stroke:#2d8a4f
    style SAFE3 fill:#d4f4dd,stroke:#2d8a4f
```

**Why NVS for the Bearer token:**
NVS (Non-Volatile Storage) is a key-value store in ESP32's flash memory. It survives power cycles and cannot be read without physical access to the chip and specialist tools. The token is never in the source code.

---

## 6. Data Validation Chain

Every piece of data is validated at the layer closest to its entry point.

```mermaid
flowchart LR
    subgraph HW["Hardware"]
        RC["RC522 hardware\nanti-collision protocol\nonly returns valid UID bytes"]
    end

    subgraph FW["Firmware"]
        HEX["Hex conversion\nfixed-width uppercase\ne.g. '0A' not 'A'"]
        TS["NTP timestamp\nISO 8601 format enforced\nby strftime()"]
    end

    subgraph API["Backend"]
        ZD["Zod schema\ntype + format check\nuuid · string length · boolean"]
        BL["Business logic\nduplicate check\nbalance check\nvoucher validity"]
        DB2["PostgreSQL constraints\nCHECK enums\nUNIQUE pairs\nON DELETE RESTRICT"]
    end

    RC --> HEX --> ZD
    TS --> ZD
    ZD -->|"✅"| BL
    BL -->|"✅"| DB2
    ZD -->|"❌ 400"| REJ1["Rejected early\nbefore any DB touch"]
    BL -->|"❌ 402/409"| REJ2["Rejected with\nspecific error code"]

    style REJ1 fill:#fde8e8,stroke:#c0392b
    style REJ2 fill:#fde8e8,stroke:#c0392b
    style DB2 fill:#f5eef8,stroke:#8e44ad
```

**Key principle:** Bad data is rejected at the earliest possible point — the hardware layer filters by physics, the firmware formats correctly, Zod rejects type errors, business logic rejects semantic errors, the database enforces structural integrity.

---

## 7. Data Storage Design

Why three separate stores, not one table.

```mermaid
flowchart TD
    subgraph Operational["Operational Store"]
        TE["tap_events\nOne row per tap\nImmutable — never updated\nWHAT happened + WHEN"]
    end

    subgraph Financial["Financial Audit Trail"]
        PL["points_log\nOne row per points movement\nImmutable — never updated\ndelta · reason · reference_id\nWHY balance changed"]
    end

    subgraph Live["Live State"]
        CB["cards.points_balance\nCurrent balance\nUpdated atomically on each tap\nSingle source of truth for balance"]
    end

    subgraph Reporting["Reporting View"]
        SS["subsidy_summary VIEW\nCalculated on the fly\nJOINs vouchers + campaigns + vendors\nNever stale — always current"]
    end

    TAP(["Card tap"]) --> TE
    TAP --> PL
    TAP --> CB

    TE -.->|"read for history"| APP["Web app / API"]
    PL -.->|"audit queries"| APP
    CB -.->|"balance checks"| APP
    SS -.->|"subsidy dashboard"| APP

    style Operational fill:#e8f4fd,stroke:#2980b9
    style Financial fill:#fdebd0,stroke:#e67e22
    style Live fill:#d4f4dd,stroke:#2d8a4f
    style Reporting fill:#f5eef8,stroke:#8e44ad
```

**Why immutable logs?**
- `tap_events` and `points_log` are append-only — rows are never deleted or updated
- This means any balance discrepancy can always be traced back to the exact tap that caused it
- `ON DELETE RESTRICT` on both tables prevents accidental cascade deletes

---

## 8. Atomic Writes — Why Nothing Gets Lost

The tap handler performs multiple database writes that must all succeed or all fail together.

```mermaid
flowchart TD
    START(["Tap validated\nready to commit"]) --> TXN

    subgraph TXN["Atomic sequence (all-or-nothing)"]
        W1["① UPDATE cards\npoints_balance -= final_cost"]
        W2["② UPDATE vouchers\nstatus = USED (if voucher applied)"]
        W3["③ INSERT tap_events\nfull event record"]
        W4["④ INSERT points_log\ndelta = -final_cost"]
        W1 --> W2 --> W3 --> W4
    end

    TXN -->|"✅ all succeed"| OK["200 OK response\nbalance confirmed"]
    TXN -->|"❌ any step fails"| ROLLBACK["All writes rolled back\nbalance unchanged\nno orphan records"]

    style TXN fill:#d4f4dd,stroke:#2d8a4f
    style ROLLBACK fill:#fde8e8,stroke:#c0392b
    style OK fill:#d4f4dd,stroke:#2d8a4f
```

**Campaign progress** is updated *outside* this atomic block — intentionally. If the campaign update fails, the purchase is already committed. A tap that deducted points but failed to update campaign progress is better than a tap that deducted points but was never recorded.

---

## 9. Timestamp Design — Why Two Clocks

```mermaid
flowchart LR
    subgraph DeviceClock["Device Clock (ESP32)"]
        NTP2["NTP sync\ntime.google.com\nfails gracefully if offline"]
        DT2["device_timestamp\nset by firmware\ncould be wrong if NTP failed"]
    end

    subgraph ServerClock["Server Clock (Railway)"]
        SC2["Express new Date()\nalways UTC-correct\nRailway's system clock"]
        ST2["server_timestamp\nset on arrival\nauthoritative for all logic"]
    end

    TAP2(["Tap arrives"]) --> ST2
    TAP2 --> DT2

    ST2 -->|"used for"| A["Duplicate tap check\nAudit trail\nCalorie totals\nAll business logic"]
    DT2 -->|"used for"| B["Informational only\nSynced event ordering\n(not currently used — online-only)"]

    style ST2 fill:#d4f4dd,stroke:#2d8a4f
    style DT2 fill:#fff4cc,stroke:#b08800
    style A fill:#d4f4dd,stroke:#2d8a4f
    style B fill:#fff4cc,stroke:#b08800
```

**The rule:** The server never trusts the client's timestamp for any decision. The device timestamp is recorded for information only — it cannot be manipulated to replay old taps or bypass the duplicate check.

---

## 10. Why Online-Only (No Offline Queue)

The original design included an offline queue (LittleFS on ESP32 flash). The current design is online-only. Here's the trade-off:

```mermaid
flowchart LR
    subgraph OfflineQ["Offline Queue (Original Design)"]
        OA["Card tap while WiFi down\n→ save to LittleFS flash"]
        OB["WiFi reconnects\n→ sync in batches of 10"]
        OC["Complexity:\nLittleFS management\nRTC for timestamps\nIdempotency keys\nSync conflict resolution"]
        OA --> OB --> OC
    end

    subgraph OnlineOnly["Online-Only (Current Design)"]
        NA["Card tap while WiFi down\n→ reject immediately"]
        NB["Serial: 'No connection — tap rejected'"]
        NC["Simplicity:\nNo flash storage needed\nNo RTC needed\nNo sync logic\nNo duplicate-on-replay risk"]
        NA --> NB --> NC
    end

    RISK_O["Risk: lost tap if WiFi drops\nVendor knows immediately\nvia Serial output"]
    RISK_N["Risk: lost sale during outage\nAcceptable for prototype\nNight market = short sessions"]

    OnlineOnly --> RISK_N
    OfflineQ --> RISK_O

    style OfflineQ fill:#fff4cc,stroke:#b08800
    style OnlineOnly fill:#d4f4dd,stroke:#2d8a4f
    style RISK_N fill:#d4f4dd,stroke:#2d8a4f
```

---

## 11. Web App ↔ Backend Communication

The web app communicates using the same REST/JSON API as the ESP32 — just from a browser instead of embedded firmware.

```mermaid
flowchart LR
    subgraph Browser["Browser (React app)"]
        CTX2["CardContext\nstores uid in localStorage"]
        API3["api.ts\ncentralised fetch() wrapper"]
        COMP["React components\ncall api.ts functions"]
        COMP --> API3 --> CTX2
    end

    subgraph Headers["Headers sent"]
        H1["Content-Type: application/json\n(all requests)"]
        H2["x-card-uid: {uid}\n(vendor-protected routes)"]
    end

    subgraph Response["Response handling"]
        SUC["success: true → return data"]
        ERR["success: false → throw Error(error code)"]
    end

    API3 -->|"HTTPS fetch()"| H1
    API3 --> H2
    H1 & H2 -->|"→ Railway API"| SUC & ERR

    style Browser fill:#fdebd0,stroke:#e67e22
    style Headers fill:#e8f4fd,stroke:#2980b9
    style SUC fill:#d4f4dd,stroke:#2d8a4f
    style ERR fill:#fde8e8,stroke:#c0392b
```

**Key design:** All 23 API functions live in one file (`src/lib/api.ts`). No component ever calls `fetch()` directly. This means:
- Auth headers are added in one place
- Error handling is consistent
- Easy to swap the base URL (dev vs prod)

---

## 12. Proof Summary

| Engineering Claim | How It Is Proved |
|---|---|
| Card UID is reliably read | RC522 ISO 14443-A anti-collision — hardware-level collision avoidance |
| Data is secure in transit | TLS 1.2/1.3 — ESP32 mbedTLS hardware acceleration |
| Fake taps are rejected | Bearer token auth — 401 before any DB access |
| Points cannot go negative | Balance check before any DB write — 402 if insufficient |
| Double-charging is impossible | Atomic duplicate check — same card + vendor + date → 409 |
| No data loss on write failure | Atomic DB sequence — all writes or none committed |
| Financial audit is complete | Immutable `points_log` — every delta recorded with reason + reference |
| Timestamps cannot be faked | `server_timestamp` set by Express `NOW()` — client value ignored |
| Vendor data is protected | `x-card-uid` header + role=VENDOR + ownership check before any write |
| Card compromise is recoverable | Set `is_active = false` — card rejected at tap, data preserved |

---

*PROOF_OF_CONCEPT.md — Smart Night Market v2.3*
*Cross-ref: [MASTER_v2_refined.md](MASTER_v2_refined.md) (visual) · [TECHNICAL.md](TECHNICAL.md) (full specs) · [README.md](README.md) (setup)*
