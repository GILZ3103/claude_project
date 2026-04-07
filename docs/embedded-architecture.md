# Embedded System Architecture — Vendor Terminal (ESP32)

> **Status: Awaiting Hardware**
> This document is finalized and approved. Implementation is blocked pending physical components.
> Do NOT begin firmware or backend changes until hardware is confirmed.

---

## Context

The original design specified an ESP8266 sending HTTPS REST calls for every NFC tap.
A technical review identified 4 critical flaws that would cause production failure:

1. **TLS Latency** — ESP8266 has no hardware crypto acceleration → 1–2.5s blocking delay per tap (unacceptable at POS)
2. **RTC Failure** — No physical RTC → power loss while offline resets clock to Unix epoch, corrupting all queued timestamps
3. **OOM on Sync** — Offline sync sends one giant JSON array → heap exhaustion crash on 40–50KB ESP8266 RAM
4. **MAC Spoofing** — MAC address used as device identity → trivially spoofable, no cryptographic integrity

All 4 are resolved in this architecture.

---

## Decision Summary

| Problem | Decision | Rationale |
|---|---|---|
| TLS latency | **Upgrade to ESP32** | Hardware AES/SHA acceleration, TLS handshake ~200ms |
| Protocol | **Keep HTTPS REST** | MQTT rejected — requires broker infra; moot once ESP32 is fast |
| RTC | **DS3231 over I2C + CR2032** | Survives power loss, maintains correct time offline |
| Offline sync | **Chunked 10 events/POST** | Fits in heap; deletes from LittleFS only on ACK |
| Device identity | **Pre-shared Bearer token in NVS** | Cryptographically secure; MAC address retired |
| Double-charge | **`txn_id` = SHA256(uid + timestamp)** | UNIQUE constraint on DB; idempotent 200 OK on retry |

---

## Required Hardware (per vendor terminal)

| Component | Part | Interface |
|---|---|---|
| Microcontroller | ESP32 DevKit v1 | — |
| NFC Reader | PN532 module | SPI |
| Real-Time Clock | DS3231 module | I2C |
| RTC Battery | CR2032 coin cell | — |
| Display | 0.96" OLED 128×64 (SSD1306) | I2C |
| Status LED | Built-in GPIO2 | GPIO |

### Pin Assignments (ESP32 DevKit)

| Module | Interface | Pins |
|---|---|---|
| PN532 NFC | SPI | SS=5, MOSI=23, MISO=19, SCK=18 |
| DS3231 RTC | I2C | SDA=21, SCL=22 |
| OLED 128×64 | I2C | SDA=21, SCL=22 (shared I2C bus) |
| Status LED | GPIO | GPIO2 (onboard) |

---

## Arduino Libraries Required

Install via Arduino Library Manager before building:

| Library | Purpose |
|---|---|
| `Adafruit_PN532` | NFC reader driver |
| `RTClib` (Adafruit) | DS3231 RTC driver |
| `ArduinoJson` v6 | JSON serialization/deserialization |
| `Adafruit_SSD1306` | OLED display driver |
| `Adafruit_GFX` | Graphics dependency for SSD1306 |
| `LittleFS` | Offline queue storage (built into ESP32 Arduino core ≥2.x) |
| `WiFiClientSecure` | HTTPS/TLS (built into ESP32 Arduino core) |
| `Preferences` | NVS read/write (built into ESP32 Arduino core) |
| `mbedtls/sha256.h` | SHA256 for txn_id (built into ESP32 Arduino core) |

---

## What Gets Built

### Database Changes — `database/migrations/003_device_tokens.sql`

```sql
-- Device token table: one row per physical ESP32 terminal
CREATE TABLE device_tokens (
    token_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id     UUID REFERENCES vendors(vendor_id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL UNIQUE,   -- bcrypt(10) hash of raw token
    label         VARCHAR(100),                   -- e.g. "Stall 1 terminal"
    is_active     BOOLEAN DEFAULT TRUE,
    issued_at     TIMESTAMPTZ DEFAULT NOW(),
    last_used_at  TIMESTAMPTZ
);
CREATE INDEX ON device_tokens(vendor_id);

-- Idempotency key: prevents double-charge on network retry
ALTER TABLE tap_events
  ADD COLUMN IF NOT EXISTS txn_id VARCHAR(64) UNIQUE;

-- TECH DEBT: VARCHAR(64) UNIQUE = B-tree index on 64-char string.
-- Acceptable for MVP (<100k rows). Migrate to BYTEA(32) post-pilot to halve index size.
```

---

### Backend Changes

#### New: `backend/src/middleware/deviceAuth.ts`

Validates `Authorization: Bearer <token>` header on every embedded device request:
- Extracts token from header
- bcrypt-compares against `device_tokens.token_hash`
- Returns `401` if missing/invalid, `403` if `is_active = false`
- Attaches `vendor_id` to `req` for downstream handlers
- Updates `last_used_at` on success

#### New: `backend/src/routes/devices.ts`

```
POST /api/devices/provision
  Header: x-card-uid  (must be VENDOR role owning vendor_id)
  Body:   { vendor_id: uuid, label: string }
  Action: crypto.randomBytes(32) → raw token, bcrypt hash → insert to device_tokens
  Returns: { token: "<64-char hex — shown ONCE, never stored>", token_id, vendor_id }

DELETE /api/devices/:token_id/revoke
  Header: x-card-uid  (VENDOR role check)
  Action: device_tokens.is_active = false
```

#### Update: `backend/src/routes/tap.ts`

**`POST /api/tap`** — add `deviceAuth` middleware, add `txn_id` to schema and INSERT:

```typescript
const tapSchema = z.object({
  card_uid:          z.string().min(4).max(20),
  vendor_id:         z.string().uuid(),
  food_id:           z.string().uuid(),
  device_timestamp:  z.string(),
  txn_id:            z.string().length(64),      // SHA256(card_uid + device_timestamp)
  synced_from_queue: z.boolean().default(false)
})
```

`processTap()` changes:
- Accept `txn_id`, include in `tap_events` INSERT
- Catch Supabase error code `23505` (unique_violation):
  - Return `200 OK { success: true, data: { idempotent: true } }`
  - Do NOT deduct points again, do NOT write points_log again
  - ESP32 receives 200 → deletes event from LittleFS (self-corrects)

**`POST /api/tap/sync`** — replace MAC auth with token auth, add chunking + txn_id:

```typescript
const syncSchema = z.object({
  events: z.array(z.object({
    card_uid:         z.string().min(4).max(20),
    food_id:          z.string().uuid(),
    device_timestamp: z.string(),
    txn_id:           z.string().length(64)
  })).max(10)    // hard chunk limit — prevents OOM
})
```

- `terminal_mac` field removed entirely
- `deviceAuth` middleware identifies vendor (not MAC)
- Each event processed via `processTap()`; idempotent 200s count as `processed`
- Returns `{ processed, skipped }` on any 200 → ESP deletes chunk

#### Update: `backend/src/index.ts`

```typescript
import devicesRouter from './routes/devices'
app.use('/api/devices', devicesRouter)
```

---

### Firmware — `firmware/vendor-terminal/`

#### File Structure

```
firmware/vendor-terminal/
├── vendor_terminal.ino        ← main sketch: setup() + loop()
├── config.h                   ← API_URL, NVS key names, CHUNK_SIZE = 10
├── nfc_reader.cpp / .h        ← PN532 SPI: readCardUID(), init()
├── rtc_module.cpp / .h        ← DS3231 I2C: getISOTimestamp(), syncFromNTP()
├── wifi_manager.cpp / .h      ← connect(), reconnect(), isOnline()
├── api_client.cpp / .h        ← postTap(), syncQueue(), loadToken()
├── offline_queue.cpp / .h     ← LittleFS FIFO: enqueue(), dequeueChunk(n), deleteChunk()
└── display.cpp / .h           ← OLED: showBalance(), showError(), showCalorieWarning()
```

#### NVS Keys (written once at provisioning)

| Key | Value | How set |
|---|---|---|
| `api_token` | 64-char hex raw token | Serial provisioning |
| `vendor_id` | UUID string | Serial provisioning |
| `food_id` | Default menu item UUID | Serial provisioning |
| `wifi_ssid` | Network name | Serial provisioning |
| `wifi_pass` | Network password | Serial provisioning |

#### txn_id Generation (memory-safe)

```cpp
#include "mbedtls/sha256.h"

// Stack-allocated output — avoids 32x heap fragmentation from String += in a loop
String generateTxnId(const char* card_uid, const char* device_timestamp) {
  char input[64];
  snprintf(input, sizeof(input), "%s%s", card_uid, device_timestamp);

  uint8_t hash[32];
  mbedtls_sha256((uint8_t*)input, strlen(input), hash, 0);

  char hexOutput[65];  // stack: 64 chars + null terminator
  for (int i = 0; i < 32; i++) {
    sprintf(&hexOutput[i * 2], "%02x", hash[i]);
  }
  return String(hexOutput);  // single heap allocation
}
```

> DS3231 has 1-second resolution. `txn_id = SHA256(same_uid + same_second)` would be identical for two taps in the same second, causing the second to be silently dropped. Prevented by the 1.5s PN532 block below.

#### 1.5s Tap Block (prevents txn_id collision)

After every tap (online response received OR event enqueued offline):

```cpp
pn532.setPassiveActivationRetries(0);   // stop polling PN532
delay(1500);                             // 1.5s cooldown
pn532.setPassiveActivationRetries(0xFF); // re-enable
```

This guarantees no two taps from the same card share the same second-level timestamp.

#### Core Firmware Flow

```
setup():
  1. Init Serial (115200), NVS, LittleFS
  2. Init SPI → PN532, init I2C → DS3231 + OLED
  3. Load api_token, vendor_id, food_id from NVS
  4. Connect WiFi → if online: DS3231.syncFromNTP()
  5. If LittleFS queue not empty → syncQueue()

loop():
  1. uid = PN532.readCardUID()  ← non-blocking poll
  2. If uid detected:
     a. ts  = DS3231.getISOTimestamp()       // "2026-04-07T20:15:00+08:00"
     b. txn = generateTxnId(uid, ts)         // SHA256 hex, 64 chars
     c. If WiFi online:
          response = POST /api/tap {
            card_uid, vendor_id, food_id,
            device_timestamp: ts,
            txn_id: txn,
            synced_from_queue: false
          }
          Header: Authorization: Bearer <api_token>
          OLED.showBalance(response.points_balance_remaining)
          If response.calorie_warning → OLED.showCalorieWarning()
          If response.campaign_completed → OLED.showCampaignBadge()
        Else (offline):
          LittleFS.enqueue({ card_uid, food_id, ts, txn })
          OLED.show("Saved offline (#N queued)")
     d. Apply 1.5s PN532 block (anti-collision)
  3. If WiFi just reconnected → syncQueue()

syncQueue():
  while LittleFS.queueNotEmpty():
    chunk = LittleFS.dequeueChunk(10)
    response = POST /api/tap/sync { events: chunk }
    Header: Authorization: Bearer <api_token>
    if HTTP 200:
      LittleFS.deleteChunk(chunk)   // safe — server returns 200 even on retry
    else:
      break  // stop, retry on next reconnect
```

---

## Device Provisioning Procedure (once per terminal)

1. Flash `vendor_terminal.ino` to ESP32 via Arduino IDE
2. Open Serial Monitor at 115200 baud
3. On vendor web portal: call `POST /api/devices/provision` → copy the raw token (shown once only)
4. Enter in Serial Monitor:
   ```
   SET TOKEN <64-char-hex-token>
   SET VENDOR <vendor-uuid>
   SET FOOD <food-item-uuid>
   SET WIFI_SSID <network-name>
   SET WIFI_PASS <network-password>
   ```
5. Device writes all values to NVS, reboots automatically
6. On boot: connects WiFi, syncs DS3231 from NTP, enters main loop
7. Terminal is operational

---

## Idempotency — How Double-Charging Is Prevented

The "Lost Courier" failure sequence and its resolution:

| Step | What Happens |
|---|---|
| 1 | ESP32 sends chunk to cloud |
| 2 | Cloud commits all events to DB (txn_id stored) |
| 3 | Cloud sends `200 OK` |
| 4 | **Network drops ACK** — ESP32 never receives it |
| 5 | ESP32 timeout → chunk stays in LittleFS |
| 6 | WiFi reconnects → ESP32 retransmits same chunk (same txn_ids) |
| 7 | Cloud INSERT hits UNIQUE constraint on txn_id → error `23505` |
| 8 | Backend catches `23505` → returns `200 OK { idempotent: true }` |
| 9 | ESP32 receives `200 OK` → deletes chunk from LittleFS |
| **Result** | Exactly one DB record per tap, regardless of network failures |

---

## Verification Tests

| # | Test | Expected Result |
|---|---|---|
| 1 | `POST /api/tap` — no `Authorization` header | `401 UNAUTHORIZED` |
| 2 | `POST /api/tap` — valid Bearer token | Tap processes, points deducted |
| 3 | `POST /api/tap` — revoked token | `403 FORBIDDEN` |
| 4 | `POST /api/tap/sync` — with `terminal_mac` field in body | MAC ignored; vendor from token |
| 5 | `POST /api/tap/sync` — 11 events in array | Zod rejects, `400 BAD REQUEST` |
| 6 | Send identical tap payload twice (same `txn_id`) | Second returns `200 OK`, `idempotent: true`, no double deduction |
| 7 | Simulate ACK drop: server commits, response lost, ESP retries | `200 OK` on retry → LittleFS chunk deleted |
| 8 | Offline: tap 5 cards, reconnect WiFi | 5 events sync in 1 chunk, deleted from LittleFS |
| 9 | Offline: queue 25 events, reconnect | 3 chunks (10+10+5), all deleted, no OOM crash |
| 10 | Power-cycle ESP32 with WiFi off | DS3231 gives correct timestamp (not 1970-01-01) |

---

## What Does NOT Change

- `POST /api/tap` response body shape — unchanged, just requires `Authorization` header and `txn_id`
- All web frontend code — untouched
- Supabase schema for `cards`, `vendors`, `tap_events` (except new `txn_id` column)
- `/api/tap/sync` response shape — same `{ processed, skipped }`
- Kiosk tap endpoint — kiosks are browser-based, no embedded changes needed
