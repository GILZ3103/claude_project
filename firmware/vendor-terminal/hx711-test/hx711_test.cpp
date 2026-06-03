/*
 * HX711 Raw Reading Test
 * Prints raw units every 500ms so you can determine the correct scale_factor.
 *
 * HOW TO CALIBRATE:
 *   1. Flash this sketch (env: hx711-test), open Serial Monitor at 115200
 *   2. Note the "Empty" reading (should be ~0 after tare)
 *   3. Place a known weight (e.g. 200g) on the scale
 *   4. Note the raw reading — scale_factor = raw_reading / known_grams
 *   5. Update scale_factor in provision.cpp and re-flash provision, then esp32dev
 *
 * Pins: DOUT=4  SCK=5
 */

#include <Arduino.h>
#include <HX711.h>

#define HX711_DOUT 4
#define HX711_SCK  5

HX711 scale;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=== HX711 Raw Reading Test ===");

    scale.begin(HX711_DOUT, HX711_SCK);

    if (!scale.wait_ready_timeout(3000)) {
        Serial.println("ERROR: HX711 not detected — check wiring");
        Serial.println("  DOUT → GPIO4,  SCK → GPIO5,  VCC → 3.3V,  GND → GND");
        while (true) delay(2000);
    }

    scale.set_scale(1.0f);  // raw units, no calibration
    scale.tare();
    Serial.println("HX711 detected & tared. Place weight on scale...\n");
    Serial.println("  Empty = ~0");
    Serial.println("  scale_factor = (reading with known weight) / (known grams)\n");
}

void loop() {
    if (scale.is_ready()) {
        float raw = scale.get_units(5);
        Serial.printf("Raw: %.1f\n", raw);
    }
    delay(500);
}
