/*
 * Smart Night Market — Vendor Terminal Firmware
 * Hardware: ESP32 DevKit v1 + RC522 RFID Reader + Load Cell (GPIO34, ADC1)
 * Communication: WiFi + HTTPS → POST /api/tap
 * Output: Serial monitor (115200 baud)
 *
 * Pin Wiring (RC522):
 *   SS(SDA)=21  MOSI=23  MISO=19  SCK=18  RST=22  VCC=3.3V  GND=GND
 *
 * Provisioning:
 *   Edit provision.cpp.txt with your values, rename to main.cpp,
 *   flash once, then restore this file and flash again.
 *   Keys stored: wifi_ssid, wifi_pass, vendor_id, food_id, api_url
 */

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>

// ── Pin definitions (from hardware template — do not change) ──────────────────
#define SS_PIN   21
#define RST_PIN  22
#define MOSI_PIN 23
#define MISO_PIN 19
#define SCK_PIN  18

// ── Objects ───────────────────────────────────────────────────────────────────
MFRC522     mfrc522(SS_PIN, RST_PIN);
Preferences prefs;

// ── Config (loaded from NVS at boot) ─────────────────────────────────────────
String wifiSSID;
String wifiPass;
String vendorId;
String foodId;
String apiUrl;
String authToken;

// ── Load cell calibration (loaded from NVS at boot) ──────────────────────────
float scaleFactorNVS  = 1.0f; // grams per ADC unit
int   tareOffset      = 0;    // ADC reading at zero load
int   adcPin          = 34;   // GPIO34 — ADC1, input-only (safe with WiFi)

// ── Serving detection state ───────────────────────────────────────────────────
float lastServingGrams = 0.0f;
int   stableBaseline   = 0;
int   stableCount      = 0;
bool  baselineSet      = false;

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

// ── NTP timestamp → ISO 8601 string (MYT = UTC+8) ────────────────────────────
String getTimestamp() {
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
        return "1970-01-01T00:00:00+08:00";
    }
    char buf[30];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+08:00", &timeinfo);
    return String(buf);
}

// ── Load cell helpers ─────────────────────────────────────────────────────────
// Average 10 ADC samples 20ms apart for a stable reading
int readADCStable() {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(adcPin);
        delay(20);
    }
    return (int)(sum / 10);
}

// Convert raw ADC delta to grams using stored calibration coefficients
float adcToGrams(int adcDelta) {
    return (float)adcDelta * scaleFactorNVS;
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

// ── POST /api/tap ─────────────────────────────────────────────────────────────
void handleTap(const String& uid) {
    Serial.println("Card detected: " + uid);

    String timestamp = getTimestamp();

    // Build payload — matches backend tapSchema exactly
    StaticJsonDocument<320> reqDoc;
    reqDoc["card_uid"]          = uid;
    reqDoc["vendor_id"]         = vendorId;
    reqDoc["food_id"]           = foodId;
    reqDoc["device_timestamp"]  = timestamp;
    reqDoc["synced_from_queue"] = false;
    reqDoc["weight_g"]          = lastServingGrams;

    String payload;
    serializeJson(reqDoc, payload);

    // POST request
    HTTPClient http;
    String url = apiUrl + "/api/tap";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + authToken);
    http.setTimeout(8000);

    int code = http.POST(payload);

    if (code == 200) {
        String body = http.getString();
        StaticJsonDocument<1024> res;

        if (deserializeJson(res, body) != DeserializationError::Ok) {
            Serial.println("Error: bad JSON response");
            http.end();
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
        Serial.println("OK  -" + String(finalCost, 1) + "pts  +" + String(caloriesAdded) + "kcal");
        Serial.println("Balance: " + String(balance, 1) + "pts");
        Serial.println("Calories today: " + String(caloriesToday) + "kcal");

        if (discount > 0)   Serial.println("Voucher applied!  -" + String(discount, 1) + "pts saved");
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
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n--- Vendor Terminal Booting ---");

    // Load NVS config
    prefs.begin("config", true);
    wifiSSID       = prefs.getString("wifi_ssid",    "");
    wifiPass       = prefs.getString("wifi_pass",    "");
    vendorId       = prefs.getString("vendor_id",    "");
    foodId         = prefs.getString("food_id",      "");
    apiUrl         = prefs.getString("api_url",      "");
    authToken      = prefs.getString("auth_token",   "");
    scaleFactorNVS = prefs.getFloat ("scale_factor", 1.0f);
    tareOffset     = prefs.getInt   ("tare_offset",  0);
    adcPin         = prefs.getInt   ("adc_pin",      34);
    prefs.end();

    if (wifiSSID.isEmpty() || vendorId.isEmpty() || foodId.isEmpty() || apiUrl.isEmpty() || authToken.isEmpty()) {
        Serial.println("ERROR: NVS not provisioned. Flash provision.cpp first.");
        while (true) delay(5000);
    }

    // Init RC522
    SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
    mfrc522.PCD_Init();
    Serial.println("RC522 ready");

    // Connect WiFi
    connectWiFi();

    // Sync time via NTP (MYT = UTC+8 = 28800s offset)
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

    Serial.println("System Ready...");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
    // Reconnect WiFi if dropped
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi lost — reconnecting...");
        connectWiFi();
    }

    // ── Serving detection — weight monitoring ─────────────────────────────────
    int current = readADCStable();
    if (!baselineSet) {
        stableBaseline = current;
        baselineSet    = true;
    }
    int delta = stableBaseline - current;
    if (delta > 50) {           // significant drop threshold (~50 ADC units)
        stableCount++;
        if (stableCount >= 3) { // confirm stable new lower reading
            lastServingGrams = adcToGrams(delta);
            stableBaseline   = current;
            stableCount      = 0;
            Serial.println("Serving detected: " + String(lastServingGrams, 1) + "g");
        }
    } else {
        stableCount = 0;
    }

    // Wait for card
    if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
        return;
    }

    String uid = readUID();
    handleTap(uid);

    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(2000);
}
