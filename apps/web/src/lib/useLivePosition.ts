// Live indoor position via Web Bluetooth scanning (Android Chrome + experimental flag).
//
// The phone is the SCANNER: it listens for the fixed stall beacons (which advertise
// VENUE_SERVICE_UUID + a per-anchor id), smooths each beacon's RSSI, converts to a
// distance, and trilaterates its own grid position. All client-side.
//
// Hard limits (handled via feature-detect + graceful fallback in Map.tsx):
//   - Android Chrome only, with chrome://flags/#enable-experimental-web-platform-features
//   - No iOS / Safari
//   - Scanning pauses when the tab is backgrounded / screen locks

import { useCallback, useEffect, useRef, useState } from 'react'
import { ema, rssiToDistance, trilaterate, type AnchorReading, type PositionEstimate } from './trilaterate'

// 128-bit service UUID the beacons advertise (and we filter the scan on).
// MUST match the firmware (firmware/positioning-beacon).
export const VENUE_SERVICE_UUID = '6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10'

// Calibration: how many metres one grid cell represents. The RSSI model yields
// metres; anchor coords are in grid cells, so we convert. Tune on-site.
export const METERS_PER_GRID_CELL = 2.0

// Company id used by our ESP32 beacons (0xFFFF = reserved for local/test use).
const LOCAL_COMPANY_ID = 0xffff

export interface PositioningAnchor {
  anchor_id: string
  label: string | null
  beacon_minor: number
  grid_x: number
  grid_y: number
  rssi_at_1m: number
  path_loss_n: number
}

export type PositioningSupport = 'checking' | 'supported' | 'unsupported'
export type ScanState = 'idle' | 'scanning' | 'error'

// ── Minimal Web Bluetooth Scanning types (absent from the TS DOM lib) ────────
interface BluetoothLEScan {
  active: boolean
  stop(): void
}
interface BluetoothLEScanFilter {
  services?: string[]
  namePrefix?: string
}
interface BluetoothLEScanOptions {
  filters?: BluetoothLEScanFilter[]
  keepRepeatedDevices?: boolean
  acceptAllAdvertisements?: boolean
}
interface BluetoothAdvertisingEvent extends Event {
  rssi: number
  txPower?: number
  manufacturerData: Map<number, DataView>
  serviceData: Map<string, DataView>
}
interface BluetoothLE {
  requestLEScan(options?: BluetoothLEScanOptions): Promise<BluetoothLEScan>
  addEventListener(type: 'advertisementreceived', listener: (e: BluetoothAdvertisingEvent) => void): void
  removeEventListener(type: 'advertisementreceived', listener: (e: BluetoothAdvertisingEvent) => void): void
}

function getBluetoothLE(): BluetoothLE | undefined {
  const bt = (navigator as unknown as { bluetooth?: BluetoothLE }).bluetooth
  return bt && typeof bt.requestLEScan === 'function' ? bt : undefined
}

// Pull the advertised anchor id (beacon_minor) out of an advertisement. Supports:
//  1. our ESP32 beacons — manufacturerData[0xFFFF], first byte = minor
//  2. service data on VENUE_SERVICE_UUID, first byte = minor (alt encoding)
//  3. standard Apple iBeacon manufacturer data — minor at offset 20 (big-endian)
function readMinor(e: BluetoothAdvertisingEvent): number | null {
  const local = e.manufacturerData?.get(LOCAL_COMPANY_ID)
  if (local && local.byteLength >= 1) return local.getUint8(0)

  const sd = e.serviceData?.get(VENUE_SERVICE_UUID)
  if (sd && sd.byteLength >= 1) return sd.getUint8(0)

  const md = e.manufacturerData?.get(0x004c) // Apple iBeacon
  if (md && md.byteLength >= 23) return md.getUint16(20, false) // minor (big-endian)

  return null
}

export interface LivePositionState {
  support: PositioningSupport
  scanState: ScanState
  position: PositionEstimate | null
  /** how many distinct beacons are currently contributing */
  beaconCount: number
  error: string | null
  start: () => Promise<void>
  stop: () => void
}

export function useLivePosition(anchors: PositioningAnchor[]): LivePositionState {
  const [support, setSupport] = useState<PositioningSupport>('checking')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [position, setPosition] = useState<PositionEstimate | null>(null)
  const [beaconCount, setBeaconCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const scanRef = useRef<BluetoothLEScan | null>(null)
  const rssiByMinor = useRef<Map<number, number>>(new Map())
  // Keep the latest anchors in a ref so the advertisement handler stays stable.
  const anchorsRef = useRef<Map<number, PositioningAnchor>>(new Map())

  useEffect(() => {
    anchorsRef.current = new Map(anchors.map(a => [a.beacon_minor, a]))
  }, [anchors])

  useEffect(() => {
    setSupport(getBluetoothLE() ? 'supported' : 'unsupported')
  }, [])

  const recompute = useCallback(() => {
    const readings: AnchorReading[] = []
    for (const [minor, rssi] of rssiByMinor.current) {
      const anchor = anchorsRef.current.get(minor)
      if (!anchor) continue
      const distMeters = rssiToDistance(rssi, anchor.rssi_at_1m, anchor.path_loss_n)
      readings.push({
        x: anchor.grid_x,
        y: anchor.grid_y,
        distance: distMeters / METERS_PER_GRID_CELL,
      })
    }
    setBeaconCount(readings.length)
    const est = trilaterate(readings)
    if (est) setPosition(est)
  }, [])

  const handleAdvertisement = useCallback((e: BluetoothAdvertisingEvent) => {
    const minor = readMinor(e)
    if (minor === null) return
    if (!anchorsRef.current.has(minor)) return
    const prev = rssiByMinor.current.get(minor)
    rssiByMinor.current.set(minor, ema(prev, e.rssi))
    recompute()
  }, [recompute])

  const handlerRef = useRef(handleAdvertisement)
  useEffect(() => { handlerRef.current = handleAdvertisement }, [handleAdvertisement])

  const stop = useCallback(() => {
    const bt = getBluetoothLE()
    if (bt) bt.removeEventListener('advertisementreceived', handlerRef.current)
    scanRef.current?.stop()
    scanRef.current = null
    setScanState('idle')
  }, [])

  const start = useCallback(async () => {
    const bt = getBluetoothLE()
    if (!bt) {
      setSupport('unsupported')
      setError('Web Bluetooth scanning is not available on this device/browser.')
      return
    }
    try {
      setError(null)
      rssiByMinor.current.clear()
      bt.addEventListener('advertisementreceived', handlerRef.current)
      scanRef.current = await bt.requestLEScan({
        filters: [{ services: [VENUE_SERVICE_UUID] }],
        keepRepeatedDevices: true,
      })
      setScanState('scanning')
    } catch (err) {
      bt.removeEventListener('advertisementreceived', handlerRef.current)
      setScanState('error')
      setError(err instanceof Error ? err.message : 'Failed to start Bluetooth scan.')
    }
  }, [])

  // Clean up on unmount.
  useEffect(() => () => stop(), [stop])

  return { support, scanState, position, beaconCount, error, start, stop }
}
