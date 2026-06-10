/*
 * RC522 Isolation Diagnostic — env:rc522-test
 * Standalone: no WiFi / HX711 / BLE. Slow 1 MHz SPI + manual RST toggle.
 * Loops the VersionReg every 1 s so you can reseat wires and watch it go live.
 *
 * Build/upload:
 *   pio run -d firmware/vendor-terminal -e rc522-test -t upload -t monitor
 *
 * Healthy: VersionReg = 0x91 / 0x92 (genuine) or 0x88 / 0xB2 (clone).
 *   0x00 = no data on MISO  (check MISO=GPIO19, GND, wire length / clock)
 *   0xFF = MISO stuck HIGH   (line disconnected)
 */
#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN   21
#define RST_PIN  22
#define MOSI_PIN 23
#define MISO_PIN 19
#define SCK_PIN  18

MFRC522 mfrc522(SS_PIN, RST_PIN);

static const char* interpret(byte v) {
    switch (v) {
        case 0x91: return "v1.0 - OK";
        case 0x92: return "v2.0 - OK";
        case 0x88: return "Fudan FM17522 clone - OK";
        case 0xB2: return "Counterfeit FM17522 - OK";
        case 0x00: return "NO RESPONSE - MISO/GND/power or clock";
        case 0xFF: return "MISO stuck HIGH - line disconnected";
        default:   return "unknown - but chip IS responding";
    }
}

void setup() {
    Serial.begin(115200);
    delay(800);
    Serial.println("\n=== RC522 Isolation Diagnostic ===");
    Serial.println("Pins: SS=21 SCK=18 MOSI=23 MISO=19 RST=22  VCC=3V3 GND=GND");

    // Manual hardware reset
    pinMode(RST_PIN, OUTPUT);
    digitalWrite(RST_PIN, LOW);  delay(50);
    digitalWrite(RST_PIN, HIGH); delay(50);

    SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
    SPI.setFrequency(1000000);   // 1 MHz - forgiving for long/cheap jumpers
    mfrc522.PCD_Init();
    delay(100);

    byte ver  = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    byte mode = mfrc522.PCD_ReadRegister(MFRC522::ModeReg);
    byte tx   = mfrc522.PCD_ReadRegister(MFRC522::TxControlReg);
    Serial.printf("VersionReg=0x%02X (%s)\n", ver, interpret(ver));
    Serial.printf("ModeReg=0x%02X  TxControlReg=0x%02X\n", mode, tx);
    Serial.println("Looping version read every 1 s - reseat wires and watch...\n");
}

void loop() {
    byte ver = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("VersionReg = 0x%02X  (%s)\n", ver, interpret(ver));
    delay(1000);
}
