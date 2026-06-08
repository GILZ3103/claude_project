// Native BLE scanning for the Capacitor (Android/iOS) app build.
//
// In a normal browser, indoor positioning uses Web Bluetooth scanning, which is
// gated behind an experimental Chrome flag and unavailable to real users. Inside
// the Capacitor native app we instead use @capacitor-community/bluetooth-le,
// which scans continuously with a single OS permission prompt and no flag.
//
// useLivePosition.ts picks this path automatically when running natively.

import { Capacitor } from '@capacitor/core'
import { BleClient, type ScanResult } from '@capacitor-community/bluetooth-le'

const LOCAL_COMPANY_ID = '65535' // 0xFFFF — our ESP32 beacons' manufacturer id

/** True only inside the packaged native app (not a normal browser tab). */
export function isNativeBle(): boolean {
  return Capacitor.isNativePlatform()
}

// Pull the advertised anchor id (beacon_minor) from a native scan result.
// Mirrors readMinor() in useLivePosition.ts:
//  1. manufacturerData[0xFFFF], first byte = minor (our ESP32 firmware)
//  2. serviceData on the venue UUID, first byte = minor (alt encoding)
//  3. Apple iBeacon manufacturer data (0x004C), minor at offset 20 (big-endian)
function readMinorNative(result: ScanResult, serviceUuid: string): number | null {
  const md = result.manufacturerData
  if (md) {
    const local = md[LOCAL_COMPANY_ID]
    if (local && local.byteLength >= 1) return local.getUint8(0)

    const apple = md['76'] // 0x004C
    if (apple && apple.byteLength >= 23) return apple.getUint16(20, false)
  }

  const sd = result.serviceData
  if (sd) {
    const v = sd[serviceUuid.toLowerCase()]
    if (v && v.byteLength >= 1) return v.getUint8(0)
  }

  return null
}

/**
 * Start a continuous native BLE scan filtered to the venue service UUID.
 * `onAdv` fires for every advertisement with the beacon's RSSI and minor.
 * `androidNeverForLocation` keeps this to Bluetooth-only permissions on
 * Android 12+ (no Location prompt) — fewer permissions for the user.
 */
export async function startNativeScan(
  serviceUuid: string,
  onAdv: (rssi: number, minor: number | null) => void,
): Promise<void> {
  await BleClient.initialize({ androidNeverForLocation: true })
  await BleClient.requestLEScan(
    { services: [serviceUuid], allowDuplicates: true },
    (result) => onAdv(result.rssi ?? -127, readMinorNative(result, serviceUuid)),
  )
}

export async function stopNativeScan(): Promise<void> {
  try {
    await BleClient.stopLEScan()
  } catch {
    // already stopped / never started — safe to ignore
  }
}
