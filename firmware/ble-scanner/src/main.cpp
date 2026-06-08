/*
 * Smart Night Market — BLE Anchor Scanner (raw calibration mode)
 *
 * Prints one raw RSSI reading per beacon per scan pass.
 * Use this to collect readings at known distances for calibration.
 *
 * Procedure:
 *   1. Stand at 1 m — let it scroll for ~10 s, copy all RSSI values.
 *   2. Repeat at 2 m, 3 m, 5 m.
 *   3. Share the values — rssi_at_1m and path_loss_n will be calculated from them.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <map>

#define VENUE_SERVICE_UUID  "6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10"
#define LOCAL_COMPANY_ID    0xFFFF
#define RSSI_AT_1M          -79    // least squares calibration 2026-06-08 (1m/2m/3m)
#define PATH_LOSS_N         2.4f   // least squares calibration 2026-06-08
#define SCAN_WINDOW_S       1

static std::map<int, int> latest; // minor → latest raw RSSI

class ScanCallback : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice dev) override {
    if (!dev.haveServiceUUID()) return;
    if (!dev.isAdvertisingService(BLEUUID(VENUE_SERVICE_UUID))) return;
    if (!dev.haveManufacturerData()) return;

    std::string mfg = dev.getManufacturerData();
    if (mfg.size() < 3) return;
    uint16_t company = (uint8_t)mfg[0] | ((uint8_t)mfg[1] << 8);
    if (company != LOCAL_COMPANY_ID) return;

    int minor = (uint8_t)mfg[2];
    latest[minor] = dev.getRSSI();
  }
};

static BLEScan* scanner;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== NM BLE Anchor Scanner — calibration mode ===");
  Serial.println("Stand at a known distance, let readings scroll for 10 s, then move.\n");

  BLEDevice::init("NM-Scanner");
  scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(new ScanCallback(), /*wantDuplicates=*/true);
  scanner->setActiveScan(false);
  scanner->setInterval(100);
  scanner->setWindow(99);
}

void loop() {
  latest.clear();
  scanner->start(SCAN_WINDOW_S, false);

  if (latest.empty()) {
    Serial.println("[no anchors in range]");
  } else {
    for (auto& [minor, rssi] : latest) {
      float dist = powf(10.0f, (RSSI_AT_1M - (float)rssi) / (10.0f * PATH_LOSS_N));
      Serial.printf("minor=%d  RSSI=%4d dBm  est_dist=%5.2f m\n", minor, rssi, dist);
    }
  }
}
