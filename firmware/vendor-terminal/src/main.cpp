/*
 * PROVISIONING SKETCH — run once to write config into NVS flash
 *
 * Steps:
 *   1. Fill in the values below
 *   2. Rename this file to main.cpp (rename existing main.cpp temporarily)
 *   3. Flash to ESP32
 *   4. Open Serial Monitor — it will print "Provisioning complete"
 *   5. Rename main.cpp back and re-flash the actual firmware
 *
 * You only need to do this once per device. Values survive power cycles.
 */

#include <Arduino.h>
#include <Preferences.h>

// ── FILL THESE IN BEFORE FLASHING ────────────────────────────────────────────
const char* WIFI_SSID   = "Gilbert";
const char* WIFI_PASS   = "gilbert123";
const char* VENDOR_ID  = "a1000000-0000-0000-0000-000000000001";  // example: Nasi Lemak Pak Razif
const char* FOOD_ID    = "f0000001-0001-0001-0001-000000000001";  // run: SELECT food_id, name FROM food_items WHERE vendor_id = 'a1000000-0000-0000-0000-000000000001'
const char* API_URL    = "https://claudeproject-production-5b22.up.railway.app";
// ─────────────────────────────────────────────────────────────────────────────

Preferences prefs;

void setup() {
    Serial.begin(115200);
    delay(500);

    prefs.begin("config", false);  // false = read-write
    prefs.putString("wifi_ssid", WIFI_SSID);
    prefs.putString("wifi_pass", WIFI_PASS);
    prefs.putString("vendor_id", VENDOR_ID);
    prefs.putString("food_id",   FOOD_ID);
    prefs.putString("api_url",   API_URL);
    prefs.end();

    Serial.println("Provisioning complete. Re-flash main firmware now.");
}

void loop() {}
