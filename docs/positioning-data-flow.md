# Indoor Positioning & Navigation — Data Flow

How a customer's **live position** is sensed and drawn on the website map, and how
they're routed to a stall. Two views: the **user end** (what a person experiences)
and the **technical end** (what each component does with the data).

> Approach: **phone = scanner, stalls = beacons** (Web Bluetooth). Chosen because it
> needs **no app install** and uses **Bluetooth**. See "Constraints" for the limits.

---

## 1. The big picture

```
[Stall beacon 1]   [Stall beacon 2]   [Stall beacon 3+]     fixed ESP32 beacons
   (ESP32)             (ESP32)             (ESP32)           advertise UUID + id
       \                  |                  /
        \   BLE advertisements (continuous, ~every 30 ms)
         \                |                /
          ▼               ▼               ▼
        ┌─────────────────────────────────────────┐
        │   Customer's phone — website Map page    │   the phone LISTENS
        │   (apps/web, Web Bluetooth scan)         │   and does the math
        └─────────────────────────────────────────┘
                 ▲                       │
   anchor coords │ (HTTP GET once)       │ live (x, y) every ~1 s
   + calibration │                       ▼
        ┌──────────────┐         live blue dot + route to stall
        │   Backend    │
        │  /api/map    │
        └──────────────┘
              ▲
              │ reads
        ┌──────────────────────┐
        │ DB positioning_anchors│  (beacon id → grid_x/grid_y + calibration)
        └──────────────────────┘
```

The key idea: **the phone is the only device that can hear all the beacons at once,
so the phone computes its own position.** The backend just hands over the beacon map.

---

## 2. User end — what the customer experiences

1. **Open the website** → go to the **Vendor Map** page. Map, stalls, and the
   directory load on any phone.
2. **Pick a destination** — tap a stall (e.g. "Satay Station") → tap **Navigate Here**.
3. **Grant permission** — a popup ("Enable Live Tracking") → **Allow** → the browser's
   own Bluetooth prompt → accept. *This is the only step; nothing is installed.*
   - "Allow" grants permission to **listen** (scan) for beacons. It does **not** make
     the phone discoverable/broadcasting.
4. **The map comes alive** — a blue **"you are here" dot** appears with a soft halo
   (the halo size = how uncertain the estimate is), and a dashed **route line** is
   drawn from the dot to the chosen stall.
5. **Walk** — the dot moves and the route redraws about **once per second**.
6. A small badge shows status: `Live · 3 beacons · ±4.0m`, or `Searching for beacons…`.

**If the phone can't do it** (iPhone, or Chrome without the experimental flag): the
popup is skipped and the page shows *"Live tracking unavailable here — showing
directions"* with a static route from the entrance. Nothing breaks.

---

## 3. Technical end — step by step

### 3.1 Beacons advertise (ESP32, `firmware/positioning-beacon`)
Each fixed beacon continuously broadcasts a BLE advertising packet containing:
- **Flags**
- **Complete 128-bit service UUID** = `VENUE_SERVICE_UUID`
  (`6e2c0000-b85e-4f3a-9c1d-2a7f5e8d4b10`) — lets the phone's scan **filter** match it.
- **Manufacturer data**: company `0xFFFF` + 1 byte = `ANCHOR_MINOR` — the anchor's id.

No WiFi, no sensors, no scanning — advertise only. One beacon per anchor, each with a
unique `ANCHOR_MINOR`.

### 3.2 Backend serves the beacon map (`backend/src/routes/map.ts`)
`GET /api/map` returns vendors, kiosks, **and** anchors:
```jsonc
{
  "grid_size": { "cols": 10, "rows": 8 },
  "vendors": [ /* business_name, grid_x, grid_y, ... */ ],
  "kiosks":  [ /* label, grid_x, grid_y */ ],
  "anchors": [
    { "anchor_id":"…", "label":"Anchor A - Entrance",
      "beacon_minor":1, "grid_x":1.0, "grid_y":1.0,
      "rssi_at_1m":-59, "path_loss_n":2.5 }
  ]
}
```
Anchors come from the `positioning_anchors` table (migration `008`). If the table is
absent (older DB), `anchors` is `[]` and the rest of the map still works.

### 3.3 Phone scans + computes (`apps/web/src/lib/useLivePosition.ts`)
1. **Feature-detect** `navigator.bluetooth.requestLEScan`. Missing → `support:'unsupported'`.
2. On **Allow**, start an LE scan filtered to `VENUE_SERVICE_UUID`, listen for
   `advertisementreceived` events.
3. For each advertisement: read the anchor id (`beacon_minor`) from manufacturer data,
   read the packet **RSSI**, and update a per-beacon **EMA** (smoothing, α≈0.3).
4. **Recompute** position on every update (see math below).

### 3.4 The math (`apps/web/src/lib/trilaterate.ts`, pure & tested)
**RSSI → distance** (log-distance path-loss model):
```
distance_m = 10 ^ ((rssi_at_1m − rssi) / (10 · path_loss_n))
```
- `rssi_at_1m`, `path_loss_n` come from each anchor's calibration row.
- Metres are converted to grid units by dividing by `METERS_PER_GRID_CELL` (≈2 m/cell).

**Distances → position** (least-squares trilateration): with ≥3 anchor distances, the
circle equations are linearised (subtract one equation from the rest) and the 2×2
normal equations are solved → `(grid_x, grid_y)`. The RMS leftover error becomes the
**accuracy** (halo radius). Fewer than 3 beacons, or collinear beacons → no estimate.

### 3.5 Render (`apps/web/src/pages/Map.tsx`)
- The computed `(grid_x, grid_y)` → screen position via the existing `toX/toY` helpers
  (same grid space as vendors/kiosks).
- Drives the **live dot** (+ accuracy halo) and the **navigation path** start point;
  the path's end is the selected stall's `grid_x/grid_y`.
- The "Allow" popup calls `useLivePosition().start()`; status badge reflects state.

### 3.6 Data at each hop
| Hop | Data | Transport |
|---|---|---|
| Beacons → phone | `VENUE_SERVICE_UUID`, `beacon_minor`, RSSI | BLE advertisement (continuous) |
| DB → backend | anchor rows | SQL |
| Backend → phone | anchor `grid_x/grid_y`, `rssi_at_1m`, `path_loss_n` | HTTP GET `/api/map` (once on load) |
| Inside phone | RSSI → distance → trilateration → `(x, y, accuracy)` | client-side JS |
| Phone → map UI | live `(x, y)` + route | React state (~1 s) |

---

## 4. Constraints (important)

- **Android Chrome only**, with `chrome://flags/#enable-experimental-web-platform-features` enabled.
- **No iOS / Safari** — Web Bluetooth is unavailable there.
- Scanning **stops when the tab is backgrounded or the screen locks**.
- Accuracy ≈ **2–5 m** (worse in crowds); the dot snaps to the grid + shows a halo.
- A website **cannot** make the phone a beacon — that's why the phone is the scanner.

This is suitable as a **demo / controlled-Android-device** feature, with a clean static
fallback everywhere else.

---

## 5. Setup / deployment checklist

1. **DB**: apply `database/migrations/008_add_positioning_anchors.sql`.
2. **Beacons**: for each anchor, set `ANCHOR_MINOR` in
   `firmware/positioning-beacon/src/main.cpp`, flash an ESP32, mount it.
3. **Record positions**: put each beacon's real `grid_x/grid_y` into `positioning_anchors`
   (must match its `ANCHOR_MINOR`).
4. **Calibrate**: measure `rssi_at_1m` and `path_loss_n` on-site; tune
   `METERS_PER_GRID_CELL` so distances match reality.
5. **Phone**: Android Chrome with the experimental flag on; open the Map page.

---

## 6. Files involved

| File | Role |
|---|---|
| `firmware/positioning-beacon/src/main.cpp` | ESP32 beacon (advertises UUID + anchor id) |
| `firmware/positioning-beacon/platformio.ini` | beacon build config |
| `database/migrations/008_add_positioning_anchors.sql` | `positioning_anchors` table + seed |
| `backend/src/routes/map.ts` | serves anchors in `GET /api/map` |
| `apps/web/src/lib/trilaterate.ts` | pure RSSI→distance + trilateration math |
| `apps/web/src/lib/useLivePosition.ts` | Web Bluetooth scan + EMA + feature-detect |
| `apps/web/src/pages/Map.tsx` | live dot, route, permission popup, fallback |
| `apps/web/src/lib/api.ts` | `MapData`/`MapAnchor` types for `getMap()` |
