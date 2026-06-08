/*
 * Smart Night Market — BLE Anchor Scanner
 *
 * Flash to a spare ESP32. Scans for NM-Anchor beacons and prints each
 * anchor's RSSI + estimated distance to the serial monitor every second.
 *
 * Calibration procedure (do this before updating the database):
 *   1. Hold this ESP32 exactly 1 m from a beacon.
 *      The printed RSSI is that anchor's rssi_at_1m.
 *   2. Move to 3 m and 5 m; adjust PATH_LOSS_N until est_dist ≈ real dist.
 *      Typical range: 2.0 (open) – 3.0 (cluttered indoor).
 *   3. Update positioning_anchors rows with your measured values.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <map>

#define VENUE_SERVICE_UUID  "6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10"
#define LOCAL_COMPANY_ID    0xFFFF
#define RSSI_AT_1M          -59    // update after step 1 of calibration
#define PATH_LOSS_N         2.5f   // update after step 2 of calibration
#define SCAN_WINDOW_S       1      // BLE scan duration per pass (seconds)
#define STALE_MS            5000   // drop anchor from list after 5 s silence

struct Sighting {
  int rssi;
  unsigned long lastSeen;
};

static std::map<int, Sighting> sightings;

static float rssiToDistance(int rssi) {
  return powf(10.0f, (RSSI_AT_1M - (float)rssi) / (10.0f * PATH_LOSS_N));
}

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveServiceUUID()) return;
    if (!dev.isAdvertisingService(BLEUUID(VENUE_SERVICE_UUID))) return;
    if (!dev.haveManufacturerData()) return;

    // Manufacturer data format: 2-byte company id (LE) + 1-byte anchor minor
    std::string mfg = dev.getManufacturerData();
    if (mfg.size() < 3) return;
    uint16_t company = (uint8_t)mfg[0] | ((uint8_t)mfg[1] << 8);
    if (company != LOCAL_COMPANY_ID) return;
    int minor = (uint8_t)mfg[2];

    sightings[minor] = { dev.getRSSI(), millis() };
  }
};

static BLEScan* scanner;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== NM BLE Anchor Scanner ===");
  Serial.printf("UUID filter : %s\n", VENUE_SERVICE_UUID);
  Serial.printf("Calibration : rssi_at_1m=%d dBm  path_loss_n=%.1f\n\n",
                RSSI_AT_1M, PATH_LOSS_N);

  BLEDevice::init("NM-Scanner");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new ScanCallback(), /*wantDuplicates=*/true);
  scanner->setActiveScan(false); // passive — don't send scan requests
  scanner->setInterval(100);
  scanner->setWindow(99);
}

void loop() {
  scanner->start(SCAN_WINDOW_S, /*is_continue=*/false);

  unsigned long now = millis();

  // Purge stale sightings
  for (auto it = sightings.begin(); it != sightings.end(); ) {
    if (now - it->second.lastSeen > STALE_MS) it = sightings.erase(it);
    else ++it;
  }

  if (sightings.empty()) {
    Serial.println("[no anchors in range]");
  } else {
    for (auto& [minor, s] : sightings) {
      Serial.printf("[ANCHOR minor=%d]  RSSI=%4d dBm  est_dist=%5.2f m\n",
                    minor, s.rssi, rssiToDistance(s.rssi));
    }
  }
  Serial.println("---");
}
