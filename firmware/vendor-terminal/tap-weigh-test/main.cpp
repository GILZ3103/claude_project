/*
 * Tap-Weigh-Tap Session Test — env:tap-weigh-test
 * Standalone: no NTP. Serial monitor only for the local tap/weigh flow.
 * WiFi + BLE beacon + POST /api/tap added to mirror vendor-terminal.ino, kept
 * non-blocking/non-fatal so the tap/weigh logic works whether or not the
 * network or backend provisioning is in place.
 *
 * Tap 1 (any card)        -> tares the scale to 0 at the tray's current weight, opens session
 * Tap 2 (SAME card again) -> reads the live weight relative to that zero (negative if food
 *                             was lifted off, positive if mass was added back), reports the
 *                             ABSOLUTE magnitude of the change, sends it to the backend as
 *                             weight_g (deducts points, adds calories), then re-tares
 *
 * NVS (namespace "config") is shared with vendor-terminal.ino: wifi_ssid, wifi_pass,
 * vendor_id, food_id, api_url, auth_token. If the board hasn't been provisioned yet, run
 * the `provision` env first; otherwise this sketch just skips WiFi/backend and keeps running.
 * No NTP here, so device_timestamp uses the same placeholder production falls back to.
 *
 * Build/upload:
 *   pio run -d firmware/vendor-terminal -e tap-weigh-test -t upload -t monitor
 *
 * Pins:
 *   RC522  SS=21  RST=22  MOSI=23  MISO=19  SCK=18
 *   HX711  DOUT=4  SCK=5
 */
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include "HX711.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>

// ── BLE beacon config (matches vendor-terminal.ino) ───────────────────────────
#define VENUE_SERVICE_UUID  "6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10"
#define ANCHOR_MINOR        1
#define LOCAL_COMPANY_ID    0xFFFF

// --- Pin Definitions ---
#define RST_PIN         22
#define SS_PIN          21
const int LOADCELL_DOUT_PIN = 4;
const int LOADCELL_SCK_PIN = 5;

// --- Objects ---
MFRC522 mfrc522(SS_PIN, RST_PIN);
HX711 scale;
Preferences prefs;

// --- Variables ---
float initialWeight = 0;
String lastUID = "";
bool isSessionActive = false;
String wifiSSID, wifiPass;
String vendorId, foodId, apiUrl, authToken;

// Calibration factor for this scale/tray
float calibration_factor = 63.22;

// Non-fatal: tries for ~10s, then continues OFFLINE. loop() retries in the background.
void connectWiFi() {
  if (wifiSSID.isEmpty()) {
    Serial.println("No WiFi credentials in NVS — skipping (run provision env first)");
    return;
  }
  Serial.print("WiFi connecting");
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
  int n = 0;
  while (WiFi.status() != WL_CONNECTED && n++ < 20) {  // ~10s
    delay(500); Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED)
    Serial.println("\nWiFi: " + WiFi.localIP().toString());
  else
    Serial.println("\nWiFi unavailable — continuing OFFLINE (will retry in background)");
}

// ── POST /api/tap (ported from vendor-terminal.ino) ───────────────────────────
// Non-fatal: skips if vendor/food/api/auth NVS keys aren't set yet. No NTP in this
// sketch, so device_timestamp uses the same placeholder production falls back to.
void postTap(const String& uid, float weightG) {
  if (vendorId.isEmpty() || foodId.isEmpty() || apiUrl.isEmpty() || authToken.isEmpty()) {
    Serial.println("Backend not provisioned (vendor_id/food_id/api_url/auth_token) — skipping");
    return;
  }

  Serial.println("Card: " + uid + " — sending...");

  StaticJsonDocument<320> req;
  req["card_uid"]          = uid;
  req["vendor_id"]         = vendorId;
  req["food_id"]           = foodId;
  req["device_timestamp"]  = "1970-01-01T00:00:00+08:00"; // no NTP in this sketch
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

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- [ SYSTEM BOOTING ] ---");

  // 1. Initialize RFID
  // Explicitly mapping SPI pins to ensure Pin 5 is free for the Load Cell
  SPI.begin(18, 19, 23, 21);
  mfrc522.PCD_Init();

  // Check if RFID is connected
  byte v = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("RFID Version: 0x"); Serial.println(v, HEX);

  // 2. Initialize Scale
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  if (scale.wait_ready_timeout(2000)) {
    scale.set_scale(calibration_factor);
    scale.tare(); // Initial Zero
    Serial.println("Scale: Ready and Tared.");
  } else {
    Serial.println("Scale: NOT FOUND. Check wiring on Pins 4 & 5.");
  }

  // 3. WiFi + backend config (NVS-provisioned, non-fatal)
  prefs.begin("config", true);
  wifiSSID  = prefs.getString("wifi_ssid",  "");
  wifiPass  = prefs.getString("wifi_pass",  "");
  vendorId  = prefs.getString("vendor_id",  "");
  foodId    = prefs.getString("food_id",    "");
  apiUrl    = prefs.getString("api_url",    "");
  authToken = prefs.getString("auth_token", "");
  prefs.end();
  connectWiFi();

  // 4. BLE beacon (matches vendor-terminal.ino)
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

  Serial.println("-----------------------------------");
  Serial.println("READY! TAP CARD TO START SESSION");
  Serial.println("-----------------------------------");
}

void loop() {
  // Non-blocking background reconnect — never blocks the tap/weigh flow
  static unsigned long wifiRetryMs = 0;
  if (!wifiSSID.isEmpty() && WiFi.status() != WL_CONNECTED && millis() - wifiRetryMs > 30000) {
    wifiRetryMs = millis();
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());
  }

  // Look for RFID Card
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Get Card UID
  String currentUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    currentUID += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    currentUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  currentUID.toUpperCase();

  // LOGIC: First Tap vs Second Tap
  if (isSessionActive && currentUID == lastUID) {
    // --- SECOND TAP: END SESSION ---
    // Tray was tared to 0 on tap 1, so this reading is the live delta from zero
    // (negative if food was lifted off, positive if mass was added back).
    float currentWeight = scale.get_units(10);
    float massChange = fabs(currentWeight - initialWeight);

    Serial.println("\n***********************************");
    Serial.println(">>> SECOND TAP: SESSION COMPLETE <<<");
    Serial.print("Tray reading: "); Serial.print(currentWeight, 2); Serial.println(" g");
    Serial.println("-----------------------------------");
    Serial.print("MASS CHANGE (abs): "); Serial.print(massChange, 2); Serial.println(" g");
    Serial.println("***********************************");

    // --- SEND TO BACKEND (deducts points, adds calories) ---
    postTap(lastUID, massChange);

    // --- RECALIBRATION ---
    Serial.println("\nCleaning up scale... Please remove item.");
    delay(3000); // Give user 3 seconds to clear the scale
    scale.tare();
    Serial.println("Recalibration Done. Scale reset to 0.00g.");
    Serial.println("-----------------------------------");

    isSessionActive = false;
    lastUID = "";
  }
  else {
    // --- FIRST TAP: START SESSION ---
    // Tare to zero at the tray's current weight; tap 2 will read the delta from this zero.
    scale.tare();
    initialWeight = scale.get_units(10); // ~0g right after taring
    lastUID = currentUID;
    isSessionActive = true;

    Serial.println("\n***********************************");
    Serial.println(">>> FIRST TAP: SESSION STARTED <<<");
    Serial.print("UID: "); Serial.println(currentUID);
    Serial.println("Tray zeroed — remove or add food, then tap the SAME card again");
    Serial.println("***********************************");
    delay(1500); // Prevent double-reading
  }

  // Halt RFID to clean up communication
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
