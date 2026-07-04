/*
 * RC522 UID Reader — env:uid-read
 * Standalone: no WiFi / HX711 / BLE. Tap a card, get its UID on Serial.
 *
 * Build/upload:
 *   pio run -d firmware/vendor-terminal -e uid-read -t upload -t monitor
 *
 * Pins: SS=21 SCK=18 MOSI=23 MISO=19 RST=22  VCC=3V3 GND=GND
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

void setup() {
    Serial.begin(115200);
    delay(800);
    Serial.println("\n=== RC522 UID Reader ===");
    Serial.println("Pins: SS=21 SCK=18 MOSI=23 MISO=19 RST=22  VCC=3V3 GND=GND");

    pinMode(RST_PIN, OUTPUT);
    digitalWrite(RST_PIN, LOW);  delay(50);
    digitalWrite(RST_PIN, HIGH); delay(50);

    SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
    mfrc522.PCD_Init();

    byte ver = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("VersionReg=0x%02X\n", ver);
    if (ver == 0x00 || ver == 0xFF) {
        Serial.println("WARNING: reader not responding — check wiring before tapping a card.");
    }
    Serial.println("Tap a card...\n");
}

void loop() {
    if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
        return;
    }

    String uid = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
        uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    Serial.println("Card UID: " + uid);
    Serial.println("PICC type: " + String(mfrc522.PICC_GetTypeName(mfrc522.PICC_GetType(mfrc522.uid.sak))));
    Serial.println("-----------------------------------");

    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(1000);
}
