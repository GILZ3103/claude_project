/*
 * Smart Night Market — BLE Positioning Beacon (anchor)
 * Hardware: any ESP32 DevKit. No sensors, no WiFi — advertise only.
 *
 * Role: a FIXED beacon. The customer's phone (apps/web Map page) scans these via
 * Web Bluetooth, measures each one's RSSI, and trilaterates its own position.
 *
 * What it advertises (fits in one 31-byte BLE advertising packet):
 *   - Flags
 *   - Complete 128-bit service UUID = VENUE_SERVICE_UUID  (so the web scan filter matches)
 *   - Manufacturer data: company 0xFFFF + 1 byte = ANCHOR_MINOR (the anchor id)
 *
 * Per-anchor setup:
 *   1. Add a row to positioning_anchors with beacon_minor + grid_x/grid_y (DB migration 008).
 *   2. Set ANCHOR_MINOR below to that beacon_minor.
 *   3. Flash. Mount the beacon at the recorded grid position.
 *
 * VENUE_SERVICE_UUID MUST match apps/web/src/lib/useLivePosition.ts.
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEAdvertising.h>

// ── Config ──────────────────────────────────────────────────────────────────
#define VENUE_SERVICE_UUID "6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10"
#ifndef ANCHOR_MINOR
#define ANCHOR_MINOR       1      // fallback; set via -DANCHOR_MINOR=N build flag (see platformio.ini)
#endif
#define LOCAL_COMPANY_ID   0xFFFF // reserved for local/test use

void setup() {
  Serial.begin(115200);
  delay(200);

  char devName[16];
  snprintf(devName, sizeof(devName), "NM-Anchor-%d", ANCHOR_MINOR);
  BLEDevice::init(devName);
  // Max TX power for coverage; lower (e.g. ESP_PWR_LVL_P3) if anchors are close together.
  BLEDevice::setPower(ESP_PWR_LVL_P9);

  BLEAdvertising* adv = BLEDevice::getAdvertising();

  BLEAdvertisementData advData;
  advData.setFlags(0x06); // LE General Discoverable + BR/EDR not supported
  advData.setCompleteServices(BLEUUID(VENUE_SERVICE_UUID));

  // Manufacturer data: 2-byte company id (little-endian) + 1-byte anchor minor.
  std::string mfg;
  mfg += (char)(LOCAL_COMPANY_ID & 0xFF);
  mfg += (char)((LOCAL_COMPANY_ID >> 8) & 0xFF);
  mfg += (char)(ANCHOR_MINOR & 0xFF);
  advData.setManufacturerData(mfg);

  adv->setAdvertisementData(advData);
  adv->setScanResponse(false);
  adv->setMinInterval(0x20); // 20 ms
  adv->setMaxInterval(0x40); // 40 ms

  BLEDevice::startAdvertising();
  Serial.printf("Anchor minor=%d advertising %s\n", ANCHOR_MINOR, VENUE_SERVICE_UUID);
}

void loop() {
  // Nothing to do — the BLE controller advertises autonomously.
  delay(5000);
}
