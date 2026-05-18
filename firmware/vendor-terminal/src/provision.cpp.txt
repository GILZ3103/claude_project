/*
 * Smart Night Market — Vendor Terminal Provisioning Sketch
 *
 * One-time NVS write. Use this to configure a fresh ESP32:
 *   1. Edit the values below.
 *   2. Rename this file to "main.cpp" (back up the real main.cpp first as main.cpp.bak).
 *   3. Flash to ESP32 once. Open Serial monitor (115200) and confirm:
 *        "Provisioning complete"
 *   4. Rename this file back to "provision.cpp.txt" and restore main.cpp.bak → main.cpp.
 *   5. Flash the real firmware.
 *
 * NVS keys written:
 *   wifi_ssid, wifi_pass, vendor_id, food_id, api_url, auth_token, scale_factor
 *
 * The "auth_token" value MUST match the TERMINAL_AUTH_TOKEN environment variable
 * set on the backend (Render). Generate a strong random secret, e.g.:
 *   openssl rand -hex 32
 *
 * The "scale_factor" is the HX711 calibration factor for your specific load cell.
 * Find it experimentally:
 *   1. Flash a calibration sketch that prints raw HX711 readings
 *   2. Place a known weight (e.g. 500g) on the load cell
 *   3. scale_factor = raw_reading / known_weight_in_grams
 *   4. Replace the value below and reflash
 * Typical values: 100–500 for common 1kg–5kg load cells with HX711.
 */

#include <Arduino.h>
#include <Preferences.h>

Preferences prefs;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n--- Provisioning ESP32 NVS ---");

    prefs.begin("config", false);

    prefs.putString("wifi_ssid",  "Gilbert");
    prefs.putString("wifi_pass",  "gilbert123");
    prefs.putString("vendor_id",  "14d599d9-1ce1-4a98-bedf-6f7486b2e44c");
    prefs.putString("food_id",    "a942a610-079a-4763-b61b-5599a5515c9b");
    prefs.putString("api_url",    "https://warungtek-backend.onrender.com");
    prefs.putString("auth_token", "nightmarket-terminal-2024");

    // HX711 load cell calibration — see header comment for how to determine value
    prefs.putFloat("scale_factor", 100.0f);   // placeholder — determine experimentally

    prefs.end();

    Serial.println("Provisioning complete.");
    Serial.println("Restore main.cpp and flash the real firmware.");
}

void loop() {
    delay(5000);
}
