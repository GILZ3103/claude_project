/*
 * Smart Night Market — Vendor Terminal Firmware
 * Hardware: ESP32 DevKit v1 + RC522 RFID + HX711 Load Cell Amp + Push Button
 * Communication: WiFi + HTTPS → POST /api/tap
 * Output: Serial monitor (115200 baud)
 *
 * Pin Wiring:
 *   RC522 SS=21  MOSI=23  MISO=19  SCK=18  RST=22  VCC=3.3V  GND=GND
 *   HX711 DOUT=4  SCK=5  VCC=3.3V  GND=GND
 *   Button on GPIO27 → GND (uses internal pull-up)
 *
 * Flow:
 *   1. Vendor presses button       → capture initial weight (state: MEASURING)
 *   2. Vendor scoops food, presses button again → capture final weight, compute weight_g (state: READY)
 *   3. Customer taps card           → POST /api/tap with weight_g → reset (state: IDLE)
 *
 * NVS keys (provision.cpp.txt):
 *   wifi_ssid, wifi_pass, vendor_id, food_id, api_url, auth_token, scale_factor
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

// ── Pin definitions ───────────────────────────────────────────────────────────
#define SS_PIN          21
#define RST_PIN         22
#define MOSI_PIN        23
#define MISO_PIN        19
#define SCK_PIN         18
#define HX711_DOUT      4
#define HX711_SCK       5
#define BUTTON_PIN      27

// ── Objects ───────────────────────────────────────────────────────────────────
MFRC522     mfrc522(SS_PIN, RST_PIN);
HX711       scale;
Preferences prefs;

// ── Config (loaded from NVS at boot) ─────────────────────────────────────────
String wifiSSID;
String wifiPass;
String vendorId;
String foodId;
String apiUrl;
String authToken;
float  scaleFactor = 1.0f;   // HX711 calibration factor (grams per raw unit)

// ── State machine ─────────────────────────────────────────────────────────────
enum SessionState { IDLE, MEASURING, READY };
SessionState  state           = IDLE;
float         initialWeight   = 0.0f;
float         finalWeight     = 0.0f;
float         weightServedG   = 0.0f;
unsigned long stateEnteredAt  = 0;
const unsigned long STATE_TIMEOUT_MS = 60000;  // 60s auto-reset

// Button debounce
bool          lastButtonState = HIGH;

// ── WiFi ──────────────────────────────────────────────────────────────────────
void connectWiFi() {
    Serial.print("Connecting to WiFi");
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
        if (++attempts > 30) {
            Serial.println("\nWiFi failed — rebooting");
            ESP.restart();
        }
    }
    Serial.println();
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
}

// ── NTP timestamp → ISO 8601 (MYT = UTC+8) ────────────────────────────────────
String getTimestamp() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return "1970-01-01T00:00:00+08:00";
    }
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+08:00", &timeinfo);
    return String(buf);
}

// ── Read UID from RC522 → uppercase hex string ────────────────────────────────
String readUID() {
    String uid = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();
    return uid;
}

// ── State helpers ─────────────────────────────────────────────────────────────
void resetToIdle(const char* reason) {
    state           = IDLE;
    initialWeight   = 0.0f;
    finalWeight     = 0.0f;
    weightServedG   = 0.0f;
    stateEnteredAt  = millis();
    if (reason) Serial.println(reason);
}

// ── Button: handle press transition (active LOW with pull-up) ────────────────
void handleButton() {
    bool current = digitalRead(BUTTON_PIN);
    if (lastButtonState == HIGH && current == LOW) {
        delay(20);  // simple debounce
        if (digitalRead(BUTTON_PIN) != LOW) return;

        if (state == IDLE) {
            initialWeight  = scale.get_units(10);
            state          = MEASURING;
            stateEnteredAt = millis();
            Serial.println("Weighing started — initial " + String(initialWeight, 1) + "g");

        } else if (state == MEASURING) {
            finalWeight    = scale.get_units(10);
            weightServedG  = initialWeight - finalWeight;
            if (weightServedG <= 0.0f) {
                resetToIdle("No weight change detected — resetting");
            } else {
                state          = READY;
                stateEnteredAt = millis();
                Serial.println("Serving captured: " + String(weightServedG, 1) + "g — tap card to pay");
            }

        } else if (state == READY) {
            Serial.println("Already ready — tap card to pay (or wait 60s to reset)");
        }

        // wait for release to prevent re-trigger
        while (digitalRead(BUTTON_PIN) == LOW) delay(10);
    }
    lastButtonState = current;
}

// ── Auto-reset if state held too long ────────────────────────────────────────
void handleStateTimeout() {
    if (state != IDLE && (millis() - stateEnteredAt > STATE_TIMEOUT_MS)) {
        resetToIdle("Timeout — measurement cancelled");
    }
}

// ── POST /api/tap ─────────────────────────────────────────────────────────────
void handleTap(const String& uid) {
    if (state != READY) {
        Serial.println("Card detected (" + uid + ") — but no serving captured. Press button to weigh first.");
        return;
    }

    Serial.println("Card detected: " + uid);
    String timestamp = getTimestamp();

    StaticJsonDocument<320> reqDoc;
    reqDoc["card_uid"]          = uid;
    reqDoc["vendor_id"]         = vendorId;
    reqDoc["food_id"]           = foodId;
    reqDoc["device_timestamp"]  = timestamp;
    reqDoc["synced_from_queue"] = false;
    reqDoc["weight_g"]          = weightServedG;

    String payload;
    serializeJson(reqDoc, payload);

    HTTPClient http;
    String url = apiUrl + "/api/tap";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + authToken);
    http.setTimeout(15000);

    int code = http.POST(payload);

    if (code == 200) {
        String body = http.getString();
        StaticJsonDocument<1024> res;

        if (deserializeJson(res, body) != DeserializationError::Ok) {
            Serial.println("Error: bad JSON response");
            http.end();
            resetToIdle(nullptr);
            return;
        }

        JsonObject data       = res["data"];
        float   balance       = data["points_balance_remaining"] | 0.0f;
        int     caloriesToday = data["calories_today"]           | 0;
        int     caloriesAdded = data["calories_added"]           | 0;
        float   finalCost     = data["final_cost"]               | 0.0f;
        float   discount      = data["discount_applied"]         | 0.0f;
        bool    calWarning    = data["calorie_warning"]          | false;
        bool    voucherIssued = !data["voucher_issued"].isNull();
        const char* campaign  = data["campaign_completed"];

        Serial.println("-------------------------------");
        Serial.println("OK  -" + String(finalCost, 2) + "pts  +" + String(caloriesAdded) + "kcal");
        Serial.println("Weight served: " + String(weightServedG, 1) + "g");
        Serial.println("Balance: " + String(balance, 2) + "pts");
        Serial.println("Calories today: " + String(caloriesToday) + "kcal");

        if (discount > 0)   Serial.println("Voucher applied!  -" + String(discount, 2) + "pts saved");
        if (voucherIssued)  Serial.println("New voucher earned!");
        if (campaign && strlen(campaign) > 0)
                            Serial.println("Campaign complete: " + String(campaign));
        if (calWarning)     Serial.println("Warning: Calorie limit reached!");
        Serial.println("-------------------------------");

    } else if (code == 401) {
        Serial.println("Auth failed — invalid terminal token");

    } else if (code == 402) {
        Serial.println("Insufficient points");

    } else if (code == 409) {
        String body = http.getString();
        StaticJsonDocument<128> res;
        deserializeJson(res, body);
        const char* err = res["error"] | "CONFLICT";
        if (String(err) == "DUPLICATE_TAP") {
            Serial.println("Already visited today");
        } else {
            Serial.println("Error: " + String(err));
        }

    } else if (code < 0) {
        Serial.println("No connection — tap rejected (" + http.errorToString(code) + ")");

    } else {
        Serial.println("Error: HTTP " + String(code));
    }

    http.end();
    resetToIdle(nullptr);  // always reset session after a tap attempt
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n--- Vendor Terminal Booting ---");

    // Load NVS config
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
        Serial.println("ERROR: NVS not provisioned. Flash provision.cpp first.");
        while (true) delay(5000);
    }

    // Button
    pinMode(BUTTON_PIN, INPUT_PULLUP);

    // HX711 load cell
    scale.begin(HX711_DOUT, HX711_SCK);
    if (scale.wait_ready_timeout(2000)) {
        scale.set_scale(scaleFactor);
        scale.tare();
        Serial.println("HX711 ready (scale factor " + String(scaleFactor, 2) + ")");
    } else {
        Serial.println("WARNING: HX711 not detected — load cell readings will be invalid");
    }

    // RC522
    SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
    mfrc522.PCD_Init();
    delay(50);
    byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.println("RC522 firmware version: 0x" + String(version, HEX));
    if (version == 0x00 || version == 0xFF) {
        Serial.println("WARNING: RC522 not detected — check wiring");
    } else {
        Serial.println("RC522 ready");
    }

    connectWiFi();

    configTime(28800, 0, "time.google.com", "time.cloudflare.com");
    Serial.print("Syncing time");
    struct tm timeinfo;
    int ntpTries = 0;
    while (!getLocalTime(&timeinfo) && ntpTries < 10) {
        delay(500);
        Serial.print(".");
        ntpTries++;
    }
    Serial.println();
    Serial.println(ntpTries < 10 ? "Time synced: " + getTimestamp() : "NTP failed — timestamps may be wrong");

    state          = IDLE;
    stateEnteredAt = millis();
    Serial.println("System Ready — press button to start weighing");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost — reconnecting...");
        connectWiFi();
    }

    handleButton();
    handleStateTimeout();

    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
        String uid = readUID();
        handleTap(uid);
        mfrc522.PICC_HaltA();
        mfrc522.PCD_StopCrypto1();
        delay(2000);
    }
}
