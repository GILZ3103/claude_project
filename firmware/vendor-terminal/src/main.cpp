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
 * Buttonless Weighing Flow:
 *   1. IDLE     — scale near zero; waiting for bowl to be placed
 *   2. BOWL_ON  — stable weight > MIN_BOWL_G detected; bowl_weight recorded;
 *                 waiting for food to be scooped in and weight to re-stabilise
 *   3. READY    — stable weight > bowl_weight + MIN_SERVING_G;
 *                 serving_g printed; awaiting NFC card tap
 *   → Customer taps card → POST /api/tap (backend computes calories) → IDLE
 *
 *   Fallbacks:
 *   • READY, food removed  → BOWL_ON  (vendor changed their mind)
 *   • BOWL_ON, bowl removed → IDLE
 *   • Any state: 120 s timeout → IDLE
 *
 * Calorie calculation is handled entirely by the backend using the food item's
 * calories_per_100g field from the database — no calorie data needed on device.
 *
 * NVS keys: wifi_ssid, wifi_pass, vendor_id, food_id, api_url,
 *           auth_token, scale_factor
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
#define MIN_BOWL_G             50.0f   // minimum grams to register a bowl on scale
#define MIN_SERVING_G           5.0f   // minimum grams to count as a serving
#define STABILITY_THRESHOLD_G   3.0f   // max spread within window = "stable"
#define STABILITY_SAMPLES          6   // rolling window size
#define STABILITY_INTERVAL_MS    300   // ms between samples
#define STABLE_HOLD_REQUIRED       2   // consecutive stable checks → settle ≈ 0.6 s
#define STATE_TIMEOUT_MS      120000UL // 2 min auto-reset

// ── Objects ───────────────────────────────────────────────────────────────────
MFRC522     mfrc522(SS_PIN, RST_PIN);
HX711       scale;
Preferences prefs;

// ── NVS config ────────────────────────────────────────────────────────────────
String wifiSSID, wifiPass, vendorId, foodId, apiUrl, authToken;
float  scaleFactor = 1.0f;

// ── State machine ─────────────────────────────────────────────────────────────
enum SessionState { IDLE, BOWL_ON, READY };
SessionState  state      = IDLE;
float         bowlWeight = 0.0f;
float         servingG   = 0.0f;
unsigned long stateAt    = 0;

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
void connectWiFi() {
    Serial.print("WiFi connecting");
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
    int n = 0;
    while (WiFi.status() != WL_CONNECTED) {
        delay(500); Serial.print(".");
        if (++n > 30) { Serial.println("\nWiFi failed — rebooting"); ESP.restart(); }
    }
    Serial.println("\nWiFi: " + WiFi.localIP().toString());
}

// ── Buttonless weight state machine ───────────────────────────────────────────
void handleWeight() {
    float raw = scale.get_units(3);
    tracker.tick(raw);

    if (state != IDLE && millis() - stateAt > STATE_TIMEOUT_MS) {
        bowlWeight = 0.0f; servingG = 0.0f;
        enterState(IDLE, "Timeout — session reset");
        return;
    }

    if (!tracker.full) return;
    float avg = tracker.avg();

    switch (state) {

      case IDLE:
        if (tracker.stable() && avg > MIN_BOWL_G) {
            bowlWeight = avg;
            char msg[72];
            snprintf(msg, sizeof(msg), "Bowl on scale: %.1fg — scoop food in", bowlWeight);
            enterState(BOWL_ON, msg);
        }
        break;

      case BOWL_ON:
        if (tracker.stable()) {
            if (avg < MIN_BOWL_G) {
                bowlWeight = 0.0f;
                enterState(IDLE, "Bowl removed — waiting");
            } else {
                float served = avg - bowlWeight;
                if (served >= MIN_SERVING_G) {
                    servingG = served;
                    char msg[64];
                    snprintf(msg, sizeof(msg), "Serving: %.1fg — tap card to pay", servingG);
                    enterState(READY, msg);
                }
            }
        }
        break;

      case READY:
        if (tracker.stable()) {
            float served = avg - bowlWeight;
            if (avg < MIN_BOWL_G) {
                servingG = 0.0f;
                enterState(IDLE, "Bowl removed — waiting");
            } else if (served < MIN_SERVING_G) {
                servingG = 0.0f;
                enterState(BOWL_ON, "Food removed — scoop again");
            }
        }
        break;
    }
}

// ── POST /api/tap ─────────────────────────────────────────────────────────────
void handleTap(const String& uid) {
    if (state != READY) {
        Serial.println("Card: " + uid + " — place bowl & scoop food first");
        return;
    }

    Serial.println("Card: " + uid + " — sending...");

    StaticJsonDocument<320> req;
    req["card_uid"]          = uid;
    req["vendor_id"]         = vendorId;
    req["food_id"]           = foodId;
    req["device_timestamp"]  = getTimestamp();
    req["synced_from_queue"] = false;
    req["weight_g"]          = servingG;

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
            Serial.printf("Served: %.1fg\n", servingG);
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
        Serial.println("HTTP " + String(code));
    }

    http.end();
    servingG = 0.0f; bowlWeight = 0.0f;
    enterState(IDLE, "Ready for next customer");
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== Vendor Terminal v2 (buttonless) ===");

    prefs.begin("config", true);
    wifiSSID    = prefs.getString("wifi_ssid",    "");
    wifiPass    = prefs.getString("wifi_pass",    "");
    vendorId    = prefs.getString("vendor_id",    "");
    foodId      = prefs.getString("food_id",      "");
    apiUrl      = prefs.getString("api_url",      "");
    authToken   = prefs.getString("auth_token",   "");
    scaleFactor = prefs.getFloat ("scale_factor", 1.0f);
    prefs.end();

    if (wifiSSID.isEmpty() || vendorId.isEmpty() || foodId.isEmpty()
        || apiUrl.isEmpty() || authToken.isEmpty()) {
        Serial.println("ERROR: NVS not provisioned — flash provision env first");
        while (true) delay(5000);
    }

    // HX711 load cell
    scale.begin(HX711_DOUT, HX711_SCK);
    if (scale.wait_ready_timeout(2000)) {
        scale.set_scale(scaleFactor);
        scale.tare();
        Serial.printf("HX711 ready — scale factor %.4f, tared\n", scaleFactor);
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

    enterState(IDLE, "\nReady — place bowl on scale");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
    if (WiFi.status() != WL_CONNECTED) connectWiFi();

    handleWeight();

    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        String uid = readUID();
        handleTap(uid);
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        delay(1500);
    }
}
