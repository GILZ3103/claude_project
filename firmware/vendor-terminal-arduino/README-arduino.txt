Vendor Terminal Firmware — Arduino IDE Quick Start
===================================================

This package is already converted for the Arduino IDE.
Each sketch lives in its own folder with a matching .ino file:

  vendor-terminal/vendor-terminal.ino   <- MAIN firmware (flash this)
  provision/provision.ino               <- run ONCE to write WiFi/backend to NVS
  rc522-test/rc522-test.ino             <- optional RC522 wiring diagnostic

-------------------------------------------------
STEP 1 — Install ESP32 board support
-------------------------------------------------
Tools > Board > Boards Manager > search "esp32" (Espressif) > Install
Then select board:  Tools > Board > ESP32 Arduino > "ESP32 Dev Module"

-------------------------------------------------
STEP 2 — Install these 3 libraries
-------------------------------------------------
Tools > Manage Libraries, then search & install:

  MFRC522       (by miguelbalboa)        v1.4.10+
  ArduinoJson   (by Benoit Blanchon)     v6.x   (NOT v7)
  HX711         (by Bogdan Necula/bogde) v0.7.5+

These are built into the ESP32 board package — do NOT install separately:
  SPI, WiFi, HTTPClient, Preferences, BLEDevice, BLEUtils, BLEAdvertising

-------------------------------------------------
STEP 3 — Board settings (Tools menu)
-------------------------------------------------
  Partition Scheme : Huge APP (3MB No OTA / 1MB SPIFFS)
  Upload Speed     : 921600
  (matches platformio.ini: huge_app.csv, 921600)

-------------------------------------------------
STEP 4 — Provision once, then flash main
-------------------------------------------------
  1. Open provision/provision.ino, edit WIFI_SSID / WIFI_PASS / API_URL /
     AUTH_TOKEN if needed, Upload. Open Serial Monitor @ 115200 to confirm.
  2. Then open vendor-terminal/vendor-terminal.ino and Upload.
     (Credentials persist in NVS — you only provision once per device.)

NOTE: provision.ino contains plaintext WiFi password + auth token.
Keep this package private.
