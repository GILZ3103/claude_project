/*
 * Vendor Terminal — One-shot NVS Provisioning
 *
 * HOW TO USE:
 *   1. Fill in YOUR values in the "--- FILL IN YOUR VALUES ---" section below.
 *   2. In VS Code (PlatformIO), select environment:  "provision"
 *      (bottom status bar → click the env name → choose "provision")
 *   3. Upload to the ESP32.  Open Serial Monitor (115200) — watch for "Provisioning complete".
 *   4. Switch environment back to "esp32dev" and upload main.cpp.
 *
 * WHERE TO GET EACH VALUE:
 *   wifi_ssid / wifi_pass  → your local WiFi network
 *   vendor_id              → Supabase → Table: vendors → column: id  (UUID)
 *   food_id                → Supabase → Table: foods   → column: id  (UUID)
 *   api_url                → your backend URL, no trailing slash
 *                            e.g. "http://192.168.1.100:3000"  (LAN)
 *                            or   "https://your-backend.onrender.com"
 *   auth_token             → must match TERMINAL_AUTH_TOKEN in backend/.env
 *   scale_factor           → HX711 calibration.  Leave 1.0 until you run
 *                            a separate calibration sketch.
 */

#include <Arduino.h>
#include <Preferences.h>

// ────────────────────────────────────────────────────────────────────────────
// --- FILL IN YOUR VALUES ---
// ────────────────────────────────────────────────────────────────────────────
static const char* WIFI_SSID     = "Gilbert";
static const char* WIFI_PASS     = "gilbert123";
static const char* VENDOR_ID     = "43fcda5f-214f-457b-8bd4-ee43971dc79d";
static const char* FOOD_ID       = "498c1bca-5a31-42d5-b68b-bc132ace0bd1";
static const char* API_URL       = "https://warungtek-backend.onrender.com";
static const char* AUTH_TOKEN    = "kacangputihsupersecret";
static const float SCALE_FACTOR  = 1.0f;
// ────────────────────────────────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=== NVS Provisioning Tool ===");

    if (String(WIFI_SSID)  == "YOUR_WIFI_SSID"             ||
        String(VENDOR_ID)  == "PASTE-VENDOR-UUID-HERE"     ||
        String(FOOD_ID)    == "PASTE-FOOD-UUID-HERE"       ||
        String(API_URL)    == "http://YOUR_BACKEND_IP:3000" ||
        String(AUTH_TOKEN) == "PASTE-TERMINAL-AUTH-TOKEN-HERE") {
        Serial.println("ERROR: Fill in all values in provision.cpp before flashing!");
        while (true) delay(5000);
    }

    Preferences prefs;
    prefs.begin("config", false);
    prefs.putString("wifi_ssid",    WIFI_SSID);
    prefs.putString("wifi_pass",    WIFI_PASS);
    prefs.putString("vendor_id",    VENDOR_ID);
    prefs.putString("food_id",      FOOD_ID);
    prefs.putString("api_url",      API_URL);
    prefs.putString("auth_token",   AUTH_TOKEN);
    prefs.putFloat ("scale_factor", SCALE_FACTOR);
    prefs.end();

    Serial.println("Provisioning complete. Verifying readback...");

    prefs.begin("config", true);
    Serial.println("  wifi_ssid    : " + prefs.getString("wifi_ssid",  "(missing)"));
    Serial.println("  vendor_id    : " + prefs.getString("vendor_id",  "(missing)"));
    Serial.println("  food_id      : " + prefs.getString("food_id",    "(missing)"));
    Serial.println("  api_url      : " + prefs.getString("api_url",    "(missing)"));
    Serial.println("  auth_token   : [set, not shown]");
    Serial.println("  scale_factor : " + String(prefs.getFloat("scale_factor", 0.0f), 4));
    prefs.end();

    Serial.println("\nAll done — now flash main.cpp (env: esp32dev).");
}

void loop() {}
