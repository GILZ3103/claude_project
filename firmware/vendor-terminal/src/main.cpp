/*
 * Smart Night Market — Vendor Terminal Firmware v2
 * Hardware: ESP32 DevKit v1 + RC522 RFID + HX711 Load Cell
 * Communication: WiFi + HTTPS → POST /api/tap
 *
 * Pin Wiring:
 *   RC522  SS=21  MOSI=23  MISO=19  SCK=18  RST=22  VCC=3.3V  GND=GND
 *   HX711  DOUT=4  SCK=5  VCC=3.3V  GND=GND
 *   (No button required)
 *
 * Two-tap Weighing Flow (key-started, mass-deduction from a shared tray):
 *   1. IDLE     — press 'N' (Serial key) to arm → ARMED
 *   2. ARMED    — customer taps card (tap 1); scale TARES to zero at the tray's
 *                 current weight → WEIGHING
 *   3. WEIGHING — vendor removes food from the tray; SAME card taps again (tap 2);
 *                 delta = initial(0) − final = grams removed = the billable grams → IDLE
 *
 *   Fallbacks:
 *   • WEIGHING, a different card taps → cancel & re-arm (re-tare)
 *   • Any state: 120 s timeout → IDLE
 *
 * Calorie calculation is handled entirely by the backend using the food item's
 * calories_per_100g field from the database — no calorie data needed on device.
 *
 * Load-cell drift control: drift is contained by
 *   (a) per-session re-tare on 'N'  — every customer starts from a fresh zero,
 *   (b) post-transaction auto re-tare (folded into 'N' in this bowl flow).
 * Scale factor is determined offline per-unit (no on-site mass-based wizard).
 * It defaults to DEFAULT_CALIBRATION_FACTOR below, but can be overridden without
 * reflashing via the 'F' Serial command, which persists the new value to NVS.
 *
 * Serial keys: N start session · F<number> set calibration factor (e.g. F18.46)
 *              (weighing is tap-1 / tap-2 by card)
 *
 * NVS keys: wifi_ssid, wifi_pass, vendor_id, food_id, api_url, auth_token, cal_factor
 */

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <HX711.h>
#include <time.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>

// ── BLE beacon config ─────────────────────────────────────────────────────────
#define VENUE_SERVICE_UUID  "6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10"
#define ANCHOR_MINOR        1
#define LOCAL_COMPANY_ID    0xFFFF

// ── Pin definitions ───────────────────────────────────────────────────────────
#define SS_PIN      21
#define RST_PIN     22
#define MOSI_PIN    23
#define MISO_PIN    19
#define SCK_PIN     18
#define HX711_DOUT   4
#define HX711_SCK    5

// ── Weight tuning ─────────────────────────────────────────────────────────────
#define MIN_SERVING_G          20.0f   // minimum grams to count as a serving (delta sanity)
#define STABILITY_THRESHOLD_G  15.0f   // max spread within window = "stable" (raised for noisy cell)
#define STABILITY_SAMPLES          8   // rolling window size (more samples = smoother average)
#define STABILITY_INTERVAL_MS    300   // ms between samples
#define STABLE_HOLD_REQUIRED       4   // consecutive stable checks → settle ≈ 1.2 s
#define STATE_TIMEOUT_MS      120000UL // 2 min auto-reset
#define DEFAULT_CALIBRATION_FACTOR 18.46f // fallback if NVS has no saved "cal_factor"

// ── Objects ───────────────────────────────────────────────────────────────────
MFRC522     mfrc522(SS_PIN, RST_PIN);
HX711       scale;
Preferences prefs;

// ── NVS config ────────────────────────────────────────────────────────────────
String wifiSSID, wifiPass, vendorId, foodId, apiUrl, authToken;
float  calibrationFactor = DEFAULT_CALIBRATION_FACTOR;

// ── State machine ─────────────────────────────────────────────────────────────
enum SessionState { IDLE, ARMED, WEIGHING };
SessionState  state         = IDLE;
float         initialWeight = 0.0f;   // captured on tap 1
String        lastUID       = "";     // card that opened the current session
unsigned long stateAt       = 0;

// ── Rolling stability tracker ─────────────────────────────────────────────────
struct WeightTracker {
    float         buf[STABILITY_SAMPLES] = {};
    int           idx         = 0;
    bool          full        = false;
    int           stableCount = 0;
    unsigned long lastMs      = 0;

    void tick(float v) {
        unsigned long now = millis();
        if (now - lastMs < STABILITY_INTERVAL_MS) return;
        lastMs = now;
        buf[idx] = v;
        idx = (idx + 1) % STABILITY_SAMPLES;
        if (idx == 0) full = true;
    }

    float avg() const {
        int n = full ? STABILITY_SAMPLES : idx;
        if (n == 0) return 0.0f;
        float s = 0.0f;
        for (int i = 0; i < n; i++) s += buf[i];
        return s / n;
    }

    // Returns true once weight has held steady for STABLE_HOLD_REQUIRED ticks
    bool stable() {
        if (!full) { stableCount = 0; return false; }
        float mn = buf[0], mx = buf[0];
        for (int i = 1; i < STABILITY_SAMPLES; i++) {
            if (buf[i] < mn) mn = buf[i];
            if (buf[i] > mx) mx = buf[i];
        }
        bool ok = (mx - mn) < STABILITY_THRESHOLD_G;
        stableCount = ok ? stableCount + 1 : 0;
        return stableCount >= STABLE_HOLD_REQUIRED;
    }

    void reset() {
        for (int i = 0; i < STABILITY_SAMPLES; i++) buf[i] = 0.0f;
        idx = 0; full = false; stableCount = 0;
    }
} tracker;

// ── Helpers ───────────────────────────────────────────────────────────────────
void enterState(SessionState next, const char* msg) {
    state   = next;
    stateAt = millis();
    tracker.reset();
    if (msg) Serial.println(msg);
}

String getTimestamp() {
    struct tm t;
    if (!getLocalTime(&t)) return "1970-01-01T00:00:00+08:00";
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+08:00", &t);
    return String(buf);
}

String readUID() {
    String uid;
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    return uid;
}

// ── WiFi ──────────────────────────────────────────────────────────────────────
// Non-fatal: tries for ~10 s, then continues OFFLINE. The loop retries in the
// background, so a missing network never blocks the weighing/tap flow (Phase 2 is
// offline; Phase 3 auto-connects once WiFi is available).
void connectWiFi() {
    Serial.print("WiFi connecting");
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
    int n = 0;
    while (WiFi.status() != WL_CONNECTED && n++ < 20) {  // ~10 s
        delay(500); Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED)
        Serial.println("\nWiFi: " + WiFi.localIP().toString());
    else
        Serial.println("\nWiFi unavailable — continuing OFFLINE (will retry in background)");
}

// Stable-averaged weight; falls back to a direct read until the window fills
float readStableWeight() {
    return tracker.full ? tracker.avg() : scale.get_units(10);
}

// ── Scale polling + session timeout ───────────────────────────────────────────
void handleWeight() {
    float raw = scale.get_units(3);
    tracker.tick(raw);

    if (state != IDLE && millis() - stateAt > STATE_TIMEOUT_MS) {
        initialWeight = 0.0f; lastUID = "";
        scale.tare(30);
        enterState(IDLE, "Timeout — session reset (press N to start)");
        return;
    }

    if (!tracker.full) return;

    // Live reading while a session is open
    static unsigned long debugMs = 0;
    if (state != IDLE && millis() - debugMs > 1500) {
        debugMs = millis();
        Serial.printf("[scale] %.1fg  stable=%d\n", fabsf(tracker.avg()), (int)tracker.stable());
    }
}

// ── POST /api/tap ─────────────────────────────────────────────────────────────
// Phase 3 entry point: send the two-tap delta (grams) as weight_g. State-agnostic;
// the caller owns the session transition. Not called yet in Phase 2 (offline).
void postTap(const String& uid, float weightG) {
    Serial.println("Card: " + uid + " — sending...");

    StaticJsonDocument<320> req;
    req["card_uid"]          = uid;
    req["vendor_id"]         = vendorId;
    req["food_id"]           = foodId;
    req["device_timestamp"]  = getTimestamp();
    req["synced_from_queue"] = false;
    req["weight_g"]          = weightG;

    String payload;
    serializeJson(req, payload);

    HTTPClient http;
    http.begin(apiUrl + "/api/tap");
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + authToken);
    http.setTimeout(15000);

    int code = http.POST(payload);

    if (code == 200) {
        String body = http.getString();
        StaticJsonDocument<1024> res;
        if (deserializeJson(res, body) != DeserializationError::Ok) {
            Serial.println("Error: bad JSON response");
        } else {
            JsonObject d     = res["data"];
            float  balance   = d["points_balance_remaining"] | 0.0f;
            int    calToday  = d["calories_today"]           | 0;
            int    calAdded  = d["calories_added"]           | 0;
            float  cost      = d["final_cost"]               | 0.0f;
            float  discount  = d["discount_applied"]         | 0.0f;
            bool   calWarn   = d["calorie_warning"]          | false;
            bool   voucher   = !d["voucher_issued"].isNull();
            const char* camp = d["campaign_completed"];

            Serial.println("──────────────────────────────");
            Serial.printf("OK   -%.2f pts   +%d kcal\n", cost, calAdded);
            Serial.printf("Served: %.1fg\n", weightG);
            Serial.printf("Balance: %.2f pts\n", balance);
            Serial.printf("Calories today: %d kcal\n", calToday);
            if (discount > 0)         Serial.printf("Voucher: -%.2f pts saved\n", discount);
            if (voucher)              Serial.println("New voucher earned!");
            if (camp && strlen(camp)) Serial.println("Campaign: " + String(camp));
            if (calWarn)              Serial.println("WARNING: Calorie limit reached!");
            Serial.println("──────────────────────────────");
        }
    } else if (code == 401) {
        Serial.println("Auth failed — check auth_token in NVS");
    } else if (code == 402) {
        Serial.println("Insufficient points");
    } else if (code == 409) {
        String body = http.getString();
        StaticJsonDocument<128> res;
        deserializeJson(res, body);
        const char* err = res["error"] | "CONFLICT";
        Serial.println(String(err) == "DUPLICATE_TAP" ? "Already visited today" : "Error: " + String(err));
    } else if (code < 0) {
        Serial.println("No connection: " + http.errorToString(code));
    } else {
        String body = http.getString();
        StaticJsonDocument<128> err;
        deserializeJson(err, body);
        const char* e = err["error"] | "UNKNOWN";
        Serial.println("HTTP " + String(code) + " — " + String(e));
    }

    http.end();
}

// ── Serial helpers ──────────────────────────────────────────────────────────────
// Blocking read of one line from Serial (until CR/LF or timeout). "" on timeout.
String readSerialLine(unsigned long timeoutMs) {
    String s;
    unsigned long start = millis();
    while (millis() - start < timeoutMs) {
        if (Serial.available()) {
            char c = Serial.read();
            if (c == '\n' || c == '\r') {
                if (s.length() > 0) return s;   // ignore stray leading CR/LF
            } else {
                s += c;
            }
        }
        delay(5);
    }
    return s;
}

// ── Two-tap card handler ────────────────────────────────────────────────────────
// tap 1 (ARMED)              → TARE to zero at the tray's current weight, open session
// tap 2 (same UID, WEIGHING) → delta = initial(0) − final = grams removed from the tray
// different UID (WEIGHING)    → cancel & re-arm (re-tare)
void handleCardTap(const String& uid) {
    if (state == IDLE) {
        Serial.println("Card " + uid + " — press N to start a session first");
        return;
    }

    if (state == ARMED) {
        scale.tare(30);                       // tap 1 = zero reference (tray's current weight)
        tracker.reset();                      // discard samples taken before this tare
        initialWeight = readStableWeight();   // ~0g right after taring
        lastUID       = uid;
        char msg[96];
        snprintf(msg, sizeof(msg),
                 "Tap 1 [%s]: zeroed at %.1fg — remove food, then tap the SAME card again",
                 uid.c_str(), initialWeight);
        enterState(WEIGHING, msg);
        return;
    }

    // state == WEIGHING
    if (uid == lastUID) {
        float finalWeight = readStableWeight();
        float delta       = initialWeight - finalWeight;   // mass removed from the tray
        Serial.println("──────────────────────────────");
        Serial.printf("Tap 2 [%s]: tray now %.1fg\n", uid.c_str(), finalWeight);
        Serial.printf("Delta (billable): %.1fg\n", delta);
        if (delta < MIN_SERVING_G)
            Serial.println("WARNING: delta below minimum serving — re-check the scale");
        postTap(uid, delta);
        Serial.println("──────────────────────────────");
        initialWeight = 0.0f; lastUID = "";
        enterState(IDLE, "Press N for next customer");
    } else {
        Serial.println("Different card — cancelling session, re-taring.");
        scale.tare(30);
        initialWeight = 0.0f; lastUID = "";
        enterState(ARMED, "Re-armed — tap a card to start tap 1");
    }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Vendor Terminal v2 (two-tap) ===");

    prefs.begin("config", true);
    wifiSSID    = prefs.getString("wifi_ssid",    "");
    wifiPass    = prefs.getString("wifi_pass",    "");
    vendorId    = prefs.getString("vendor_id",    "");
    foodId      = prefs.getString("food_id",      "");
    apiUrl      = prefs.getString("api_url",      "");
    authToken       = prefs.getString("auth_token",   "");
    calibrationFactor = prefs.getFloat("cal_factor", DEFAULT_CALIBRATION_FACTOR);
    prefs.end();

    if (wifiSSID.isEmpty() || vendorId.isEmpty() || foodId.isEmpty()
        || apiUrl.isEmpty() || authToken.isEmpty()) {
        Serial.println("ERROR: NVS not provisioned — flash provision env first");
        while (true) delay(5000);
    }

    // HX711 load cell
    scale.begin(HX711_DOUT, HX711_SCK);
    if (scale.wait_ready_timeout(2000)) {
        scale.set_scale(calibrationFactor);
        Serial.print("HX711 settling");
        for (int i = 0; i < 10; i++) { scale.read(); delay(300); Serial.print("."); }
        scale.tare(30);  // 30-sample tare for stable zero
        Serial.printf("\nHX711 ready — scale factor %.4f, tared\n", calibrationFactor);
        Serial.println("Tip: 'N' starts a session, 'F<number>' sets calibration factor");
    } else {
        Serial.println("WARNING: HX711 not detected — check wiring (DOUT=4, SCK=5)");
    }

    // RC522 RFID
    SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
    mfrc522.PCD_Init();
    delay(50);
    byte ver = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    if (ver == 0x00 || ver == 0xFF)
        Serial.println("WARNING: RC522 not detected — check wiring");
    else
        Serial.printf("RC522 ready (fw 0x%02X)\n", ver);

    connectWiFi();

    configTime(28800, 0, "time.google.com", "time.cloudflare.com");
    Serial.print("NTP sync");
    struct tm t; int n = 0;
    while (!getLocalTime(&t) && n++ < 10) { delay(500); Serial.print("."); }
    Serial.println(n < 10 ? "\nTime: " + getTimestamp() : "\nNTP failed — timestamps may be inaccurate");

    // BLE beacon
    BLEDevice::init("NM-Anchor");
    BLEDevice::setPower(ESP_PWR_LVL_P9);
    BLEAdvertising* adv = BLEDevice::getAdvertising();
    BLEAdvertisementData advData;
    advData.setFlags(0x06);
    advData.setCompleteServices(BLEUUID(VENUE_SERVICE_UUID));
    std::string mfg;
    mfg += (char)(LOCAL_COMPANY_ID & 0xFF);
    mfg += (char)((LOCAL_COMPANY_ID >> 8) & 0xFF);
    mfg += (char)(ANCHOR_MINOR & 0xFF);
    advData.setManufacturerData(mfg);
    adv->setAdvertisementData(advData);
    adv->setScanResponse(false);
    adv->setMinInterval(0x20);
    adv->setMaxInterval(0x40);
    BLEDevice::startAdvertising();
    Serial.printf("BLE beacon started (anchor minor=%d)\n", ANCHOR_MINOR);

    enterState(IDLE, "\nReady — press N to start a weighing session");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
    // Non-blocking background reconnect — never blocks the weighing/tap flow
    static unsigned long wifiRetryMs = 0;
    if (WiFi.status() != WL_CONNECTED && millis() - wifiRetryMs > 30000) {
        wifiRetryMs = millis();
        WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
    }

    // Serial keys:
    //   N = start a session → tare to fresh zero → ARMED (then card tap-1 / tap-2)
    //   F<number> = set calibration factor and persist to NVS (no reflash needed)
    if (Serial.available()) {
        char c = Serial.read();

        if (c == 'N' || c == 'n') {
            scale.tare(30);                  // fresh zero = drift reset at session start
            initialWeight = 0.0f; lastUID = "";
            enterState(ARMED, "Session started — tap card (tap 1), add food, tap again");

        } else if (c == 'F' || c == 'f') {
            String line = readSerialLine(10000);
            float  newFactor = line.toFloat();
            if (newFactor == 0.0f) {
                Serial.println("Invalid factor — type a number after F, e.g. F18.46");
            } else {
                calibrationFactor = newFactor;
                scale.set_scale(calibrationFactor);
                prefs.begin("config", false);
                prefs.putFloat("cal_factor", calibrationFactor);
                prefs.end();
                Serial.printf("Calibration factor set to %.4f (saved to NVS)\n", calibrationFactor);
            }
        }
    }

    handleWeight();

    // Heartbeat while a session is open — also checks RC522 is alive and resets it
    static unsigned long awaitMs = 0;
    if ((state == ARMED || state == WEIGHING) && millis() - awaitMs > 3000) {
        awaitMs = millis();
        byte ver = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
        if (ver == 0x00 || ver == 0xFF) {
            Serial.println("RC522 unresponsive — resetting...");
            mfrc522.PCD_Reset();
            mfrc522.PCD_Init();
        }
        Serial.printf("%s — RC522=0x%02X\n",
                      state == ARMED ? "ARMED (waiting tap 1)" : "WEIGHING (waiting tap 2)", ver);
    }

    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        String uid = readUID();
        handleCardTap(uid);
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        // A halted card won't answer the REQA used by PICC_IsNewCardPresent() again.
        // Cycling the antenna de-energizes it so the SAME card re-registers as "new"
        // on the next tap, even if it never left the reader's field.
        mfrc522.PCD_AntennaOff();
        delay(50);
        mfrc522.PCD_AntennaOn();
        delay(1500);
    }
}
